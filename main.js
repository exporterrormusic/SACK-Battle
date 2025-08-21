const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
// Core modules
const { ipcChannels: CH, logger } = require('./src/core');

// Platform services
const { TwitchService, YouTubeService, DiscordService } = require('./src/platforms');
let twitchService = null;
let youtubeService = null;
let discordService = null;

// Backend server management
let backendServerProcess = null;

function startBackendServer() {
  const backendPath = path.join(__dirname, 'twitch-extension', 'backend');
  const packageJsonPath = path.join(backendPath, 'package.json');
  const nodeModulesPath = path.join(backendPath, 'node_modules');
  
  // Check if backend exists
  if (!fs.existsSync(packageJsonPath)) {
    console.log('[Backend] Backend server not found, skipping startup');
    return;
  }
  
  // Check if dependencies are installed
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('[Backend] Backend dependencies not installed, skipping startup');
    console.log('[Backend] Run "npm install" in twitch-extension/backend directory first');
    return;
  }
  
  console.log('[Backend] Starting Twitch Extension backend server...');
  
  // Read settings to get the extension secret
  let extensionSecret = 'RwPB2n9fjCijFazWu5XoMD6HJZOn4GDxf7GQ2/WgvwY='; // Your provided secret
  try {
    const settings = readSettingsFile();
    if (settings && settings.twitchExtension && settings.twitchExtension.secret) {
      extensionSecret = settings.twitchExtension.secret;
      console.log('[Backend] Using extension secret from settings');
    } else {
      console.log('[Backend] Using provided extension secret');
    }
  } catch (error) {
    console.warn('[Backend] Error reading settings for extension secret, using provided secret:', error);
  }
  
  // Set environment variables for the backend
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: '3000',
    GAME_SERVER_PORT: '3001',
    TWITCH_EXT_SECRET: extensionSecret
  };
  
  try {
    // Start the backend server
    backendServerProcess = spawn('node', ['server.js'], {
      cwd: backendPath,
      env: env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Log backend output
    backendServerProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.log('[Backend]', output);
    });
    
    backendServerProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.error('[Backend Error]', output);
    });
    
    backendServerProcess.on('close', (code) => {
      console.log('[Backend] Server exited with code:', code);
      backendServerProcess = null;
    });
    
    backendServerProcess.on('error', (err) => {
      console.error('[Backend] Failed to start server:', err.message);
      backendServerProcess = null;
    });
    
    console.log('[Backend] Server process started with PID:', backendServerProcess.pid);
    console.log('[Backend] Extension backend should be available at http://localhost:3000');
    console.log('[Backend] Game WebSocket server listening on port 3001');
  } catch (err) {
    console.error('[Backend] Error starting server:', err.message);
  }
}

function stopBackendServer() {
  if (backendServerProcess) {
    console.log('[Backend] Stopping server...');
    backendServerProcess.kill();
    backendServerProcess = null;
  }
}
function getMainWindow() {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    console.log('[MainProcess] getMainWindow: id=', win.id, 'title=', win.getTitle && win.getTitle());
  } else {
    console.log('[MainProcess] getMainWindow: no window found');
  }
  return win;
}
function ensureTwitchService() {
  if (!twitchService) {
    twitchService = new TwitchService({ pushDebug, getWindow: getMainWindow });
  }
  return twitchService;
}

function ensureYouTubeService() {
  if (!youtubeService) {
    youtubeService = new YouTubeService({
      onCommand: (commandData) => {
        const win = getMainWindow();
        if (win) {
          // Send YouTube command as chat message to renderer
          win.webContents.send(CH.TWITCH_CHAT, {
            username: commandData.username,
            displayName: commandData.username,
            message: `!${commandData.action}`,
            channel: 'youtube',
            source: commandData.source
          });
        }
      },
      onSuperchat: (superchatData) => {
        const win = getMainWindow();
        if (win) {
          // Send superchat as trigger event
          win.webContents.send(CH.TWITCH_TRIGGER, {
            type: 'youtube_superchat',
            key: superchatData.buffType,
            user: superchatData.username,
            amount: superchatData.amount,
            currency: superchatData.currency,
            message: superchatData.message,
            source: 'youtube'
          });
        }
      },
      onAvatarChange: (avatarData) => {
        const win = getMainWindow();
        if (win) {
          console.log('[MainProcess] Sending YOUTUBE_AVATAR_CHANGE:', { username: avatarData.username, requestedName: avatarData.requestedName });
          win.webContents.send(CH.YOUTUBE_AVATAR_CHANGE, { 
            username: avatarData.username, 
            requestedName: avatarData.requestedName 
          });
        }
      },
      onStatus: (status) => {
        const win = getMainWindow();
        if (win) {
          win.webContents.send(CH.YOUTUBE_STATUS, status);
        }
      },
      debug: pushDebug
    });
  }
  return youtubeService;
}

function ensureDiscordService() {
  if (!discordService) {
    discordService = new DiscordService({
      onCommand: (commandData) => {
        const win = getMainWindow();
        if (win) {
          console.log('[Main] Discord command received:', {
            username: commandData.username,
            action: commandData.action,
            originalMessage: commandData.message,
            source: commandData.source
          });
          
          // Send Discord command as chat message to renderer
          // Don't add ! prefix since Discord service already parsed the command
          win.webContents.send(CH.TWITCH_CHAT, {
            username: commandData.username,
            displayName: commandData.displayName,
            message: commandData.action, // Send just the action, not !action
            channel: 'discord',
            source: commandData.source
          });
          console.log('[Main] Sent Discord command to renderer:', {
            username: commandData.username,
            action: commandData.action,
            channel: 'discord',
            source: commandData.source
          });
        }
      },
      onMessage: (messageData) => {
        const win = getMainWindow();
        if (win) {
          // Send Discord message to chat (optional - for non-command messages)
          win.webContents.send(CH.TWITCH_CHAT, {
            username: messageData.username,
            displayName: messageData.displayName,
            message: messageData.message,
            channel: messageData.channel,
            source: messageData.source
          });
        }
      },
      onAvatarChange: (avatarData) => {
        const win = getMainWindow();
        if (win) {
          console.log('[MainProcess] Sending DISCORD_AVATAR_CHANGE:', { username: avatarData.username, requestedName: avatarData.requestedName });
          win.webContents.send(CH.TWITCH_AVATAR_CHANGE, { 
            username: avatarData.username, 
            requestedName: avatarData.requestedName 
          });
        }
      },
      onStatus: (status) => {
        const win = getMainWindow();
        if (win) {
          win.webContents.send(CH.DISCORD_STATUS, status);
        }
      },
      debug: pushDebug
    });
  }
  return discordService;
}
let oauthWindow = null;
let debugLogBuffer = [];
function pushDebug(scope, message, extra) {
  const entry = { ts: Date.now(), scope, message, ...(extra||{}) };
  debugLogBuffer.push(entry);
  if (debugLogBuffer.length > 500) debugLogBuffer.shift();
  try { BrowserWindow.getAllWindows().forEach(w => w.webContents.send(CH.TWITCH_DEBUG_LOG, entry)); } catch(_){ }
  logger.debug('twitch','debug_entry', entry);
}

// Extracted settings & window state helpers
const { readSettingsFile, writeSettingsFile } = require('./src/system/settings');

function migrateSettings(raw) {
  if (!raw || typeof raw !== 'object') raw = {};
  // Ensure arrays exist
  if (!Array.isArray(raw.channelPointTriggers)) raw.channelPointTriggers = [];
  if (!Array.isArray(raw.bitsThresholds)) raw.bitsThresholds = [];
  // Coerce numeric fields
  if (raw.turnLength != null) raw.turnLength = Math.max(5, parseInt(raw.turnLength,10)||30); else raw.turnLength = 30;
  if (raw.maxTurns != null) raw.maxTurns = Math.max(1, parseInt(raw.maxTurns,10)||6); else raw.maxTurns = 6;
  if (raw.powerfulAttackDamage != null) raw.powerfulAttackDamage = Math.max(1, parseInt(raw.powerfulAttackDamage,10)||30); else raw.powerfulAttackDamage = 30;
  // Normalize respawnMode
  if (!['cooldown','matchend'].includes(raw.respawnMode)) raw.respawnMode = 'cooldown';
  
  // Preserve YouTube settings (ensure they exist with defaults)
  if (raw.youtubeApiKey === undefined) raw.youtubeApiKey = '';
  if (raw.youtubeChannelId === undefined) raw.youtubeChannelId = '';
  if (raw.youtubeOAuthClientId === undefined) raw.youtubeOAuthClientId = '';
  if (raw.youtubeOAuthClientSecret === undefined) raw.youtubeOAuthClientSecret = '';
  if (raw.youtubeOAuthTokens === undefined) raw.youtubeOAuthTokens = null;
  
  // Preserve Discord settings (ensure they exist with defaults)
  if (!raw.discordBotToken) raw.discordBotToken = '';
  if (!raw.discordChannelId) raw.discordChannelId = '';
  
  return raw;
}
const { readWindowState, writeWindowState } = require('./src/system/windowState');

ipcMain.on(CH.PERSIST_WINDOW_STATE, () => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    const b = win.getBounds();
    writeWindowState({ width: b.width, height: b.height, x: b.x, y: b.y });
  } catch(_){ }
});

// Handler for debug logs from renderer process
ipcMain.on('main-log', (event, message) => {
  console.log('[RendererLog]', message);
});


function createWindow() {
  // Protocol now registered once in app.whenReady
  const persisted = readWindowState();
  const win = new BrowserWindow({
    width: persisted && persisted.width || 1280,
    height: persisted && persisted.height || 800,
    x: persisted && typeof persisted.x === 'number' ? persisted.x : undefined,
    y: persisted && typeof persisted.y === 'number' ? persisted.y : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  win.loadFile('index.html');
  // Uncomment below to open dev tools automatically:
  // win.webContents.openDevTools();

  // Legacy twitch.js removed; using dynamic UI-driven chat only.

  // Image file picker
  ipcMain.handle(CH.PICK_IMAGE_FILE, async () => {
    try {
      const res = await dialog.showOpenDialog(win, { properties:['openFile'], filters:[{ name:'Images', extensions:['png','jpg','jpeg','gif']}] });
      if (res.canceled || !res.filePaths || !res.filePaths.length) return null;
      return res.filePaths[0];
    } catch(e){ return null; }
  });

  // (Removed legacy twitch-init-pubsub; EventSub now created during twitch-connect via TwitchService)

  // Start watching asset folders for auto-refresh (extracted module)
  try { require('./src/system/assetWatchers').startAssetWatchers(win); } catch(e) { console.warn('Asset watch failed', e); }

  // Persist size/position on close
  win.on('close', () => {
    try {
      const b = win.getBounds();
      writeWindowState({ width: b.width, height: b.height, x: b.x, y: b.y });
    } catch(_){ }
  });
}

// (Removed duplicate helixGetUser / helixGetSelf definitions; now sourced from src/twitch)

// (Removed legacy persist/forget Twitch creds helpers – handled in TwitchService)

// (Removed duplicate validateToken; imported above)

// Raw IRC + EventSub unified connection
ipcMain.handle(CH.TWITCH_CONNECT, async (event, creds) => {
  try {
    // Always migrate settings before connecting TwitchService
    let settings = readSettingsFile();
    settings = migrateSettings(settings);
    writeSettingsFile(settings);
    const service = ensureTwitchService();
    return await service.connect(creds);
  } catch (e) {
    event.sender.send(CH.TWITCH_CHAT_STATUS, { status: 'disconnected', reason: e.message });
    return false;
  }
});

// Global OAuth flow handler (registered early so renderer can call anytime)
ipcMain.handle(CH.TWITCH_OAUTH_FLOW, async (event, { clientId, scopes, redirectUri }) => {
  try {
    if (!clientId) throw new Error('Missing clientId');
    const scopeStr = (scopes && Array.isArray(scopes) ? scopes : ['channel:read:redemptions','bits:read','chat:read','chat:edit']).join(' ');
    // If caller supplied redirectUri use normalized variants; else default localhost pair
    let redirectCandidates;
    if (redirectUri) {
      const norm = redirectUri.trim();
      // Provide both with & without trailing slash if localhost-ish to improve success odds; if custom path keep as-is
      if (/^https?:\/\/[^\s]+$/.test(norm) && /localhost/i.test(norm)) {
        const withSlash = norm.endsWith('/') ? norm : norm + '/';
        const withoutSlash = withSlash.slice(0, -1);
        redirectCandidates = [withSlash, withoutSlash];
      } else {
        redirectCandidates = [norm];
      }
    } else {
      redirectCandidates = ['http://localhost/','http://localhost'];
    }
    let attemptIndex = 0;
    let closedByCode = false;
    const openAttempt = () => {
      if (attemptIndex >= redirectCandidates.length) return; // exhausted
      const redirectUri = redirectCandidates[attemptIndex];
      const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopeStr)}`;
      if (oauthWindow) { try { oauthWindow.close(); } catch(_){} oauthWindow=null; }
      oauthWindow = new BrowserWindow({
        width: 520, height: 720, title: 'Twitch Authorization',
        webPreferences: { nodeIntegration:false, contextIsolation:true }
      });
      const cleanup = () => { if (oauthWindow) { try { oauthWindow.close(); } catch(_){} oauthWindow=null; } };
      function checkUrl(url) {
        try {
          if (!url.startsWith(redirectUri)) return;
          const hashIndex = url.indexOf('#');
          if (hashIndex === -1) return;
          const frag = url.substring(hashIndex + 1);
          const params = new URLSearchParams(frag);
          const token = params.get('access_token');
          if (token) {
            closedByCode = true;
            event.sender.send(CH.TWITCH_OAUTH_TOKEN, { token, scopes: params.get('scope'), redirectUri });
            cleanup();
          }
        } catch(_){ }
      }
      oauthWindow.webContents.on('will-redirect', (e, url) => { checkUrl(url); });
      oauthWindow.webContents.on('did-navigate', (e, url) => { checkUrl(url); });
      oauthWindow.webContents.on('did-fail-load', (e, errorCode, errorDescription, validatedURL) => {
        // If first attempt fails (404 or similar), try next redirect variant automatically
        if (!closedByCode && attemptIndex < redirectCandidates.length - 1) {
          attemptIndex++; openAttempt();
        } else if (!closedByCode) {
          event.sender.send(CH.TWITCH_OAUTH_TOKEN, { error: 'OAuth window load failed: '+ errorDescription + ' ('+errorCode+')', redirectTried: redirectUri });
        }
      });
      oauthWindow.on('closed', () => { if (!closedByCode) { event.sender.send(CH.TWITCH_OAUTH_TOKEN, { error: 'OAuth window closed before authorization', redirectTried: redirectCandidates[attemptIndex] }); } oauthWindow=null; });
      oauthWindow.loadURL(authUrl).catch(err => {
        if (!closedByCode) event.sender.send(CH.TWITCH_OAUTH_TOKEN, { error: 'Failed to load auth URL: '+ String(err && err.message || err) });
      });
    };
    openAttempt();
    return true;
  } catch (e) {
    event.sender.send(CH.TWITCH_OAUTH_TOKEN, { error: e.message });
    return false;
  }
});


// IPC handler for getting asset lists dynamically
ipcMain.handle(CH.GET_ASSETS_LIST, async (event, folderName) => {
  try {
    // Sanitize folderName to prevent directory traversal attacks (basic check)
    if (!['avatars', 'boss', 'battlefield'].includes(folderName)) {
      throw new Error('Invalid folder requested');
    }

    const assetsPath = path.join(__dirname, 'src', 'assets', folderName);
    
    if (folderName === 'avatars') {
      // For avatars, look for subfolders containing PNG files
      const entries = await fs.promises.readdir(assetsPath, { withFileTypes: true });
      const avatarFolders = [];
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const folderPath = path.join(assetsPath, entry.name);
          try {
            const folderFiles = await fs.promises.readdir(folderPath);
            // Check if folder contains a PNG file with the same name as the folder
            const expectedPng = `${entry.name}.png`;
            if (folderFiles.includes(expectedPng)) {
              avatarFolders.push(`${entry.name}/${expectedPng}`);
            }
          } catch (err) {
            console.warn(`Failed to read avatar subfolder ${entry.name}:`, err);
          }
        }
      }
      return avatarFolders;
    } else {
      // For other folders, keep the original behavior
      const files = await fs.promises.readdir(assetsPath);
      // Filter for image files only
      const filteredFiles = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));
      return filteredFiles;
    }
  } catch (err) {
    console.error('Failed to list assets folder:', folderName, err);
    return [];
  }
});

// Provide boss manifest on demand
ipcMain.handle(CH.GET_BOSS_MANIFEST, async () => {
  return require('./src/system/bossManifest').buildBossManifest();
});

// Load settings
ipcMain.handle(CH.LOAD_SETTINGS, async () => {
  return readSettingsFile();
});

// Save settings
ipcMain.handle(CH.SAVE_SETTINGS, async (event, data) => {
  console.log('[MainDebug] SAVE_SETTINGS called with OAuth fields:', {
    hasOAuthClientId: data && typeof data.youtubeOAuthClientId !== 'undefined',
    hasOAuthClientSecret: data && typeof data.youtubeOAuthClientSecret !== 'undefined',
    hasOAuthTokens: data && typeof data.youtubeOAuthTokens !== 'undefined',
    clientIdValue: data?.youtubeOAuthClientId?.length || 0,
    clientSecretValue: data?.youtubeOAuthClientSecret?.length || 0
  });
  
  // For partial saves, we need to merge with existing settings
  const existingSettings = readSettingsFile();
  const mergedSettings = { ...existingSettings, ...(data || {}) };
  
  // Special handling for OAuth fields - preserve existing non-empty values if incoming values are empty
  if (existingSettings.youtubeOAuthClientId && (!data?.youtubeOAuthClientId || data.youtubeOAuthClientId.trim() === '')) {
    mergedSettings.youtubeOAuthClientId = existingSettings.youtubeOAuthClientId;
    console.log('[MainDebug] Preserved existing OAuth Client ID');
  }
  if (existingSettings.youtubeOAuthClientSecret && (!data?.youtubeOAuthClientSecret || data.youtubeOAuthClientSecret.trim() === '')) {
    mergedSettings.youtubeOAuthClientSecret = existingSettings.youtubeOAuthClientSecret;
    console.log('[MainDebug] Preserved existing OAuth Client Secret');
  }
  if (existingSettings.youtubeOAuthTokens && (!data?.youtubeOAuthTokens || data.youtubeOAuthTokens === null)) {
    mergedSettings.youtubeOAuthTokens = existingSettings.youtubeOAuthTokens;
    console.log('[MainDebug] Preserved existing OAuth Tokens');
  }
  
  console.log('[MainDebug] Final OAuth values:', {
    existingOAuthClientId: existingSettings.youtubeOAuthClientId?.length || 0,
    existingOAuthClientSecret: existingSettings.youtubeOAuthClientSecret?.length || 0,
    finalOAuthClientId: mergedSettings.youtubeOAuthClientId?.length || 0,
    finalOAuthClientSecret: mergedSettings.youtubeOAuthClientSecret?.length || 0
  });
  
  writeSettingsFile(mergedSettings);
  return true;
});

// Send chat message from renderer
ipcMain.handle(CH.TWITCH_SEND_CHAT, async (event, msg) => {
  try {
    if (!msg || !msg.text) return false;
    const targetChannel = (msg.channel || msg.forceChannel || msg._channel || msg.channelName || '').replace(/^#/,'');
    if (!twitchService) ensureTwitchService();
    return twitchService.sendChat({ text: msg.text, channel: targetChannel });
  } catch(e) {
    pushDebug('chat','send_error',{ error:String(e&&e.message||e) });
    return false;
  }
});

ipcMain.handle(CH.TWITCH_FORGET_CREDS, async () => { /* no-op */ return true; });
ipcMain.handle(CH.TWITCH_GET_DEBUG_LOG, async () => debugLogBuffer.slice(-300));
ipcMain.handle(CH.TWITCH_CLEAR_DEBUG_LOG, async () => { debugLogBuffer = []; return true; });

// YouTube IPC handlers
ipcMain.handle(CH.YOUTUBE_CONNECT, async (event, { apiKey, channelId }) => {
  try {
    const service = ensureYouTubeService();
    const result = await service.connect(channelId);
    service.apiKey = apiKey; // Store API key
    return result;
  } catch (e) {
    event.sender.send(CH.YOUTUBE_STATUS, { status: 'disconnected', reason: e.message });
    return false;
  }
});

ipcMain.handle(CH.YOUTUBE_DISCONNECT, async () => {
  if (youtubeService) {
    youtubeService.disconnect();
    youtubeService = null;
  }
  return true;
});

ipcMain.handle(CH.YOUTUBE_HEALTH, async () => {
  if (youtubeService) {
    return youtubeService.getHealth();
  }
  return { youtube: 'disconnected', liveChatId: null, isPolling: false };
});

ipcMain.handle(CH.YOUTUBE_VALIDATE_KEY, async (event, apiKey) => {
  console.log('[YouTube] API Key validation request:', { hasKey: !!apiKey, keyLength: apiKey?.length });
  try {
    const { validateApiKey } = require('./src/platforms/youtube/index');
    console.log('[YouTube] Calling validateApiKey...');
    const result = await validateApiKey(apiKey);
    console.log('[YouTube] validateApiKey result:', result);
    return { success: true, data: result };
  } catch (e) {
    console.error('[YouTube] API Key validation error:', e.message, e.stack);
    return { success: false, error: e.message };
  }
});

// Test handler to verify IPC is working
ipcMain.handle('test-youtube-ipc', async () => {
  console.log('[YouTube] Test IPC handler called successfully!');
  return 'IPC is working!';
});

ipcMain.handle(CH.YOUTUBE_GET_CHANNEL_INFO, async (event, { channelId, apiKey }) => {
  console.log('[YouTube] Channel info request:', { hasChannelId: !!channelId, hasApiKey: !!apiKey });
  try {
    const { getChannelInfo } = require('./src/platforms/youtube/index');
    console.log('[YouTube] Calling getChannelInfo...');
    const channelInfo = await getChannelInfo(apiKey, channelId);
    console.log('[YouTube] getChannelInfo result:', channelInfo);
    return channelInfo; // Return the result directly, don't double-wrap it
  } catch (e) {
    console.error('[YouTube] Channel info error:', e.message, e.stack);
    return { success: false, error: e.message };
  }
});

// YouTube OAuth handlers
ipcMain.handle('ipc-youtube-start-oauth', async (event, { clientId, clientSecret }) => {
  console.log('[YouTube] Starting OAuth flow...');
  try {
    const { startOAuthFlow } = require('./src/platforms/youtube/index');
    const result = await startOAuthFlow(clientId, clientSecret);
    console.log('[YouTube] OAuth result:', result);
    return result;
  } catch (error) {
    console.error('[YouTube] OAuth error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ipc-youtube-connect-chat', async (event, { apiKey, channelId }) => {
  console.log('[YouTube] Connecting to live chat...');
  try {
    const { connectToLiveChat } = require('./src/platforms/youtube/index');
    const result = await connectToLiveChat(apiKey, channelId);
    console.log('[YouTube] Chat connection result:', result);
    return result;
  } catch (error) {
    console.error('[YouTube] Chat connection error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ipc-youtube-disconnect-chat', async (event) => {
  console.log('[YouTube] Disconnecting from live chat...');
  try {
    const { disconnectFromLiveChat } = require('./src/platforms/youtube/index');
    const result = await disconnectFromLiveChat();
    console.log('[YouTube] Disconnect result:', result);
    return result;
  } catch (error) {
    console.error('[YouTube] Disconnect error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ipc-youtube-is-authenticated', async (event) => {
  try {
    const { isAuthenticated } = require('./src/platforms/youtube/index');
    return { success: true, authenticated: isAuthenticated() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ipc-youtube-logout', async (event) => {
  console.log('[YouTube] Logging out...');
  try {
    const { logout } = require('./src/platforms/youtube/index');
    const result = await logout();
    console.log('[YouTube] Logout result:', result);
    return result;
  } catch (error) {
    console.error('[YouTube] Logout error:', error);
    return { success: false, error: error.message };
  }
});

// Debug log handler to help with troubleshooting
ipcMain.on('debug-log', (event, { message, data }) => {
  console.log('[DEBUG-RENDERER]', message, data ? JSON.stringify(data) : '');
});

// Discord IPC handlers
ipcMain.handle(CH.DISCORD_CONNECT, async (event, { token, channelId }) => {
  try {
    const service = ensureDiscordService();
    service.token = token; // Store token
    const result = await service.connect(channelId);
    return result;
  } catch (e) {
    event.sender.send(CH.DISCORD_STATUS, { status: 'disconnected', reason: e.message });
    return false;
  }
});

ipcMain.handle(CH.DISCORD_DISCONNECT, async () => {
  if (discordService) {
    discordService.disconnect();
    discordService = null;
  }
  return true;
});

ipcMain.handle(CH.DISCORD_HEALTH, async () => {
  if (discordService) {
    return discordService.getHealth();
  }
  return { discord: 'disconnected', channelId: null, botUser: null };
});

ipcMain.handle(CH.DISCORD_VALIDATE_TOKEN, async (event, token) => {
  console.log('[Discord] Token validation request:', { hasToken: !!token, tokenLength: token?.length });
  try {
    const { validateBotToken } = require('./src/platforms/discord/index');
    console.log('[Discord] Calling validateBotToken...');
    const result = await validateBotToken(token);
    console.log('[Discord] validateBotToken result:', result);
    return result;
  } catch (e) {
    console.error('[Discord] Token validation error:', e.message, e.stack);
    return { error: e.message };
  }
});

ipcMain.handle(CH.DISCORD_GET_CHANNEL_INFO, async (event, { channelId, token }) => {
  console.log('[Discord] Channel info request:', { hasChannelId: !!channelId, hasToken: !!token });
  try {
    const { getChannelInfo } = require('./src/platforms/discord/index');
    console.log('[Discord] Calling getChannelInfo...');
    const channelInfo = await getChannelInfo(channelId, token);
    console.log('[Discord] getChannelInfo result:', channelInfo);
    return channelInfo;
  } catch (e) {
    console.error('[Discord] Channel info error:', e.message, e.stack);
    return { error: e.message };
  }
});

ipcMain.handle(CH.DISCORD_SEND_MESSAGE, async (event, message) => {
  try {
    if (!discordService) {
      return { error: 'Discord not connected' };
    }
    const result = await discordService.sendMessage(message);
    return { success: result };
  } catch (e) {
    console.error('[Discord] Send message error:', e.message, e.stack);
    return { error: e.message };
  }
});
// Health endpoint summarizing IRC & EventSub status
ipcMain.handle(CH.TWITCH_HEALTH, async () => {
  if (twitchService) return twitchService.getHealth();
  // Fallback to legacy health builder if service not yet used
  try {
    const { buildTwitchHealth } = require('./src/system/health');
    return buildTwitchHealth({ chatClientWrapper: null, eventSubClient: null });
  } catch(_) {
    return { chat: 'disconnected', eventSub: 'disconnected', scopes: [], expiresAt: 0 };
  }
});


app.whenReady().then(() => {
  // Register protocol once
  try {
    protocol.registerFileProtocol('app', (request, callback) => {
      // Strip query string from URL
      const url = request.url.substr(6).split('?')[0];
      
      // Security: Sanitize the URL to prevent directory traversal
      const sanitizedUrl = url.replace(/\.\./g, '').replace(/^assets\//, 'assets/');
      const assetPath = path.normalize(path.join(__dirname, 'src', sanitizedUrl));
      const base = path.normalize(path.join(__dirname, 'src', 'assets'));
      
      console.log('[ProtocolDebug] Requested URL:', request.url);
      console.log('[ProtocolDebug] Resolved assetPath:', assetPath);
      
      // Security: Ensure the resolved path is within the assets directory
      if (!assetPath.startsWith(base)) {
        console.warn('[ProtocolDebug] Path traversal attempt blocked:', assetPath);
        return callback({ error: -6 });
      }
      
  // Security: Check if file exists before serving
  if (!fs.existsSync(assetPath)) {
        console.warn('[ProtocolDebug] File not found:', assetPath);
        return callback({ error: -6 });
      }
      
      callback({ path: assetPath });
    });
  } catch(e) { console.warn('protocol register failed', e.message); }
  
  // Start the backend server
  startBackendServer();
  
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Stop the backend server when the app is closing
  stopBackendServer();
  
  if (process.platform !== 'darwin') app.quit();
});

// Graceful shutdown
app.on('before-quit', () => {
  stopBackendServer();
});

// Handle app termination
process.on('SIGTERM', () => {
  stopBackendServer();
  app.quit();
});

process.on('SIGINT', () => {
  stopBackendServer();
  app.quit();
});
