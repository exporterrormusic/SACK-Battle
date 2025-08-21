// preload.js
const { contextBridge, ipcRenderer } = require('electron');
let CH;
try {
  CH = require('./src/core/ipcChannels');
} catch (e) {
  CH = {
    PERSIST_WINDOW_STATE: 'persist-window-state',
    PICK_IMAGE_FILE: 'pick-image-file',
    TWITCH_CONNECT: 'twitch-connect',
    TWITCH_OAUTH_FLOW: 'twitch-oauth-flow',
    TWITCH_OAUTH_TOKEN: 'twitch-oauth-token',
    TWITCH_SEND_CHAT: 'twitch-send-chat',
    TWITCH_FORGET_CREDS: 'twitch-forget-chat-creds',
    TWITCH_CHAT_STATUS: 'twitch-chat-status',
    TWITCH_CHAT: 'twitch-chat',
    TWITCH_REDEEM: 'twitch-redeem',
    TWITCH_POINTS: 'twitch-points',
    TWITCH_BITS: 'twitch-bits',
    TWITCH_TRIGGER: 'twitch-trigger',
    TWITCH_PUBSUB_STATUS: 'twitch-pubsub-status',
    TWITCH_AVATAR_CHANGE: 'twitch-avatar-change',
    TWITCH_DEBUG_LOG: 'twitch-debug-log',
    TWITCH_GET_DEBUG_LOG: 'twitch-get-debug-log',
    TWITCH_CLEAR_DEBUG_LOG: 'twitch-clear-debug-log',
    TWITCH_HEALTH: 'twitch-health',
    // YouTube channels
    YOUTUBE_CONNECT: 'youtube-connect',
    YOUTUBE_DISCONNECT: 'youtube-disconnect',
    YOUTUBE_STATUS: 'youtube-status',
    YOUTUBE_HEALTH: 'youtube-health',
    YOUTUBE_VALIDATE_KEY: 'youtube-validate-key',
    YOUTUBE_GET_CHANNEL_INFO: 'youtube-get-channel-info',
    // Discord channels
    DISCORD_CONNECT: 'discord-connect',
    DISCORD_DISCONNECT: 'discord-disconnect',
    DISCORD_STATUS: 'discord-status',
    DISCORD_HEALTH: 'discord-health',
    DISCORD_VALIDATE_TOKEN: 'discord-validate-token',
    DISCORD_GET_CHANNEL_INFO: 'discord-get-channel-info',
    DISCORD_SEND_MESSAGE: 'discord-send-message',
    LOAD_SETTINGS: 'load-settings',
    SAVE_SETTINGS: 'save-settings',
    GET_ASSETS_LIST: 'get-assets-list',
    GET_BOSS_MANIFEST: 'get-boss-manifest',
    ASSETS_UPDATED: 'assets-updated',
    BOSS_MANIFEST: 'boss-manifest'
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  onTwitchAvatarChange: (cb) => {
    console.log('[Preload] Registered onTwitchAvatarChange handler');
    const h = (e, d) => {
      console.log('[Preload] TWITCH_AVATAR_CHANGE event delivered:', d);
      cb(d);
    };
    ipcRenderer.on(CH.TWITCH_AVATAR_CHANGE, h);
    return () => ipcRenderer.removeListener(CH.TWITCH_AVATAR_CHANGE, h);
  },
  onYouTubeAvatarChange: (cb) => {
    console.log('[Preload] Registered onYouTubeAvatarChange handler');
    const h = (e, d) => {
      console.log('[Preload] YOUTUBE_AVATAR_CHANGE event delivered:', d);
      cb(d);
    };
    ipcRenderer.on(CH.YOUTUBE_AVATAR_CHANGE, h);
    return () => ipcRenderer.removeListener(CH.YOUTUBE_AVATAR_CHANGE, h);
  },
  onDiscordAvatarChange: (cb) => {
    console.log('[Preload] Registered onDiscordAvatarChange handler');
    const h = (e, d) => {
      console.log('[Preload] DISCORD_AVATAR_CHANGE event delivered:', d);
      cb(d);
    };
    ipcRenderer.on(CH.TWITCH_AVATAR_CHANGE, h); // Note: Discord uses same channel as Twitch for avatar changes
    return () => ipcRenderer.removeListener(CH.TWITCH_AVATAR_CHANGE, h);
  },
  // Chat messages forwarded from main process (twitch client)
  onChatMessage: (cb) => { const h = (event, data) => cb(data); ipcRenderer.on(CH.TWITCH_CHAT, h); return () => ipcRenderer.removeListener(CH.TWITCH_CHAT, h); },

  // Channel point redeems or other named events forwarded from main
  onRedeem: (cb) => { const ch = CH.TWITCH_REDEEM || 'twitch-redeem'; const h = (e,d)=>cb(d); ipcRenderer.on(ch,h); return () => ipcRenderer.removeListener(ch,h); },

  // General purpose send to main (if you want to add commands from UI) 
  send: (channel, payload) => {
    ipcRenderer.send(channel, payload);
  },

  // Request to get file list from a folder inside assets (avatars, boss, battlefield)
  getAssetsList: async (folderName) => ipcRenderer.invoke(CH.GET_ASSETS_LIST, folderName),
  loadSettings: async () => ipcRenderer.invoke(CH.LOAD_SETTINGS),
  saveSettings: async (settings) => ipcRenderer.invoke(CH.SAVE_SETTINGS, settings),
  sendChatMessage: async (msg) => ipcRenderer.invoke(CH.TWITCH_SEND_CHAT, msg),
  // (Removed legacy initTwitchPubSub; EventSub auto-initializes during connect)
  onBits: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.TWITCH_BITS,h); return () => ipcRenderer.removeListener(CH.TWITCH_BITS,h); },
  onPoints: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.TWITCH_POINTS,h); return () => ipcRenderer.removeListener(CH.TWITCH_POINTS,h); },
  onTrigger: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.TWITCH_TRIGGER,h); return () => ipcRenderer.removeListener(CH.TWITCH_TRIGGER,h); },
  onPubSubStatus: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.TWITCH_PUBSUB_STATUS,h); return () => ipcRenderer.removeListener(CH.TWITCH_PUBSUB_STATUS,h); },
  onAssetsUpdated: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.ASSETS_UPDATED,h); return () => ipcRenderer.removeListener(CH.ASSETS_UPDATED,h); },
  onChatStatus: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.TWITCH_CHAT_STATUS,h); return () => ipcRenderer.removeListener(CH.TWITCH_CHAT_STATUS,h); },
  connectTwitch: async (creds) => ipcRenderer.invoke(CH.TWITCH_CONNECT, creds),
  testChatMessage: async (text) => ipcRenderer.invoke(CH.TWITCH_SEND_CHAT, { text }),
  startOAuthFlow: async (clientId, scopes, redirectUri) => ipcRenderer.invoke(CH.TWITCH_OAUTH_FLOW, { clientId, scopes, redirectUri }),
  onOAuthToken: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.TWITCH_OAUTH_TOKEN,h); return () => ipcRenderer.removeListener(CH.TWITCH_OAUTH_TOKEN,h); },
  forgetTwitchCreds: async () => ipcRenderer.invoke(CH.TWITCH_FORGET_CREDS),
  getDebugLog: async () => ipcRenderer.invoke(CH.TWITCH_GET_DEBUG_LOG),
  clearDebugLog: async () => ipcRenderer.invoke(CH.TWITCH_CLEAR_DEBUG_LOG),
  onDebugLog: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.TWITCH_DEBUG_LOG,h); return () => ipcRenderer.removeListener(CH.TWITCH_DEBUG_LOG,h); },
  
  // YouTube Integration
  connectYouTube: async (apiKey, channelId) => ipcRenderer.invoke(CH.YOUTUBE_CONNECT, { apiKey, channelId }),
  disconnectYouTube: async () => ipcRenderer.invoke(CH.YOUTUBE_DISCONNECT),
  onYouTubeStatus: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.YOUTUBE_STATUS,h); return () => ipcRenderer.removeListener(CH.YOUTUBE_STATUS,h); },
  getYouTubeHealth: async () => ipcRenderer.invoke(CH.YOUTUBE_HEALTH),
  validateYouTubeKey: async (apiKey) => ipcRenderer.invoke(CH.YOUTUBE_VALIDATE_KEY, apiKey),
  getYouTubeChannelInfo: async (channelId, apiKey) => ipcRenderer.invoke(CH.YOUTUBE_GET_CHANNEL_INFO, { channelId, apiKey }),
  
  // YouTube OAuth methods
  startYouTubeOAuth: (clientId, clientSecret) => 
    ipcRenderer.invoke('ipc-youtube-start-oauth', { clientId, clientSecret }),
  connectYouTubeLiveChat: (apiKey, channelId) => 
    ipcRenderer.invoke('ipc-youtube-connect-chat', { apiKey, channelId }),
  disconnectYouTubeLiveChat: () => 
    ipcRenderer.invoke('ipc-youtube-disconnect-chat'),
  isYouTubeAuthenticated: () => 
    ipcRenderer.invoke('ipc-youtube-is-authenticated'),
  logoutYouTube: () => 
    ipcRenderer.invoke('ipc-youtube-logout'),
  
  // Discord Integration
  connectDiscord: async (token, channelId) => ipcRenderer.invoke(CH.DISCORD_CONNECT, { token, channelId }),
  disconnectDiscord: async () => ipcRenderer.invoke(CH.DISCORD_DISCONNECT),
  onDiscordStatus: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.DISCORD_STATUS,h); return () => ipcRenderer.removeListener(CH.DISCORD_STATUS,h); },
  getDiscordHealth: async () => ipcRenderer.invoke(CH.DISCORD_HEALTH),
  validateDiscordToken: async (token) => ipcRenderer.invoke(CH.DISCORD_VALIDATE_TOKEN, token),
  getDiscordChannelInfo: async (channelId, token) => ipcRenderer.invoke(CH.DISCORD_GET_CHANNEL_INFO, { channelId, token }),
  sendDiscordMessage: async (message) => ipcRenderer.invoke(CH.DISCORD_SEND_MESSAGE, message),
  
  // Test function
  testYouTubeIPC: async () => ipcRenderer.invoke('test-youtube-ipc'),
  
  // Debug helper for logging to main process
  logToMain: (message, data) => ipcRenderer.send('debug-log', { message, data }),
  
  pickImageFile: async () => ipcRenderer.invoke(CH.PICK_IMAGE_FILE),
  getBossManifest: async () => ipcRenderer.invoke(CH.GET_BOSS_MANIFEST),
  refreshBossManifest: async () => ipcRenderer.invoke(CH.GET_BOSS_MANIFEST),
  onBossManifest: (cb) => { const h=(e,d)=>cb(d); ipcRenderer.on(CH.BOSS_MANIFEST,h); return () => ipcRenderer.removeListener(CH.BOSS_MANIFEST,h); },
  getTwitchHealth: async () => ipcRenderer.invoke(CH.TWITCH_HEALTH),
  saveWindowState: () => ipcRenderer.send(CH.PERSIST_WINDOW_STATE)
});
