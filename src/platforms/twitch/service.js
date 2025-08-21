// src/twitch/service.js
// High-level façade that owns IRC + EventSub clients and exposes a simple API
// for connect, sendChat, health snapshot, and disposal. It keeps renderer IPC
// payload shapes unchanged by reusing existing helper modules.

const { TwitchIrcClient } = require('./irc');
const { EventSubClient } = require('./eventsub');
const { validateToken, helixGetUser, helixGetSelf, helixCreateEventSubSubscription, TwitchExtensionService } = require('.');
const { readSettingsFile, writeSettingsFile } = require('../../system/settings');
const CH = require('../../core/ipcChannels');

class TwitchService {
  constructor({ pushDebug, getWindow }) {
    this.pushDebug = pushDebug || function(){};
    this.getWindow = getWindow; // () => BrowserWindow
    this.irc = null;
    this.eventSub = null;
    this.extension = null; // Twitch Extension WebSocket service
    this.channel = null;
    this.botUsername = null;
    this.token = null; // clean token (no oauth: prefix)
    this.clientId = null;
  }

  async connect(creds) {
    this.pushDebug('service', 'connect_start', { hasCreds: !!creds });
    
    const win = this.getWindow && this.getWindow();
    if (!win) {
      this.pushDebug('service', 'no_window_error', {});
      throw new Error('No window available');
    }
    this.pushDebug('service', 'window_ok', { isDestroyed: win.isDestroyed() });
    
    if (!creds || !creds.botUsername || !creds.oauthToken || !creds.channel || !creds.clientId) {
      this.pushDebug('service', 'missing_creds', { 
        hasBotUsername: !!creds?.botUsername,
        hasOauthToken: !!creds?.oauthToken,
        hasChannel: !!creds?.channel,
        hasClientId: !!creds?.clientId
      });
      win.webContents.send(CH.TWITCH_CHAT_STATUS, { status: 'disconnected', reason: 'missing_fields' });
      return false;
    }
    this.pushDebug('service', 'creds_validated', {});
    
    const cleanToken = creds.oauthToken.replace(/^oauth:/,'');
    this.pushDebug('service', 'token_cleaned', { originalLength: creds.oauthToken.length, cleanLength: cleanToken.length });
    
    win.webContents.send(CH.TWITCH_CHAT_STATUS, { status: 'validating' });
    
    let validation=null; 
    try { 
      this.pushDebug('service', 'token_validation_start', {});
      validation = await validateToken(creds.oauthToken, creds.clientId); 
      this.pushDebug('service', 'token_validation_success', { hasScopes: !!(validation && validation.scopes) });
    } catch(e) { 
      this.pushDebug('service', 'token_validation_error', { error: e.message });
    }
    
    if (validation && validation.scopes) {
      this.pushDebug('service', 'token_scopes_processing', { scopeCount: validation.scopes.length });
      const expiresAt = validation.expires_in ? Date.now() + validation.expires_in*1000 : 0;
      const existing = readSettingsFile() || {}; 
      existing.twitchTokenScopes = validation.scopes; 
      if (expiresAt) existing.twitchTokenExpiresAt = expiresAt; 
      writeSettingsFile(existing);
      win.webContents.send(CH.TWITCH_CHAT_STATUS, { status: 'token-info', scopes: validation.scopes, expiresAt });
      this.pushDebug('auth','scopes',{ scopes: validation.scopes });
      if (!validation.scopes.includes('channel:read:redemptions')) this.pushDebug('auth','scope_missing_redemptions',{});
      if (!validation.scopes.includes('bits:read')) this.pushDebug('auth','scope_missing_bits',{});
    }
    
    // Self correction of bot username
    let selfUser=null; 
    try { 
      this.pushDebug('service', 'self_user_lookup_start', {});
      selfUser = await helixGetSelf(cleanToken, creds.clientId); 
      this.pushDebug('service', 'self_user_lookup_success', { hasLogin: !!(selfUser && selfUser.login) });
    } catch(e) { 
      this.pushDebug('service', 'self_user_lookup_error', { error: e.message });
    }
    
    if (selfUser && selfUser.login && selfUser.login.toLowerCase() !== creds.botUsername.toLowerCase()) {
      this.pushDebug('service', 'username_correction', { old: creds.botUsername, new: selfUser.login });
      const old = creds.botUsername; 
      creds.botUsername = selfUser.login; 
      win.webContents.send(CH.TWITCH_CHAT_STATUS, { status: 'corrected', old, newUsername: selfUser.login });
    }
    
    if (selfUser && selfUser.login) {
      this.pushDebug('eventsub','token_user',{ login: selfUser.login });
    }
    
    // Detect if token user (selfUser) differs from target channel (creds.channel). EventSub channel reward / cheer events require broadcaster auth.
    try {
      if (selfUser && selfUser.login && creds.channel && selfUser.login.toLowerCase() !== creds.channel.toLowerCase()) {
        const scopes = (validation && validation.scopes) || [];
        const needsBroadcaster = scopes.includes('channel:read:redemptions') || scopes.includes('bits:read');
        if (needsBroadcaster) {
          this.pushDebug('eventsub','token_channel_mismatch',{ tokenUser: selfUser.login, channel: creds.channel });
          win.webContents.send(CH.TWITCH_CHAT_STATUS, { status: 'warning', reason: 'token_not_broadcaster', tokenUser: selfUser.login, channel: creds.channel });
        }
      }
    } catch(e){ 
      this.pushDebug('service', 'channel_mismatch_check_error', { error: e.message });
    }
    
    this.pushDebug('service', 'persist_creds_start', {});
    this._persistCreds(creds, validation);
    this.pushDebug('service', 'persist_creds_done', {});

    // Dispose previous
    this.pushDebug('service', 'dispose_previous_start', {});
    if (this.irc) { 
      this.pushDebug('service', 'disposing_irc', {});
      try { this.irc.dispose(); } catch(e){ this.pushDebug('service', 'irc_dispose_error', { error: e.message }); } 
      this.irc = null; 
    }
    if (this.eventSub) { 
      this.pushDebug('service', 'disposing_eventsub', {});
      try { this.eventSub.dispose(); } catch(e){ this.pushDebug('service', 'eventsub_dispose_error', { error: e.message }); } 
      this.eventSub = null; 
    }
    if (this.extension) { 
      this.pushDebug('service', 'disposing_extension', {});
      try { this.extension.disconnect(); } catch(e){ this.pushDebug('service', 'extension_dispose_error', { error: e.message }); } 
      this.extension = null; 
    }
    this.pushDebug('service', 'dispose_previous_done', {});

    // IRC
    this.pushDebug('service', 'irc_init_start', {});
    this.irc = new TwitchIrcClient({
      channel: creds.channel,
      username: creds.botUsername,
      token: cleanToken,
      debug: (scope,msg,extra) => this.pushDebug(scope,msg,extra),
      onStatus: s => {
        if (!win || win.isDestroyed()) return;
        if (s.status === 'connected') win.webContents.send(CH.TWITCH_CHAT_STATUS, { status: 'connected', bot: creds.botUsername });
        else if (s.status === 'connecting') win.webContents.send(CH.TWITCH_CHAT_STATUS, { status: 'connecting' });
        else if (s.status === 'pong') win.webContents.send(CH.TWITCH_CHAT_STATUS, { status: 'pong' });
        else if (s.status === 'disconnected') win.webContents.send(CH.TWITCH_CHAT_STATUS, { status: 'disconnected', reason: s.reason });
        else if (s.status === 'reconnect_wait') win.webContents.send(CH.TWITCH_CHAT_STATUS, { status: 'reconnect_wait', delay: s.delay });
      },
      onMessage: msg => {
        if (!win || win.isDestroyed()) return;
        win.webContents.send(CH.TWITCH_CHAT, { 
          username: msg.username, 
          displayName: msg.displayName, 
          message: msg.message, 
          channel: msg.channel,
          userId: msg.userId, // CRITICAL: Forward the userId for unified identity
          mod: msg.mod,
          badges: msg.badges,
          source: 'twitch' // Mark as coming from Twitch
        });
      }
    });
    
    this.pushDebug('service', 'irc_connect_start', {});
    try {
      this.irc.connect();
      this.pushDebug('service', 'irc_connect_initiated', {});
    } catch(e) {
      this.pushDebug('chat','connect_fail',{ error: e.message });
    }

    // EventSub
    this.pushDebug('service', 'eventsub_init_start', { 
      channel: creds.channel, 
      hasToken: !!cleanToken,
      hasClientId: !!creds.clientId 
    });

    try {
      this.eventSub = new EventSubClient({
        channelLogin: creds.channel,
        token: cleanToken,
        clientId: creds.clientId,
        helixGetUser: (login, token, clientId) => helixGetUser(login, token, clientId),
        helixCreateSubscription: ({ type, version, condition, sessionId, token, clientId }) => helixCreateEventSubSubscription({ type, version, condition, sessionId, token, clientId }),
        debug: (scope,msg,extra) => this.pushDebug(scope,msg,extra),
        onStatus: s => {
          if (!win || win.isDestroyed()) return;
          this.pushDebug('eventsub_status', s.status, { delay: s.delay });
          if (s.status === 'connected') win.webContents.send(CH.TWITCH_PUBSUB_STATUS, { status: 'connected' });
          else if (s.status === 'connecting') win.webContents.send(CH.TWITCH_PUBSUB_STATUS, { status: 'connecting' });
          else if (s.status === 'pong') win.webContents.send(CH.TWITCH_PUBSUB_STATUS, { status: 'pong' });
          else if (s.status === 'reconnect_wait') win.webContents.send(CH.TWITCH_PUBSUB_STATUS, { status: 'reconnect_wait', delay: s.delay });
          else if (s.status === 'disconnected') win.webContents.send(CH.TWITCH_PUBSUB_STATUS, { status: 'disconnected' });
        },
        onNotification: (subType, eventPayload) => this._handleNotification(subType, eventPayload, win)
      });

      this.pushDebug('service', 'eventsub_client_created', { 
        hasEventSub: !!this.eventSub,
        channelLogin: this.eventSub ? this.eventSub.channelLogin : 'none'
      });

      // Try to connect
      this.pushDebug('service', 'eventsub_connect_attempt', {});
      this.eventSub.connect().then(() => {
        this.pushDebug('service', 'eventsub_connect_promise_resolved', {});
      }).catch(e => {
        this.pushDebug('service', 'eventsub_connect_promise_rejected', { 
          error: e.message,
          errorType: e.name || 'Unknown',
          stack: e.stack ? e.stack.split('\n')[0] : 'no stack'
        });
      });
      
      this.pushDebug('service', 'eventsub_connect_initiated', {});

    } catch (e) {
      this.pushDebug('service', 'eventsub_init_error', { 
        error: e.message,
        errorType: e.name || 'Unknown',
        stack: e.stack ? e.stack.split('\n')[0] : 'no stack'
      });
    }

    // Twitch Extension Integration
    this.pushDebug('service', 'extension_init_start', {});
    try {
      this.extension = new TwitchExtensionService();
      this.extension.setMessageHandler((message) => {
        if (!win || win.isDestroyed()) return;
        // Forward extension messages as chat messages to the game
        win.webContents.send(CH.TWITCH_CHAT, {
          username: message.username,
          displayName: message.displayName,
          message: message.message,
          channel: message.channel,
          source: message.source
        });
      });
      this.extension.connect();
      this.pushDebug('service', 'extension_init_success', {});
    } catch (e) {
      this.pushDebug('service', 'extension_init_error', { 
        error: e.message 
      });
    }

    // Diagnostic: if after 6s we have no eventsub socket open logs, emit a timeout hint.
    setTimeout(()=>{
      try {
        if (!this.eventSub || !this.eventSub.socket || this.eventSub.socket.readyState !== 1) {
          this.pushDebug('eventsub','inactivity_timeout',{ note: 'No EventSub ws_open within 6s. Likely token/channel mismatch or network block.' });
        }
      } catch(_){ }
    }, 6000);

    this.pushDebug('service', 'connect_finalization_start', {});
    this.channel = creds.channel;
    this.botUsername = creds.botUsername;
    this.token = cleanToken;
    this.clientId = creds.clientId;
    this.pushDebug('service', 'connect_complete', {});
    return true;
  }

  sendChat({ text, channel }) {
    if (!text || !this.irc) return false;
    try {
      this.irc.say(text);
      this.pushDebug('chat','say',{ text });
      return true;
    } catch(e) {
      this.pushDebug('chat','say_fail',{ error:String(e&&e.message||e) });
      return false;
    }
  }

  getHealth() {
    const s = readSettingsFile() || {};
    let chat='disconnected';
    if (this.irc) chat = this.irc._connected ? 'connected' : 'connecting';
    let eventSub='disconnected';
    if (this.eventSub && this.eventSub.socket) {
      try { eventSub = this.eventSub.socket.readyState === 1 ? 'connected' : 'connecting'; } catch(_){}
    }
    return { chat, eventSub, scopes: s.twitchTokenScopes || [], expiresAt: s.twitchTokenExpiresAt || 0 };
  }

  dispose() {
    if (this.irc) { try { this.irc.dispose(); } catch(_){ } this.irc=null; }
    if (this.eventSub) { try { this.eventSub.dispose(); } catch(_){ } this.eventSub=null; }
    if (this.extension) { try { this.extension.disconnect(); } catch(_){ } this.extension=null; }
  }

  _persistCreds(creds, validation) {
    try {
      const existing = readSettingsFile() || {};
      const merged = { ...existing, twitchBotUsername: creds.botUsername, twitchOauthToken: creds.oauthToken, twitchChannel: creds.channel, twitchClientId: creds.clientId || existing.twitchClientId, twitchClientSecret: creds.clientSecret || existing.twitchClientSecret };
      if (validation && validation.scopes) merged.twitchTokenScopes = validation.scopes;
      if (validation && validation.expires_in) merged.twitchTokenExpiresAt = Date.now() + validation.expires_in*1000;
      writeSettingsFile(merged);
    } catch(_){ }
  }

  _handleNotification(subType, eventPayload, win) {
    if (!win || win.isDestroyed()) return;
    // Always reload settings from disk before handling notification
    let s = null;
    try {
      s = readSettingsFile() || {};
    } catch (e) {
      this.pushDebug('trigger', 'settings_reload_error', { error: String(e && e.message || e) });
      s = {};
    }
    if (subType === 'channel.channel_points_custom_reward_redemption.add') {
      win.webContents.send(CH.TWITCH_POINTS, { redemption: eventPayload });
      try {
        const list = Array.isArray(s.channelPointTriggers) ? s.channelPointTriggers : [];
        const rawTitle = (eventPayload && eventPayload.reward && eventPayload.reward.title ? String(eventPayload.reward.title) : '');
        const title = rawTitle.toLowerCase();
        this.pushDebug('trigger','reward_received',{ title: rawTitle, configured: list.length });
        let matched = 0;
        // Debug: log the full eventPayload for channel point redemption
        this.pushDebug('avatar_debug', 'eventPayload', { eventPayload: JSON.stringify(eventPayload, null, 2) });
        list.forEach(r => {
          try {
            if (!r || !r.enabled) return; // disabled
            if (!r.match) { this.pushDebug('trigger','reward_skip_empty_match',{}); return; }
            const frag = String(r.match).toLowerCase();
            const isMatch = title.includes(frag);
            if (isMatch) {
              matched++;
              this.pushDebug('trigger','reward_match',{ match: r.match, key: r.key });
              win.webContents.send(CH.TWITCH_TRIGGER, { type: 'reward', key: r.key, match: r.match, user: eventPayload.user_name, title });
              // Avatar change logic: only if key is 'chooseavatar'
              if (r.key === 'chooseavatar') {
                const username = eventPayload.user_name;
                const requestedName = eventPayload.user_input || '';
                console.log('[MainProcess] Sending TWITCH_AVATAR_CHANGE:', { username, requestedName });
                win.webContents.send(CH.TWITCH_AVATAR_CHANGE, { username, requestedName });
              }
            }
          } catch(inner){ this.pushDebug('trigger','reward_row_error',{ error:String(inner&&inner.message||inner) }); }
        });
        if (!matched) this.pushDebug('trigger','reward_no_match',{ title: rawTitle });
      } catch(e){ this.pushDebug('trigger','reward_eval_error',{ error:String(e&&e.message||e) }); }
    } else if (subType === 'channel.cheer') {
      win.webContents.send(CH.TWITCH_BITS, eventPayload);
      try {
        const thresholds = Array.isArray(s.bitsThresholds) ? s.bitsThresholds : [];
        const bits = (eventPayload && (eventPayload.bits || eventPayload.bits_used || eventPayload.total_bits_used)) || 0;
        thresholds.filter(t => t && t.enabled && t.minBits && bits >= t.minBits)
          .forEach(t => {
            this.pushDebug('trigger','bits_threshold',{ minBits: t.minBits, key: t.key, bits });
            win.webContents.send(CH.TWITCH_TRIGGER, { type: 'bits', key: t.key, minBits: t.minBits, bits });
          });
      } catch(e){ this.pushDebug('trigger','bits_eval_error',{ error:String(e&&e.message||e) }); }
    }
  }
}

module.exports = { TwitchService };