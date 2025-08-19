// src/renderer/bootstrap.js
// Loads modular renderer pieces (all self-register as globals) before legacy renderer.js.
// Order matters: eventBus first.
(function(){
  // Ensure global is available in browser
  if (typeof global === 'undefined') {
    window.global = window;
  }
  
  // Scripts are loaded individually via <script> tags; ensure eventBus present.
  if (!window.__eventBus) { console.warn('[bootstrap] eventBus missing'); }
  window.__rendererModules = { dispose: [] };
  
  // Initialize state manager early
  if (window.StateManager) {
    window.__stateManager = new window.StateManager();
    console.log('[bootstrap] StateManager initialized');
  } else {
    console.warn('[bootstrap] StateManager not found');
  }
  
  // Initialize memory manager
  if (window.MemoryManager && !window.__memoryManager) {
    window.__memoryManager = new window.MemoryManager();
    console.log('[bootstrap] MemoryManager initialized');
  }
  
  // Initialize audio mixer
  if (window.AudioMixer && !window.__audioMixer) {
    window.__audioMixer = new window.AudioMixer();
    console.log('[bootstrap] AudioMixer initialized');
    console.error('[bootstrap] DEBUG: AudioMixer created successfully');
    
    // Try to load existing audio settings if available
    if (window.Game && window.Game.getState) {
      const state = window.Game.getState();
      if (state.settings && state.settings.audioSettings) {
        window.__audioMixer.updateAudioSettings(state.settings);
        console.log('[bootstrap] AudioMixer settings loaded from game state');
      }
    }
  }
  
  try {
    if (window.__initHealthWidget) {
      const d = window.__initHealthWidget(window.electronAPI);
      if (typeof d === 'function') window.__rendererModules.dispose.push(d);
    }
  } catch(e){ console.warn('[bootstrap] health init failed', e); }
  // Load persisted settings (moved from old renderer.js) before gameLoop attaches.
  async function loadPersistedOnce(){
    if (loadPersistedOnce._ran) return; loadPersistedOnce._ran = true;
    try {
      if (window.__settings && window.Game) {
        await window.__settings.loadPersisted(window.Game);
        const st = window.Game.getState();
        
        // Update AudioMixer with loaded settings
        if (window.__audioMixer && st.settings && st.settings.audioSettings) {
          window.__audioMixer.updateAudioSettings(st.settings);
          console.log('[bootstrap] AudioMixer settings updated from loaded persisted settings');
        }
        
        // Apply persisted battlefield selection early so playlist/battlefield reflect choice.
        if (st.settings && st.settings.battlefieldImage) {
          window.selectedBattlefield = st.settings.battlefieldImage;
        }
        // Boss image/name kept until playlist applies; we just store settings.

        // Auto-connect to Twitch if saved credentials are complete and user previously connected.
        try {
          if (!window.__autoConnectAttempted) {
            window.__autoConnectAttempted = true;
            const s = st.settings || {};
            const bot = s.twitchBotUsername && s.twitchBotUsername.trim();
            const token = s.twitchOauthToken && s.twitchOauthToken.trim();
            const channel = s.twitchChannel && s.twitchChannel.trim();
            const clientId = s.twitchClientId && s.twitchClientId.trim();
            // Heuristic: only auto-connect if all creds exist AND token scopes previously recorded (indicates a valid prior login)
            const hasScopes = Array.isArray(s.twitchTokenScopes) && s.twitchTokenScopes.length > 0;
            if (bot && token && channel && clientId && hasScopes) {
              const helper = document.getElementById('oauth-helper');
              if (helper && !helper.textContent.includes('Connecting')) helper.textContent = 'Auto-connecting to Twitch...';
              // Defer a tick so preload API is ready.
              setTimeout(()=>{
                try { window.electronAPI && window.electronAPI.connectTwitch && window.electronAPI.connectTwitch({ botUsername: bot, oauthToken: token, channel, clientId }); }
                catch(e){ console.warn('[bootstrap] auto-connect failed', e); }
              }, 250);
            }
          }
        } catch(e){ console.warn('[bootstrap] auto-connect logic error', e); }
      }
    } catch(err){ console.warn('[bootstrap] persisted settings load failed', err); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPersistedOnce);
  } else {
    loadPersistedOnce();
  }
})();
