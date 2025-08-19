// src/core/constants.js
// Central place for non-secret shared constants (safe to require anywhere)
module.exports = {
  IRC_URL: 'wss://irc-ws.chat.twitch.tv:443',
  EVENTSUB_URL: 'wss://eventsub.wss.twitch.tv/ws',
  BACKOFF_MAX_ATTEMPTS: 6,
  ASSET_FOLDERS: ['avatars','boss','battlefield'],
  BUFF_ANIM_DURATION_MS: 2600,
};
