// src/twitch/irc.js
// Raw minimal IRC (Twitch chat) connector.
const WebSocket = require('ws');
const { nextDelay } = require('./backoff');

class TwitchIrcClient {
  constructor({ username, token, channel, onStatus, onMessage, debug }){
    this.username = username;
    this.token = token; // may include oauth:
    this.channel = channel;
    this.onStatus = onStatus || (()=>{});
    this.onMessage = onMessage || (()=>{});
    this.debug = debug || (()=>{});
    this.ws = null;
    this.connected = false;
    this._attempt = 0;
    this.keepaliveTimer = null;
  }
  _log(scope, msg, extra){ this.debug(scope, msg, extra); }
  connect(){
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    const cleanToken = this.token.replace(/^oauth:/,'');
    this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    this.onStatus({ status:'connecting' });
    this._log('irc','ws_opening');
    let connectedMark = false;
    const send = line => { try { this.ws.send(line+'\r\n'); this._log('irc','send',{ line }); } catch(e){ this._log('irc','send_fail',{ error:e.message }); } };
    this.sendRaw = send;
    this.ws.on('open', () => {
      this._log('irc','open');
      send(`PASS oauth:${cleanToken}`);
      send(`NICK ${this.username}`);
      send('CAP REQ :twitch.tv/tags');
      send('CAP REQ :twitch.tv/commands');
      send('CAP REQ :twitch.tv/membership');
      send(`JOIN #${this.channel}`);
      setTimeout(()=>{ if(!connectedMark){ markConnected('timeout'); } }, 4000);
    });
    const markConnected = (reason) => {
      if (connectedMark) return; connectedMark = true; this.connected = true; this._attempt = 0; this.onStatus({ status:'connected', reason }); };
    this.ws.on('message', raw => {
      const text = raw.toString();
      text.split(/\r?\n/).forEach(line => {
        if (!line) return;
        if (line.startsWith('PING')) { send(line.replace('PING','PONG')); this.onStatus({ status:'pong' }); return; }
        
        // Parse Twitch tags and message
        let tags = {};
        let parseLine = line;
        
        if (parseLine.startsWith('@')) { 
          const sp = parseLine.indexOf(' '); 
          if (sp !== -1) {
            const tagString = parseLine.slice(1, sp);
            parseLine = parseLine.slice(sp + 1);
            
            // Parse tags into object
            tagString.split(';').forEach(tag => {
              const [key, value] = tag.split('=');
              if (key && value !== undefined) {
                tags[key] = value === '' ? null : value;
              }
            });
          }
        }
        
        if (/^:[^!]+![^ ]+ PRIVMSG #[^ ]+ :/.test(parseLine)) {
          const m = parseLine.match(/^:([^!]+)!.* PRIVMSG #([^ ]+) :(.+)$/);
          if (m) { 
            const username = m[1]; 
            const channel = m[2]; 
            const message = m[3]; 
            
            // Extract important user info from tags
            const userInfo = {
              username, 
              displayName: tags['display-name'] || username, 
              message, 
              channel,
              userId: tags['user-id'], // Twitch user ID
              badges: tags['badges'], // User badges (broadcaster, mod, etc.)
              userType: tags['user-type'] || '', // User type
              mod: tags['mod'] === '1', // Is moderator
              subscriber: tags['subscriber'] === '1', // Is subscriber
              tags // Full tags object for debugging
            };
            
            this.onMessage(userInfo); 
            if(!connectedMark) markConnected('first_privmsg'); 
          }
        }
        if (/ 001 /.test(line)) markConnected('001');
        else if (/ 366 /.test(line)) markConnected('366');
        else if (/GLOBALUSERSTATE/.test(line)) markConnected('globaluserstate');
        else if (/CAP \* ACK/.test(line)) setTimeout(()=>markConnected('cap_ack_delay'),400);
        if (/Login authentication failed/i.test(line)) { this.onStatus({ status:'disconnected', reason:'login_auth_failed' }); }
      });
    });
    this.ws.on('close', () => { this._log('irc','close'); this.connected=false; this.onStatus({ status:'disconnected', reason:'irc_closed' }); this._scheduleReconnect(); });
    this.ws.on('error', e => { this._log('irc','error',{ error:e.message }); this.onStatus({ status:'disconnected', reason:'irc_error' }); });
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = setInterval(()=>{ try { send('PING :keepalive'); } catch(_){} }, 300000);
  }
  _scheduleReconnect(){
    this._attempt += 1; const delay = nextDelay(this._attempt); this.onStatus({ status:'reconnect_wait', delay }); setTimeout(()=> this.connect(), delay);
  }
  say(text){ if (!this.sendRaw) return false; try { this.sendRaw(`PRIVMSG #${this.channel} :${text}`); return true; } catch(_){ return false; } }
  dispose(){ try { if (this.keepaliveTimer) clearInterval(this.keepaliveTimer); if (this.ws) this.ws.close(); } catch(_){ } }
}

module.exports = { TwitchIrcClient };
