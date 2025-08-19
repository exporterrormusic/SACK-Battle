// src/renderer/settings.js
// Settings & persistence module extracted from renderer.js
(function(global){
  const api = {};
  const electronAPI = global.electronAPI;
  // ---- Settings schema versioning ----
  const CURRENT_SETTINGS_VERSION = 1;
  function migrateSettings(raw){
    if (!raw || typeof raw !== 'object') raw = {};
    const v = typeof raw.settingsVersion === 'number' ? raw.settingsVersion : 0;
    let out = { ...raw };
    // v0 -> v1 migrations
    if (v < 1) {
      // Ensure chatCommands object & defaults
      const cc = out.chatCommands || {};
      
      // Check if we already have new platform-specific structure
      if (cc.twitch || cc.youtube || cc.discord) {
        // Already migrated to platform-specific structure, preserve it
        console.log('[SettingsSchema] Found platform-specific chatCommands, preserving structure');
        out.chatCommands = {
          twitch: cc.twitch || {
            attack: '!attack',
            cover: '!cover', 
            heal: '!heal',
            aggressive: '!strike',
            burst: '!burst',
            avatar: '!avatar'
          },
          youtube: cc.youtube || {
            attack: '!attack',
            cover: '!cover',
            heal: '!heal', 
            aggressive: '!aggressive',
            burst: '!burst',
            avatar: '!avatar'
          },
          discord: cc.discord || {
            attack: '!attack',
            cover: '!cover',
            heal: '!heal',
            aggressive: '!strike', 
            burst: '!burst',
            avatar: '!avatar'
          }
        };
      } else {
        // Legacy flat structure - migrate to platform-specific
        console.log('[SettingsSchema] Migrating flat chatCommands to platform-specific structure');
        const flatCommands = {
          attack: (cc.attack || '!attack').toLowerCase(),
          cover: (cc.cover || '!cover').toLowerCase(),
          heal: (cc.heal || '!heal').toLowerCase(),
          aggressive: (cc.aggressive || cc.strike || '!strike').toLowerCase(),
          burst: (cc.burst || '!burst').toLowerCase(),
          avatar: (cc.avatar || '!avatar').toLowerCase()
        };
        
        // Create platform-specific structure with same commands for all platforms
        out.chatCommands = {
          twitch: { ...flatCommands },
          youtube: { 
            ...flatCommands,
            aggressive: '!aggressive' // YouTube uses different default for aggressive
          },
          discord: { ...flatCommands }
        };
      }
      // Ensure arrays exist
      if (!Array.isArray(out.rankDefinitions)) out.rankDefinitions = [];
      if (!Array.isArray(out.channelPointTriggers)) out.channelPointTriggers = [];
      if (!Array.isArray(out.bitsThresholds)) out.bitsThresholds = [];
      if (!Array.isArray(out.superchatThresholds)) out.superchatThresholds = [];
      // Coerce numeric fields
      if (out.turnLength != null) out.turnLength = Math.max(5, parseInt(out.turnLength,10)||30); else out.turnLength = 30;
      if (out.maxTurns != null) out.maxTurns = Math.max(1, parseInt(out.maxTurns,10)||6); else out.maxTurns = 6;
      if (out.maxMatches != null) out.maxMatches = Math.max(1, parseInt(out.maxMatches,10)||1); else out.maxMatches = 1;
      if (out.powerfulAttackDamage != null) out.powerfulAttackDamage = Math.max(1, parseInt(out.powerfulAttackDamage,10)||30); else out.powerfulAttackDamage = 30;
      // Normalize respawnMode
      if (!['cooldown','matchend'].includes(out.respawnMode)) out.respawnMode = 'cooldown';
      // Default redirect URI (user preferred exact form without trailing slash)
      if (!out.twitchRedirectUri) out.twitchRedirectUri = 'http://localhost';
      
      // Ensure boss probabilities include cover
      if (!out.bossProbabilities || typeof out.bossProbabilities !== 'object') {
        out.bossProbabilities = { growl: 0.15, attack: 0.45, cover: 0.15, charge: 0.25 };
      } else {
        // Add cover if missing and rebalance if needed
        if (typeof out.bossProbabilities.cover === 'undefined') {
          // Old format without cover - rebalance
          const oldTotal = (out.bossProbabilities.growl || 0) + (out.bossProbabilities.attack || 0) + (out.bossProbabilities.charge || 0);
          if (oldTotal > 0) {
            // Reduce each by proportional amount to make room for cover
            const scaleFactor = 0.85; // Leave 15% for cover
            out.bossProbabilities = {
              growl: (out.bossProbabilities.growl || 0) * scaleFactor,
              attack: (out.bossProbabilities.attack || 0) * scaleFactor,
              cover: 0.15,
              charge: (out.bossProbabilities.charge || 0) * scaleFactor
            };
          } else {
            out.bossProbabilities = { growl: 0.15, attack: 0.45, cover: 0.15, charge: 0.25 };
          }
        }
      }
    }
    
    // Ensure audio settings exist with defaults (no normalization)
    if (!out.audioSettings) {
      out.audioSettings = {
        sfxVolume: 1.0,
        musicVolume: 1.0
      };
    } else {
      // Strip legacy normalization fields if present
      const { sfxVolume, musicVolume } = out.audioSettings;
      out.audioSettings = {
        sfxVolume: typeof sfxVolume === 'number' ? sfxVolume : 1.0,
        musicVolume: typeof musicVolume === 'number' ? musicVolume : 1.0
      };
    }
    
    // Ensure YouTube settings exist with defaults
    if (!out.youtubeApiKey) out.youtubeApiKey = '';
    if (!out.youtubeChannelId) out.youtubeChannelId = '';
    
    out.settingsVersion = CURRENT_SETTINGS_VERSION;

    // Validate & normalize via global settings schema if available
    try {
      const schemaApi = global.SackBattle && global.SackBattle.utils && global.SackBattle.utils.settings;
      if (schemaApi && typeof schemaApi.validateAndMigrate === 'function') {
        console.log('[SettingsSchema] Before validation - YouTube fields:', {
          youtubeApiKey: out.youtubeApiKey,
          youtubeChannelId: out.youtubeChannelId
        });
        console.log('[SettingsSchema] Before validation - youtubeApiKey exact value:', JSON.stringify(out.youtubeApiKey));
        console.log('[SettingsSchema] Before validation - youtubeChannelId exact value:', JSON.stringify(out.youtubeChannelId));
        const vm = schemaApi.validateAndMigrate(out);
        if (vm && vm.settings) {
          console.log('[SettingsSchema] After validation - YouTube fields:', {
            youtubeApiKey: vm.settings.youtubeApiKey,
            youtubeChannelId: vm.settings.youtubeChannelId
          });
          console.log('[SettingsSchema] After validation - youtubeApiKey exact value:', JSON.stringify(vm.settings.youtubeApiKey));
          console.log('[SettingsSchema] After validation - youtubeChannelId exact value:', JSON.stringify(vm.settings.youtubeChannelId));
          if (Array.isArray(vm.warnings) && vm.warnings.length) {
            console.warn('[SettingsSchema] warnings:', vm.warnings);
            console.warn('[SettingsSchema] warnings details:', vm.warnings.map((w, i) => `${i}: ${w}`));
          }
          if (Array.isArray(vm.errors) && vm.errors.length) console.warn('[SettingsSchema] errors:', vm.errors);
          out = { ...out, ...vm.settings };
        }
      }
    } catch (e) {
      console.warn('[SettingsSchema] validation failed, using local migration only', e);
    }
    return out;
  }
  function collectRewardTriggersFromDOM(){
    const rewardsListEl = document.getElementById('rewards-list');
    if (!rewardsListEl) return [];
    const rows = rewardsListEl.querySelectorAll('.trigger-row');
    const out=[]; rows.forEach(r=>{ const match=r.querySelector('input[data-field=match]')?.value.trim(); const key=r.querySelector('select[data-field=key]')?.value; const enabled=r.querySelector('input[data-field=enabled]')?.checked; if (match && key) out.push({ match, key, enabled }); });
    return out;
  }
  function collectSuperchatThresholdsFromDOM(){
    const superchatListEl = document.getElementById('superchats-list');
    if (!superchatListEl) return [];
    const rows = superchatListEl.querySelectorAll('.trigger-row'); 
    const out=[]; 
    rows.forEach(r=>{ 
      const minAmount=parseFloat(r.querySelector('input[data-field=minAmount]')?.value)||0.01; 
      const key=r.querySelector('select[data-field=key]')?.value; 
      const enabled=r.querySelector('input[data-field=enabled]')?.checked; 
      if (key) out.push({ minAmount, key, enabled }); 
    }); 
    return out.sort((a,b)=>a.minAmount-b.minAmount);
  }
  function collectBitsThresholdsFromDOM(){
  const bitsListEl = document.getElementById('bits-thresholds-list');
    if (!bitsListEl) return [];
    const rows = bitsListEl.querySelectorAll('.trigger-row'); 
    const out=[]; 
    rows.forEach(r=>{ 
      const minBits=parseInt(r.querySelector('input[data-field=minBits]')?.value)||1; 
      const key=r.querySelector('select[data-field=key]')?.value; 
      const enabled=r.querySelector('input[data-field=enabled]')?.checked; 
      if (key) out.push({ minBits, key, enabled }); 
    }); 
    return out.sort((a,b)=>a.minBits-b.minBits);
  }
  async function loadPersisted(Game){
    console.log('[Settings] loadPersisted called');
    try {
      if (electronAPI?.loadSettings){
        const persisted = await electronAPI.loadSettings();
        console.log('[Settings] Raw loaded settings:', persisted);
        if (persisted && typeof persisted === 'object') {
          const { _persistPlayers, _persistMeta, _persistRecords, ...rawSettings } = persisted;
          const migrated = migrateSettings(rawSettings);
          console.log('[Settings] Migrated settings:', migrated);
          Game.setSettings({ ...migrated });
          console.log('[Settings] Applied settings to Game state');
          try { if (global.__settings) global.__settings.data = { ...migrated }; } catch(_) {}
          // Sync boss probabilities to registries when available
          try {
            const regs = global.SackBattle && global.SackBattle.registries;
            if (regs && regs.bossMoves && migrated.bossProbabilities) {
              regs.bossMoves.setWeights({
                growl: migrated.bossProbabilities.growl,
                attack: migrated.bossProbabilities.attack,
                cover: migrated.bossProbabilities.cover,
                charge: migrated.bossProbabilities.charge
              });
            }
          } catch(_) {}
          if (_persistRecords && Game.importPlayerRecords) Game.importPlayerRecords(_persistRecords);
          if (_persistPlayers && Game.importPlayers) {
            // Patch: Ensure avatar property is restored for each player
            Object.keys(_persistPlayers).forEach(name => {
              const p = _persistPlayers[name];
              if (p && typeof p === 'object' && p.avatar) {
                _persistPlayers[name].avatar = p.avatar;
              }
            });
            Game.importPlayers(_persistPlayers);
          }
        }
      }
      // localStorage merge ONLY if file settings are missing/invalid
      try {
        const currentRespawnMode = Game.getState().settings.respawnMode;
        // Only use localStorage as fallback if current setting is invalid
        if (!currentRespawnMode || !['cooldown','matchend'].includes(currentRespawnMode)) {
          const lsRaw = localStorage.getItem('bb_settings');
          if (lsRaw) {
            const lsSettings = JSON.parse(lsRaw);
            if (lsSettings && typeof lsSettings === 'object') {
              if (lsSettings.respawnMode && ['cooldown','matchend'].includes(lsSettings.respawnMode)) {
                console.log('[Settings] Using localStorage fallback for respawnMode:', lsSettings.respawnMode);
                Game.setSettings({ respawnMode: lsSettings.respawnMode });
              }
            }
          }
        }
      } catch(_){}
    } catch(e){ console.warn('[Settings] load failed', e); }
  }
  function persist(Game){
    console.log('[Settings] persist called');
    if (!electronAPI?.saveSettings) return;
    const exportPlayers = Game.getState().players;
    const exportMeta = { };
    const exportRecords = Game.getPlayerRecords ? Game.getPlayerRecords() : {};
    Object.keys(exportRecords).forEach(k=>{ if (/^Bot\d+$/i.test(k)) delete exportRecords[k]; });
    const gsAll = Game.getState();
    console.log('[Settings] Current game state settings:', gsAll.settings);
    // Debug log for playerRecords persistence
    try {
      console.log('[Settings.persist] Saving playerRecords:', JSON.stringify(exportRecords));
    } catch(e) {}
    // Ensure current version tag before persisting
    const settingsToSave = { ...gsAll.settings, _persistPlayers: exportPlayers, _persistMeta: exportMeta, _persistRecords: exportRecords };
    
    // Apply migration to the settings that will be saved (preserves YouTube fields)
    const migratedSettings = migrateSettings(settingsToSave);
    
    console.log('[Settings] Saving settings to file:', migratedSettings);
  electronAPI.saveSettings(migratedSettings);
  try { if (global.__settings) global.__settings.data = { ...migratedSettings }; } catch(_) {}
    try { localStorage.setItem('bb_settings', JSON.stringify(migratedSettings)); } catch(_){ }
  }
  api.collectRewardTriggersFromDOM = collectRewardTriggersFromDOM;
  api.collectBitsThresholdsFromDOM = collectBitsThresholdsFromDOM;
  api.collectSuperchatThresholdsFromDOM = collectSuperchatThresholdsFromDOM;
  api.loadPersisted = loadPersisted;
  api.persist = persist;
  // Helper: apply boss probability updates from UI consistently
  api.applyBossProbabilities = function(prob){
    try {
      if (!prob) return;
      const regs = global.SackBattle && global.SackBattle.registries;
      if (regs && regs.bossMoves && typeof regs.bossMoves.setWeights === 'function') {
        regs.bossMoves.setWeights(prob);
      }
      if (global.Game && typeof global.Game.setSettings === 'function') {
        global.Game.setSettings({ bossProbabilities: prob });
      }
    } catch(e){ console.warn('[Settings] applyBossProbabilities failed', e); }
  };
  
  // YouTube-specific helpers
  api.getSettings = function() {
    return global.Game && global.Game.getState ? global.Game.getState().settings : {};
  };
  
  api.saveSettings = function(newSettings) {
    if (global.Game && global.Game.setSettings) {
      global.Game.setSettings(newSettings);
    }
  };
  
  global.__settings = api;
  global.__getSettings = api.getSettings;
  global.__saveSettings = api.saveSettings;
})(typeof window !== 'undefined' ? window : globalThis);
