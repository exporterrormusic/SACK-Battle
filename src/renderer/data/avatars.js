(function(global){
  // Listen for avatar change IPC event from TwitchService
  if (window.electronAPI && window.electronAPI.onTwitchAvatarChange) {
    // Use persistent handler for unlimited avatar changes
    window.electronAPI.onTwitchAvatarChange(({ username, requestedName }) => {
      console.log('[AvatarChange] Twitch IPC event received (avatars.js):', { username, requestedName });
      const ok = global.__changePlayerAvatar(username, requestedName);
      if (window.electronAPI && window.electronAPI.sendChatMessage) {
        if (ok) window.electronAPI.sendChatMessage({ text: `@${username} avatar changed to ${requestedName}!`, channel: window.Game?.getState()?.settings?.twitchChannel });
        else window.electronAPI.sendChatMessage({ text: `@${username} avatar '${requestedName}' not found.`, channel: window.Game?.getState()?.settings?.twitchChannel });
      }
    });
  }

  // Listen for avatar change IPC event from YouTubeService
  if (window.electronAPI && window.electronAPI.onYouTubeAvatarChange) {
    // Use persistent handler for unlimited avatar changes
    window.electronAPI.onYouTubeAvatarChange(({ username, requestedName }) => {
      console.log('[AvatarChange] YouTube IPC event received (avatars.js):', { username, requestedName });
      const ok = global.__changePlayerAvatar(username, requestedName);
      // Note: YouTube doesn't have a direct chat response mechanism like Twitch
      // The avatar change feedback would be handled through the YouTube Live Chat API if needed
      console.log(`[AvatarChange] YouTube user ${username} avatar change to ${requestedName}: ${ok ? 'success' : 'failed'}`);
    });
  }

  // Listen for avatar change IPC event from DiscordService
  if (window.electronAPI && window.electronAPI.onDiscordAvatarChange) {
    // Use persistent handler for unlimited avatar changes
    window.electronAPI.onDiscordAvatarChange(({ username, requestedName }) => {
      console.log('[AvatarChange] Discord IPC event received (avatars.js):', { username, requestedName });
      const ok = global.__changePlayerAvatar(username, requestedName);
      if (window.electronAPI && window.electronAPI.sendDiscordMessage) {
        if (ok) {
          window.electronAPI.sendDiscordMessage(`@${username} avatar changed to ${requestedName}!`);
        } else {
          window.electronAPI.sendDiscordMessage(`@${username} avatar '${requestedName}' not found.`);
        }
      }
    });
  }
})(typeof window!=='undefined'?window:globalThis);
// avatars.js - persistent avatar assignment mapping per player

(function(global){
  function ensure(state){
    const avail=global.__avatarsList||[];
    Object.entries(state.players||{}).forEach(([n,p])=>{
      // Only assign avatar if player is newly added (avatar is undefined)
      if (typeof p.avatar === 'undefined') {
        const playerRecords = (window.Game && window.Game.getState && window.Game.getState().playerRecords) ? window.Game.getState().playerRecords : {};
        const savedAvatar = playerRecords[n]?.avatar;
        if (typeof savedAvatar !== 'undefined' && savedAvatar !== null && savedAvatar !== '') {
          p.avatar = savedAvatar;
        } else if(avail.length){
          const chosen=avail[Math.floor(Math.random()*avail.length)];
          p.avatar=chosen;
        }
      }
    });
  }

  // Get available avatar names (folder names, lowercased)
  function getAvailableAvatarNames(){
    const files = global.__avatarsList || [];
    return files
      .map(f => {
        // Extract folder name from "foldername/foldername.png" format
        const parts = f.split('/');
        return parts.length > 1 ? parts[0] : f.replace(/\.png$/i, '');
      })
      .map(name => name.toLowerCase());
  }

  // Change a player's avatar if the name matches
  function changePlayerAvatar(username, requestedName){
    console.log('[AvatarChange][DEBUG] Requested:', { username, requestedName });
    const files = global.__avatarsList || [];
    console.log('[AvatarChange][DEBUG] Avatar list:', files);
    if (!username || !requestedName) {
      console.warn('[AvatarChange] Missing username or requestedName:', { username, requestedName });
      return false;
    }
    if (!Array.isArray(files) || files.length === 0) {
      console.warn('[AvatarChange] No avatar files loaded.');
      return false;
    }
    // Normalize requested name: lowercase, strip extension, trim, remove spaces
    const reqName = requestedName.toLowerCase().replace(/\.png$/i, '').replace(/\s+/g, '').trim();
    // Find matching file (flexible: partial match, ignore spaces)
    let match = null;
    for (const f of files) {
      // Extract folder name from "foldername/foldername.png" format
      const parts = f.split('/');
      const folderName = parts.length > 1 ? parts[0] : f.replace(/\.png$/i, '');
      const base = folderName.toLowerCase().replace(/\s+/g, '');
      console.log(`[AvatarChange][DEBUG] Comparing: requested='${reqName}' vs folder='${base}' (full path='${f}')`);
      if (base === reqName || base.startsWith(reqName) || base.includes(reqName)) {
        match = f;
        console.log(`[AvatarChange][DEBUG] MATCH FOUND: '${base}' for requested '${reqName}' -> '${f}'`);
        break;
      }
    }
    if (!match) {
      const availableFolders = files.map(f => {
        const parts = f.split('/');
        return parts.length > 1 ? parts[0] : f.replace(/\.png$/i, '');
      }).map(name => name.toLowerCase());
      console.warn(`[AvatarChange] Avatar '${requestedName}' not found in available avatars:`, availableFolders);
    }
    if (!match) {
      const availableFolders = files.map(f => {
        const parts = f.split('/');
        return parts.length > 1 ? parts[0] : f.replace(/\.png$/i, '');
      }).map(name => name.toLowerCase());
      console.warn(`[AvatarChange] Avatar '${requestedName}' not found in available avatars:`, availableFolders);
      return false;
    }
    const Game = global.Game;
    if (!Game || !Game.getState) {
      console.warn('[AvatarChange] Game or Game.getState not available.');
      return false;
    }
    const state = Game.getState();
    if (!state.players) {
      console.warn('[AvatarChange] No players found in state.');
      return false;
    }
    let playerKey = Object.keys(state.players).find(k => k.toLowerCase() === username.toLowerCase());
    if (!playerKey && window.lastTwitchLogin) {
      playerKey = Object.keys(state.players).find(k => k.toLowerCase() === window.lastTwitchLogin.toLowerCase());
    }
    if (!playerKey) {
      console.warn(`[AvatarChange] Player '${username}' not found in state.players (case-insensitive). Keys:`, Object.keys(state.players));
      return false;
    }
    // Always update avatar, log previous and new value, no lock
    const prevAvatar = state.players[playerKey].avatar;
    state.players[playerKey].avatar = match;
    // Persist avatar choice in playerRecords for future spawns and sessions
    if (Game._rawState && Game._rawState.playerRecords) {
      if (!Game._rawState.playerRecords[playerKey]) Game._rawState.playerRecords[playerKey] = {};
      Game._rawState.playerRecords[playerKey].avatar = match;
      console.log(`[AvatarChange][DEBUG] Set avatar in playerRecords for '${playerKey}':`, match);
      // Save updated playerRecords to settings, preserving all other fields
      if (window.electronAPI && window.electronAPI.loadSettings && window.electronAPI.saveSettings) {
        window.electronAPI.loadSettings().then(existing => {
          const merged = { ...(existing || {}), playerRecords: Game._rawState.playerRecords };
          window.electronAPI.saveSettings(merged);
        });
      }
    }
    if (Game._rawState && Game._rawState.players && Game._rawState.players[playerKey]) {
      Game._rawState.players[playerKey].avatar = match;
      console.log(`[AvatarChange][DEBUG] Set avatar on rawState for '${playerKey}':`, Game._rawState.players[playerKey]);
    }
    console.log(`[AvatarChange][DEBUG] Avatar for '${playerKey}' changed from '${prevAvatar}' to '${match}'.`);
    // Always call renderPlayers
    if (window.renderPlayers) {
      console.log('[AvatarChange][DEBUG] Calling renderPlayers with:', JSON.parse(JSON.stringify(state.players)));
      window.renderPlayers(state.players);
    }
    return true;
  }

  global.__ensureAvatarsAssigned = ensure;
  global.__getAvailableAvatarNames = getAvailableAvatarNames;
  global.__changePlayerAvatar = changePlayerAvatar;
})(typeof window!=='undefined'?window:globalThis);
