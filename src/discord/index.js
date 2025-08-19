// src/discord/index.js
// Discord API helper functions

const https = require('https');

/**
 * Validate a Discord bot token
 * @param {string} token - Discord bot token
 * @returns {Promise<Object>} Bot user info if valid
 */
async function validateBotToken(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'discord.com',
      path: '/api/v10/users/@me',
      method: 'GET',
      headers: {
        'Authorization': `Bot ${token}`,
        'User-Agent': 'SACK BATTLE Bot (https://github.com/yourgithub/sack-battle, 1.0.0)'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve({
              id: json.id,
              username: json.username,
              discriminator: json.discriminator,
              bot: json.bot
            });
          } else {
            reject(new Error(json.message || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Invalid response format'));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Get Discord channel information
 * @param {string} channelId - Discord channel ID
 * @param {string} token - Discord bot token
 * @returns {Promise<Object>} Channel info if accessible
 */
async function getChannelInfo(channelId, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'discord.com',
      path: `/api/v10/channels/${channelId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bot ${token}`,
        'User-Agent': 'SACK BATTLE Bot (https://github.com/yourgithub/sack-battle, 1.0.0)'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve({
              id: json.id,
              name: json.name,
              type: json.type,
              guild_id: json.guild_id
            });
          } else {
            reject(new Error(json.message || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Invalid response format'));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Send a message to Discord channel
 * @param {string} channelId - Discord channel ID
 * @param {string} message - Message to send
 * @param {string} token - Discord bot token
 * @returns {Promise<boolean>} Success status
 */
async function sendMessage(channelId, message, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      content: message
    });

    const options = {
      hostname: 'discord.com',
      path: `/api/v10/channels/${channelId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'SACK BATTLE Bot (https://github.com/yourgithub/sack-battle, 1.0.0)'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(true);
        } else {
          try {
            const json = JSON.parse(data);
            reject(new Error(json.message || `HTTP ${res.statusCode}`));
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = {
  validateBotToken,
  getChannelInfo,
  sendMessage
};
