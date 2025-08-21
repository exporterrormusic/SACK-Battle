/**
 * Twitch Extension Integration for SACK BATTLE
 * Connects to the Twitch Extension backend via WebSocket
 */

const { logger } = require('../../core');

class TwitchExtensionService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.serverUrl = 'ws://localhost:3001'; // Backend WebSocket port
    this.onMessage = null; // Callback for received messages
  }

  /**
   * Connect to the Twitch Extension backend
   */
  async connect() {
    try {
      logger.debug('twitch_ext', 'connect_start', { url: this.serverUrl });

      this.ws = new (require('ws'))(this.serverUrl);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info('twitch_ext', 'connected', { url: this.serverUrl });
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this._handleMessage(message);
        } catch (err) {
          logger.error('twitch_ext', 'message_parse_error', { error: err.message });
        }
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        logger.info('twitch_ext', 'disconnected', { 
          code, 
          reason: reason.toString(),
          willReconnect: this.reconnectAttempts < this.maxReconnectAttempts
        });
        
        this._attemptReconnect();
      });

      this.ws.on('error', (err) => {
        logger.error('twitch_ext', 'connection_error', { 
          error: err.message,
          attempts: this.reconnectAttempts
        });
      });

    } catch (err) {
      logger.error('twitch_ext', 'connect_failed', { error: err.message });
      this._attemptReconnect();
    }
  }

  /**
   * Handle incoming messages from Twitch Extension
   */
  _handleMessage(message) {
    logger.debug('twitch_ext', 'message_received', {
      type: message.type,
      command: message.command,
      userId: message.userId,
      username: message.username
    });

    if (message.type === 'command' && this.onMessage) {
      // Convert Twitch Extension message to game format
      const gameMessage = {
        username: message.username || `TwitchUser_${message.userId.slice(-6)}`,
        displayName: message.username || `TwitchUser_${message.userId.slice(-6)}`,
        message: `!${message.command}`,
        channel: 'twitch_extension',
        source: 'twitch_extension',
        userId: message.userId,
        timestamp: message.timestamp
      };

      this.onMessage(gameMessage);
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('twitch_ext', 'max_reconnect_attempts', {
        attempts: this.reconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    logger.debug('twitch_ext', 'reconnect_scheduled', {
      attempt: this.reconnectAttempts,
      delay
    });

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Set message handler
   */
  setMessageHandler(handler) {
    this.onMessage = handler;
  }

  /**
   * Disconnect from backend
   */
  disconnect() {
    if (this.ws) {
      this.isConnected = false;
      this.ws.close();
      this.ws = null;
      logger.info('twitch_ext', 'disconnected_manually');
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      serverUrl: this.serverUrl
    };
  }
}

module.exports = TwitchExtensionService;
