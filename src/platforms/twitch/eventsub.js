// src/twitch/eventsub.js
// EventSub WebSocket manager with enhanced error logging.
const WebSocket = require('ws');
const { nextDelay } = require('./backoff');

class EventSubClient {
  constructor({ channelLogin, token, clientId, helixGetUser, helixCreateSubscription, onStatus, onNotification, debug }){
    this.channelLogin = channelLogin;
    this.token = token; // clean (no oauth:)
    this.clientId = clientId;
    this.helixGetUser = helixGetUser;
    this.helixCreateSubscription = helixCreateSubscription;
    this.onStatus = onStatus || (()=>{});
    this.onNotification = onNotification || (()=>{});
    this.debug = debug || (()=>{});
    this.socket = null;
    this._attempt = 0;
    this._broadcasterId = null;
  }
  _log(scope,msg,extra){ this.debug(scope,msg,extra); }
  async connect(){
    this._log('eventsub', 'connect_test', { message: 'This is a test log' });
    try {
      this._log('eventsub','connect_start',{ channel:this.channelLogin });
      if (!this._broadcasterId) {
        this._log('eventsub', 'helixGetUser_start', { 
          channel: this.channelLogin,
          hasToken: !!this.token,
          tokenLength: this.token ? this.token.length : 0,
          hasClientId: !!this.clientId,
          tokenPreview: this.token ? this.token.substring(0, 8) + '...' : 'none'
        });
        let user=null;
        try {
          user = await this.helixGetUser(this.channelLogin, this.token, this.clientId);
          this._log('eventsub', 'helixGetUser_success', { 
            user: user ? {
              id: user.id,
              login: user.login,
              display_name: user.display_name,
              type: user.type
            } : null
          });
        } catch(e){
          // Enhanced error logging
          this._log('eventsub', 'helixGetUser_error', { 
            error: e.message,
            channel: this.channelLogin,
            hasToken: !!this.token,
            tokenLength: this.token ? this.token.length : 0,
            hasClientId: !!this.clientId,
            tokenPreview: this.token ? this.token.substring(0, 8) + '...' : 'none'
          });
          
          // Check if it's an HTTP error with status code
          if (e.message && (e.message.includes('401') || e.message.includes('Unauthorized'))) {
            this._log('eventsub', 'auth_error', { 
              message: 'Token authentication failed - check if token is valid and from broadcaster account'
            });
          }
          if (e.message && e.message.includes('403')) {
            this._log('eventsub', 'permission_error', { 
              message: 'Token lacks required permissions - check scopes'
            });
          }
          if (e.message && e.message.includes('404')) {
            this._log('eventsub', 'user_not_found', { 
              message: 'Channel not found - check channel name spelling'
            });
          }
          
          // Also log the original error for debugging
          this._log('eventsub', 'helixGetUser_detailed_error', { 
            fullError: e.toString(),
            errorName: e.name,
            errorCode: e.code,
            stack: e.stack ? e.stack.split('\n')[0] : 'no stack'
          });
          
          this._log('eventsub','user_lookup_error',{ error:e.message });
          throw e;
        }
        if (!user || !user.id) {
          this._log('eventsub', 'helixGetUser_empty', { 
            user,
            message: 'API returned empty user data'
          });
          this._log('eventsub','user_lookup_empty',{});
          throw new Error('User lookup failed - empty response from Twitch API');
        }
        this._broadcasterId = user.id;
        this._log('eventsub','user_lookup_ok',{ 
          id:user.id, 
          login:user.login,
          display_name: user.display_name || user.login
        });
      }
      this._open();
    } catch(e){ 
      this._log('eventsub','init_fail',{ 
        error:e.message,
        errorType: e.name || 'Unknown',
        phase: this._broadcasterId ? 'websocket' : 'user_lookup'
      }); 
      this._scheduleReconnect(); 
    }
  }
  _open(){
    if (this.socket && this.socket.readyState === 1) {
      this._log('eventsub', 'websocket_already_open', {});
      return;
    }
    this.onStatus({ status:'connecting' });
    this._log('eventsub','ws_attempt',{ url: 'wss://eventsub.wss.twitch.tv/ws' });
    this.socket = new WebSocket('wss://eventsub.wss.twitch.tv/ws');
    let sessionId = null;
    
    this.socket.on('open', () => { 
      this._log('eventsub','ws_open', { readyState: this.socket.readyState }); 
    });
    
    this.socket.on('message', raw => {
      let obj=null; 
      try { 
        obj = JSON.parse(raw.toString()); 
      } catch(e){ 
        this._log('eventsub','parse_fail',{ 
          error:e.message, 
          rawLength: raw.length,
          rawPreview: raw.toString().substring(0, 100) + '...'
        }); 
        return; 
      }
      
      const meta = obj.metadata || {}; 
      const type = (meta.message_type||'').toLowerCase();
      
      this._log('eventsub','message_received', { 
        type, 
        hasPayload: !!obj.payload,
        messageId: meta.message_id
      });
      
      if (type === 'session_welcome') {
        sessionId = obj.payload && obj.payload.session && obj.payload.session.id;
        this._attempt = 0;
        this.onStatus({ status:'connected' });
        this._log('eventsub','welcome',{ 
          sessionId,
          hasSession: !!sessionId,
          broadcasterId: this._broadcasterId
        });
        
        // subscribe to required events
        const needed = [
          { type:'channel.channel_points_custom_reward_redemption.add', version:'1', condition:{ broadcaster_user_id: this._broadcasterId } },
          { type:'channel.cheer', version:'1', condition:{ broadcaster_user_id: this._broadcasterId } }
        ];
        
        this._log('eventsub','subscriptions_start', { count: needed.length });
        
        needed.forEach((sub, index) => {
          this._log('eventsub','subscription_attempt', { 
            index, 
            type: sub.type, 
            broadcasterId: this._broadcasterId 
          });
          
          this.helixCreateSubscription({ 
            type: sub.type, 
            version: sub.version, 
            condition: sub.condition, 
            sessionId, 
            token: this.token, 
            clientId: this.clientId 
          })
          .then(result => {
            this._log('eventsub','sub_ok',{ 
              type:sub.type,
              subscriptionId: result && result.data && result.data[0] && result.data[0].id
            });
          })
          .catch(err => {
            this._log('eventsub','sub_fail',{ 
              type:sub.type, 
              error: err.message,
              errorDetails: err.toString()
            });
            
            // Check for common subscription errors
            if (err.message && err.message.includes('401')) {
              this._log('eventsub','sub_auth_error', { 
                type: sub.type,
                message: 'Subscription failed - token authentication issue'
              });
            }
            if (err.message && err.message.includes('403')) {
              this._log('eventsub','sub_permission_error', { 
                type: sub.type,
                message: 'Subscription failed - insufficient permissions'
              });
            }
          });
        });
      } else if (type === 'session_keepalive') {
        this._log('eventsub','keepalive_received', {});
        this.onStatus({ status:'pong' });
      } else if (type === 'session_reconnect') {
        const newUrl = obj.payload && obj.payload.session && obj.payload.session.reconnect_url;
        this._log('eventsub','reconnect_requested', { newUrl: !!newUrl });
        if (newUrl) { 
          try { 
            this.socket.close(); 
          } catch(_){} 
          this.socket = new WebSocket(newUrl); 
        }
      } else if (type === 'notification') {
        const subType = obj.payload && obj.payload.subscription && obj.payload.subscription.type;
        const event = obj.payload && obj.payload.event;
        this._log('eventsub','notification',{ 
          subType,
          hasEvent: !!event,
          eventKeys: event ? Object.keys(event) : []
        });
        this.onNotification(subType, event);
      } else {
        this._log('eventsub','unknown_message_type', { type, metadata: meta });
      }
    });
    
    this.socket.on('close', (code,reason) => { 
      this._log('eventsub','ws_close',{ 
        code, 
        reason:reason&&reason.toString(),
        wasConnected: this._attempt === 0
      }); 
      this.onStatus({ status:'disconnected' }); 
      this._scheduleReconnect(); 
    });
    
    this.socket.on('error', e => { 
      this._log('eventsub','ws_error',{ 
        error:e.message,
        errorCode: e.code,
        errorType: e.name || 'Unknown'
      }); 
      this.onStatus({ status:'error', error:e.message }); 
      this._scheduleReconnect(); 
    });
  }
  
  _scheduleReconnect(){
    this._attempt += 1; 
    const delay = nextDelay(this._attempt); 
    this._log('eventsub','reconnect_scheduled', { attempt: this._attempt, delay });
    this.onStatus({ status:'reconnect_wait', delay }); 
    setTimeout(()=> this.connect(), delay);
  }
  
  dispose(){ 
    this._log('eventsub','dispose_called', {});
    try { 
      if (this.socket) {
        this._log('eventsub','closing_socket', { readyState: this.socket.readyState });
        this.socket.close(); 
      }
    } catch(e) { 
      this._log('eventsub','dispose_error', { error: e.message });
    } 
  }
}

module.exports = { EventSubClient };