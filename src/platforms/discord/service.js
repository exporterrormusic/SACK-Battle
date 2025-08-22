// src/discord/service.js
// Discord bot service integration
const WebSocket = require('ws');
const { readSettingsFile } = require('../../system/settings');
const { validateBotToken, getChannelInfo, sendMessage } = require('./index');

class DiscordService {
  constructor({ token, onCommand, onMessage, onAvatarChange, onStatus, debug }) {
    this.token = token;
    this.onCommand = onCommand || (() => {});
    this.onMessage = onMessage || (() => {});
    this.onAvatarChange = onAvatarChange || (() => {});
    this.onStatus = onStatus || (() => {});
    this.debug = debug || (() => {});
    
    this.ws = null;
    this.channelId = null;
    this.connected = false;
    this.heartbeatInterval = null;
    this.sessionId = null;
    this.resumeGatewayUrl = null;
    this.lastSequence = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.botUser = null;
  }

  _log(scope, msg, extra) {
    this.debug(scope, msg, extra);
  }

  async connect(channelId) {
    this._log('discord', 'connect_start', { channelId });
    
    try {
      // Validate bot token and get bot user info
      this.botUser = await validateBotToken(this.token);
      this._log('discord', 'token_validated', { 
        botUsername: this.botUser.username,
        botId: this.botUser.id 
      });

      // Validate channel access
      const channelInfo = await getChannelInfo(channelId, this.token);
      this.channelId = channelId;
      this._log('discord', 'channel_validated', { 
        channelName: channelInfo.name,
        channelId: channelInfo.id 
      });

      // Connect to Discord Gateway
      await this._connectGateway();
      
      this.onStatus({ status: 'connected', channel: channelInfo });
      return true;
    } catch (error) {
      this._log('discord', 'connect_error', { error: error.message });
      this.onStatus({ status: 'disconnected', reason: error.message });
      return false;
    }
  }

  async _connectGateway() {
    return new Promise((resolve, reject) => {
      // Use resume URL if available, otherwise get new gateway
      const gatewayUrl = this.resumeGatewayUrl || 'wss://gateway.discord.gg/?v=10&encoding=json';
      
      this._log('discord', 'gateway_connecting', { url: gatewayUrl });
      this.ws = new WebSocket(gatewayUrl);

      this.ws.on('open', () => {
        this._log('discord', 'gateway_opened');
        if (this.sessionId && this.lastSequence !== null) {
          // Resume existing session
          this._sendResume();
        } else {
          // New session
          this._sendIdentify();
        }
      });

      this.ws.on('message', (data) => {
        try {
          const payload = JSON.parse(data);
          this._handleGatewayMessage(payload);
          
          if (payload.op === 10) { // Hello
            resolve();
          }
        } catch (error) {
          this._log('discord', 'message_parse_error', { error: error.message });
        }
      });

      this.ws.on('close', (code, reason) => {
        this._log('discord', 'gateway_closed', { code, reason: reason.toString() });
        this.connected = false;
        this._clearHeartbeat();
        
        if (code === 4004) {
          // Authentication failed
          this.onStatus({ status: 'disconnected', reason: 'Invalid token' });
          reject(new Error('Invalid token'));
        } else if (code === 4014) {
          // Disallowed intents
          this.onStatus({ status: 'disconnected', reason: 'Missing permissions' });
          reject(new Error('Missing permissions'));
        } else {
          // Attempt reconnection
          this._attemptReconnect();
        }
      });

      this.ws.on('error', (error) => {
        this._log('discord', 'gateway_error', { error: error.message });
        reject(error);
      });
    });
  }

  _sendIdentify() {
    const identify = {
      op: 2,
      d: {
        token: this.token,
        intents: 33281, // GUILDS (1) + GUILD_MESSAGES (512) + MESSAGE_CONTENT (32768)
        properties: {
          os: 'windows',
          browser: 'sack-battle',
          device: 'sack-battle'
        }
      }
    };

    this._log('discord', 'sending_identify');
    this.ws.send(JSON.stringify(identify));
  }

  _sendResume() {
    const resume = {
      op: 6,
      d: {
        token: this.token,
        session_id: this.sessionId,
        seq: this.lastSequence
      }
    };

    this._log('discord', 'sending_resume', { sessionId: this.sessionId });
    this.ws.send(JSON.stringify(resume));
  }

  _handleGatewayMessage(payload) {
    if (payload.s !== null) {
      this.lastSequence = payload.s;
    }

    switch (payload.op) {
      case 10: // Hello
        this._log('discord', 'hello_received', { heartbeat_interval: payload.d.heartbeat_interval });
        this._startHeartbeat(payload.d.heartbeat_interval);
        break;

      case 11: // Heartbeat ACK
        this._log('discord', 'heartbeat_ack');
        break;

      case 0: // Dispatch
        this._handleDispatch(payload.t, payload.d);
        break;

      case 9: // Invalid Session
        this._log('discord', 'invalid_session', { can_resume: payload.d });
        if (!payload.d) {
          // Cannot resume, start fresh
          this.sessionId = null;
          this.lastSequence = null;
          setTimeout(() => this._sendIdentify(), 1000 + Math.random() * 4000);
        }
        break;

      case 7: // Reconnect
        this._log('discord', 'reconnect_requested');
        this._reconnect();
        break;
    }
  }

  _handleDispatch(eventType, data) {
    switch (eventType) {
      case 'READY':
        this._log('discord', 'ready', { 
          sessionId: data.session_id,
          botUser: data.user.username 
        });
        this.sessionId = data.session_id;
        this.resumeGatewayUrl = data.resume_gateway_url;
        this.connected = true;
        this.reconnectAttempts = 0;
        break;

      case 'RESUMED':
        this._log('discord', 'resumed');
        this.connected = true;
        this.reconnectAttempts = 0;
        break;

      case 'MESSAGE_CREATE':
        if (data.channel_id === this.channelId) {
          this._handleMessage(data);
        }
        break;
    }
  }

  _handleMessage(messageData) {
    // Ignore bot messages (including our own)
    if (messageData.author.bot) return;

    // Debug: Log the raw message data to see what's being received
    this._log('discord', 'message_debug', {
      author: messageData.author,
      content: messageData.content,
      type: messageData.type,
      channelId: messageData.channel_id
    });

    const content = messageData.content.trim();
    const username = messageData.author.username;
    const displayName = messageData.author.global_name || username;

    this._log('discord', 'message_received', {
      username,
      content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      hasContent: content.length > 0
    });

    // Always send a message event first to ensure user spawning
    // This happens for ANY message (text, empty, reactions, etc.)
    this.onMessage({
      username,
      displayName,
      message: content || `Hello from ${username}`, // Provide fallback for empty content
      channel: 'discord',
      source: 'discord'
    });

    // Only process commands and avatars if there's actual text content
    if (content.length === 0) return;

    // Check for avatar command first
    const avatarCommand = this._parseAvatarCommand(content);
    if (avatarCommand) {
      this._log('discord', 'avatar_command', {
        username,
        requestedName: avatarCommand,
        original: content
      });

      if (this.onAvatarChange) {
        this.onAvatarChange({
          username,
          requestedName: avatarCommand,
          source: 'discord'
        });
      }
      return;
    }

    // Check for game command
    const gameCommand = this._parseGameCommand(content);
    if (gameCommand) {
      this._log('discord', 'game_command', {
        username,
        command: gameCommand,
        original: content
      });

      this.onCommand({
        username,
        displayName,
        action: gameCommand,
        message: content,
        source: 'discord'
      });
    }
  }

  _parseGameCommand(message) {
    const cleaned = message.toLowerCase().trim();
    
    // Get settings from file - use safe fallback approach
    let discordCommands = {};
    try {
      const settings = readSettingsFile() || {};
      this._log('discord', 'settings_read_for_commands', { 
        hasSettings: !!settings,
        hasChatCommands: !!settings.chatCommands,
        chatCommandsStructure: settings.chatCommands ? Object.keys(settings.chatCommands) : []
      });
      
      discordCommands = settings.chatCommands?.discord || {};
      this._log('discord', 'discord_commands_loaded', { discordCommands });
    } catch (error) {
      // Fallback to empty commands if any error occurs
      this._log('discord', 'settings_access_error', { error: error.message });
    }
    
    // Get Discord commands from settings, with fallbacks
    const commandMap = {
      [discordCommands.attack || '!attack']: 'attack',
      [discordCommands.cover || '!cover']: 'cover', 
      [discordCommands.heal || '!heal']: 'heal',
      [discordCommands.aggressive || '!strike']: 'aggressive',
      [discordCommands.burst || '!burst']: 'burst'
    };
    
    this._log('discord', 'command_map_built', { commandMap, inputMessage: cleaned });
    
    // Check if message matches any configured command
    for (const [commandText, action] of Object.entries(commandMap)) {
      if (cleaned === commandText.toLowerCase()) {
        this._log('discord', 'command_matched', { commandText, action, inputMessage: cleaned });
        return action;
      }
    }
    
    this._log('discord', 'no_command_matched', { inputMessage: cleaned, availableCommands: Object.keys(commandMap) });
    return null;
  }

  _parseAvatarCommand(message) {
    const cleaned = message.toLowerCase().trim();
    
    // Get settings from file - use safe fallback approach
    let avatarCommand = '!avatar';
    try {
      const settings = readSettingsFile() || {};
      avatarCommand = settings.chatCommands?.discord?.avatar || '!avatar';
    } catch (error) {
      // Fallback to default avatar command if any error occurs
      this._log('discord', 'avatar_settings_access_error', { error: error.message });
    }
    
    // Match avatar commands like !avatar alice, !avatar 2b, etc.
    const avatarRegex = new RegExp(`^${avatarCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(.+)$`, 'i');
    const avatarMatch = cleaned.match(avatarRegex);
    if (avatarMatch) {
      return avatarMatch[1].trim();
    }
    
    return null;
  }

  _startHeartbeat(interval) {
    this._clearHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat = {
          op: 1,
          d: this.lastSequence
        };
        this.ws.send(JSON.stringify(heartbeat));
        this._log('discord', 'heartbeat_sent');
      }
    }, interval);
  }

  _clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._log('discord', 'max_reconnect_attempts');
      this.onStatus({ status: 'disconnected', reason: 'Max reconnection attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
    
    this._log('discord', 'reconnect_scheduled', { 
      attempt: this.reconnectAttempts, 
      delay 
    });
    
    setTimeout(() => {
      this._log('discord', 'reconnect_attempt', { attempt: this.reconnectAttempts });
      this._connectGateway().catch(error => {
        this._log('discord', 'reconnect_failed', { error: error.message });
      });
    }, delay);
  }

  _reconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Reconnecting');
    }
  }

  async sendMessage(text) {
    if (!this.channelId || !this.connected) {
      this._log('discord', 'send_message_not_connected');
      return false;
    }

    try {
      await sendMessage(this.channelId, text, this.token);
      this._log('discord', 'message_sent', { text: text.substring(0, 50) });
      return true;
    } catch (error) {
      this._log('discord', 'send_message_error', { error: error.message });
      return false;
    }
  }

  getHealth() {
    return {
      discord: this.connected ? 'connected' : 'disconnected',
      channelId: this.channelId,
      botUser: this.botUser ? `${this.botUser.username}#${this.botUser.discriminator}` : null,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  disconnect() {
    this._log('discord', 'disconnect_called');
    
    this.connected = false;
    this._clearHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Disconnecting');
      this.ws = null;
    }
    
    this.channelId = null;
    this.sessionId = null;
    this.resumeGatewayUrl = null;
    this.lastSequence = null;
    this.reconnectAttempts = 0;
    
    this.onStatus({ status: 'disconnected' });
  }
}

module.exports = { DiscordService };
