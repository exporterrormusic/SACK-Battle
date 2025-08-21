// src/youtube/service.js
// YouTube Live Chat integration service
const https = require('https');

class YouTubeService {
  constructor({ apiKey, onCommand, onSuperchat, onStatus, debug }) {
    this.apiKey = apiKey;
    this.onCommand = onCommand || (() => {});
    this.onSuperchat = onSuperchat || (() => {});
    this.onStatus = onStatus || (() => {});
    this.debug = debug || (() => {});
    
    this.liveChatId = null;
    this.pollInterval = null;
    this.lastPollTime = null;
    this.isPolling = false;
    this.pollDelayMs = 5000; // 5 seconds between polls
    this.connected = false;
  }

  _log(scope, msg, extra) {
    this.debug(scope, msg, extra);
  }

  async connect(channelId) {
    try {
      this._log('youtube', 'connect_start', { channelId });
      this.onStatus({ status: 'connecting' });

      // Get live broadcast for the channel
      const broadcast = await this._getLiveBroadcast(channelId);
      if (!broadcast) {
        throw new Error('No active live stream found');
      }

      this.liveChatId = broadcast.snippet.liveChatId;
      this._log('youtube', 'live_chat_found', { liveChatId: this.liveChatId });

      // Start polling
      this._startPolling();
      this.connected = true;
      this.onStatus({ status: 'connected' });
      
      return true;
    } catch (error) {
      this._log('youtube', 'connect_error', { error: error.message });
      this.onStatus({ status: 'disconnected', reason: error.message });
      return false;
    }
  }

  async _getLiveBroadcast(channelId) {
    return new Promise((resolve, reject) => {
      const path = `/youtube/v3/search?` +
        `part=snippet&channelId=${channelId}&` +
        `eventType=live&type=video&key=${this.apiKey}`;

      const options = {
        hostname: 'www.googleapis.com',
        path: path,
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.items && json.items.length > 0) {
              // Get the live chat ID from the video
              this._getVideoLiveChatId(json.items[0].id.videoId)
                .then(resolve)
                .catch(reject);
            } else {
              resolve(null);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async _getVideoLiveChatId(videoId) {
    return new Promise((resolve, reject) => {
      const path = `/youtube/v3/videos?` +
        `part=liveStreamingDetails&id=${videoId}&key=${this.apiKey}`;

      const options = {
        hostname: 'www.googleapis.com',
        path: path,
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.items && json.items.length > 0) {
              const liveDetails = json.items[0].liveStreamingDetails;
              if (liveDetails && liveDetails.activeLiveChatId) {
                resolve({
                  snippet: {
                    liveChatId: liveDetails.activeLiveChatId
                  }
                });
              } else {
                resolve(null);
              }
            } else {
              resolve(null);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  _startPolling() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.lastPollTime = new Date(Date.now() - 30000).toISOString(); // Start 30s ago
    
    this.pollInterval = setInterval(() => {
      this._pollMessages();
    }, this.pollDelayMs);

    // Initial poll
    this._pollMessages();
  }

  async _pollMessages() {
    if (!this.liveChatId || !this.connected) return;

    try {
      const messages = await this._fetchLiveChatMessages();
      this._processMessages(messages);
    } catch (error) {
      this._log('youtube', 'poll_error', { error: error.message });
      
      // If error suggests stream ended, disconnect
      if (error.message.includes('liveChatNotFound') || 
          error.message.includes('liveChatEnded')) {
        this.disconnect();
      }
    }
  }

  async _fetchLiveChatMessages() {
    return new Promise((resolve, reject) => {
      let path = `/youtube/v3/liveChat/messages?` +
        `liveChatId=${this.liveChatId}&part=snippet,authorDetails&` +
        `maxResults=200&key=${this.apiKey}`;

      if (this.lastPollTime) {
        path += `&publishedAfter=${encodeURIComponent(this.lastPollTime)}`;
      }

      const options = {
        hostname: 'www.googleapis.com',
        path: path,
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'YouTube API error'));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  _processMessages(response) {
    if (!response.items) return;

    let latestTime = this.lastPollTime;

    response.items.forEach(message => {
      const { snippet, authorDetails } = message;
      const publishedAt = snippet.publishedAt;

      // Update latest timestamp
      if (publishedAt > latestTime) {
        latestTime = publishedAt;
      }

      // Handle Superchats (for buffs)
      if (snippet.type === 'superChatEvent') {
        this._handleSuperchat(snippet, authorDetails);
      }
      
      // Handle regular messages for game commands
      else if (snippet.type === 'textMessageEvent') {
        this._handleChatMessage(snippet, authorDetails);
      }
    });

    this.lastPollTime = latestTime;
  }

  _handleSuperchat(snippet, authorDetails) {
    try {
      const superChatDetails = snippet.superChatDetails;
      const amount = superChatDetails.amountMicros / 1000000;
      const currency = superChatDetails.currency;
      const message = superChatDetails.userComment || '';

      this._log('youtube', 'superchat_received', {
        username: authorDetails.displayName,
        amount,
        currency,
        message
      });

      // Trigger buff based on amount
      let buffType = null;
      if (amount >= 25) buffType = 'powerfulattack';
      else if (amount >= 15) buffType = 'attackup';
      else if (amount >= 10) buffType = 'massheal';
      else if (amount >= 5) buffType = 'reviveall';

      if (buffType) {
        this.onSuperchat({
          username: authorDetails.displayName,
          amount,
          currency,
          message,
          buffType,
          source: 'youtube_superchat'
        });
      }
    } catch (error) {
      this._log('youtube', 'superchat_error', { error: error.message });
    }
  }

  _handleChatMessage(snippet, authorDetails) {
    try {
      const message = snippet.textMessageDetails.messageText.trim();
      const username = authorDetails.displayName;

      // Check for avatar command first
      const avatarCommand = this._parseAvatarCommand(message);
      if (avatarCommand) {
        this._log('youtube', 'avatar_command', {
          username,
          requestedName: avatarCommand,
          original: message
        });

        // Send avatar change event
        if (this.onAvatarChange) {
          this.onAvatarChange({
            username,
            requestedName: avatarCommand,
            source: 'youtube_chat'
          });
        }
        return;
      }

      // Check if it's a game command
      const gameCommand = this._parseGameCommand(message);
      if (gameCommand) {
        this._log('youtube', 'game_command', {
          username,
          command: gameCommand,
          original: message
        });

        this.onCommand({
          username,
          action: gameCommand,
          message,
          source: 'youtube_chat'
        });
      }
    } catch (error) {
      this._log('youtube', 'message_error', { error: error.message });
    }
  }

  _parseGameCommand(message) {
    const command = message.toLowerCase().trim();
    const validCommands = {
      '!attack': 'attack',
      '!cover': 'cover', 
      '!heal': 'heal',
      '!aggressive': 'aggressive',
      '!burst': 'burst',
      // YouTube-specific alternatives to avoid chat spam
      '⚔️': 'attack',
      '🛡️': 'cover',
      '❤️': 'heal',
      '💥': 'aggressive',
      '⭐': 'burst'
    };

    return validCommands[command] || null;
  }

  _parseAvatarCommand(message) {
    try {
      // Get the configured avatar command from settings
      const { readSettingsFile } = require('../../system/settings');
      const settings = readSettingsFile() || {};
      const avatarCommand = (settings.chatCommands && settings.chatCommands.youtube && settings.chatCommands.youtube.avatar) || 
                           (settings.chatCommands && settings.chatCommands.avatar) || 
                           '!avatar';
      
      const trimmed = message.trim();
      const escapedCommand = avatarCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const avatarCommandRegex = new RegExp(`^${escapedCommand}\\s+(.+)$`, 'i');
      const match = trimmed.match(avatarCommandRegex);
      
      if (match && match[1]) {
        // Return the avatar name (folder name)
        return match[1].trim();
      }
      
      return null;
    } catch (error) {
      this._log('youtube', 'avatar_parse_error', { error: error.message });
      return null;
    }
  }

  // Send a message to YouTube chat (if needed for bot responses)
  async sendMessage(text) {
    if (!this.liveChatId) return false;

    try {
      // Note: This requires OAuth authentication with write permissions
      // For now, we'll just log it
      this._log('youtube', 'send_message_request', { text });
      return true;
    } catch (error) {
      this._log('youtube', 'send_message_error', { error: error.message });
      return false;
    }
  }

  disconnect() {
    this._log('youtube', 'disconnect_called');
    
    this.connected = false;
    this.isPolling = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    this.liveChatId = null;
    this.lastPollTime = null;
    
    this.onStatus({ status: 'disconnected' });
  }

  getHealth() {
    return {
      youtube: this.connected ? 'connected' : 'disconnected',
      liveChatId: this.liveChatId,
      isPolling: this.isPolling
    };
  }
}

module.exports = { YouTubeService };
