// src/platforms/youtube/index.js
// YouTube API helper functions
const https = require('https');

function validateApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    if (!apiKey) return reject(new Error('Missing API key'));
    
    // Use a simple endpoint that doesn't require OAuth - just validates the API key works
    const opts = {
      hostname: 'www.googleapis.com',
      path: `/youtube/v3/search?part=snippet&q=test&type=video&maxResults=1&key=${encodeURIComponent(apiKey)}`,
      method: 'GET'
    };
    
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            if (json.error.code === 400 && json.error.message.includes('API key')) {
              reject(new Error('Invalid API key'));
            } else if (json.error.code === 403) {
              reject(new Error('API key lacks required permissions. Make sure YouTube Data API v3 is enabled.'));
            } else {
              reject(new Error(json.error.message || 'API key validation failed'));
            }
          } else {
            // If we get here, the API key is valid
            resolve(json);
          }
        } catch(e) {
          reject(new Error('Failed to parse API response: ' + e.message));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(new Error('Network error: ' + err.message));
    });
    req.end();
  });
}

function getChannelInfo(channelId, apiKey) {
  return new Promise((resolve, reject) => {
    if (!channelId || !apiKey) {
      return reject(new Error('Missing channelId or apiKey'));
    }
    
    const opts = {
      hostname: 'www.googleapis.com',
      path: `/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`,
      method: 'GET'
    };
    
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            if (json.error.code === 400) {
              reject(new Error('Invalid Channel ID format'));
            } else if (json.error.code === 403) {
              reject(new Error('API key lacks required permissions. Make sure YouTube Data API v3 is enabled.'));
            } else {
              reject(new Error(json.error.message || 'Channel lookup failed'));
            }
          } else if (!json.items || json.items.length === 0) {
            reject(new Error('Channel not found. Please check the Channel ID.'));
          } else {
            resolve(json.items[0]);
          }
        } catch(e) {
          reject(new Error('Failed to parse API response: ' + e.message));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(new Error('Network error: ' + err.message));
    });
    req.end();
  });
}

function searchLiveStreams(channelId, apiKey) {
  return new Promise((resolve, reject) => {
    if (!channelId || !apiKey) {
      return reject(new Error('Missing channelId or apiKey'));
    }
    
    const opts = {
      hostname: 'www.googleapis.com',
      path: `/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`,
      method: 'GET'
    };
    
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'Live stream search failed'));
          } else {
            resolve(json.items || []);
          }
        } catch(e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  validateApiKey,
  getChannelInfo,
  searchLiveStreams
};
