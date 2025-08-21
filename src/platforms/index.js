// src/platforms/index.js
// Central export for all platform services
module.exports = {
  TwitchService: require('./twitch/service').TwitchService,
  YouTubeService: require('./youtube/service').YouTubeService,
  DiscordService: require('./discord/service').DiscordService,
  
  // Re-export sub-modules for advanced usage
  twitch: require('./twitch'),
  youtube: require('./youtube'),
  discord: require('./discord')
};
