// src/renderer/settingsModal.js
console.log('[SettingsModal] ========== SETTINGS MODAL FILE LOADED ==========');
window.settingsModalLoaded = true; // Global flag for debugging
(function(){
  let lastSnapshot=null;
  function statusEl(){ return document.getElementById('settings-status'); }
  function ensureStatusEl(){ 
    let el=statusEl(); 
    if (!el){ 
      const footer=document.querySelector('#settings-modal .settings-footer') || document.getElementById('settings-modal'); 
      if (footer){ 
        el=document.createElement('div'); 
        el.id='settings-status'; 
        el.style.fontSize='0.6rem'; 
        el.style.opacity='0.7'; 
        el.style.marginLeft='8px'; 
        footer.appendChild(el);
      } 
    } 
    return el;
  }

  function showFeedback(msg, isError=false){ 
    const el=ensureStatusEl(); 
    if (el){ 
      el.textContent=msg; 
      el.style.color=isError?'#f88':'#8f8'; 
      setTimeout(()=>{ if (el.textContent===msg) el.textContent=''; }, 3000); 
    } 
  }

  const inputs = {
    sfxVolume: null,
    musicVolume: null,
  };

  function openSettings(){
    console.log('[SettingsModal] Opening settings modal');
    const modal=document.getElementById('settings-modal'); 
    if (!modal) {
      console.warn('[SettingsModal] Settings modal not found');
      return;
    }
    modal.classList.remove('hidden'); 
    modal.setAttribute('aria-hidden','false');

    try {
      const gs = window.Game ? window.Game.getState() : {};
      console.log('[SettingsModal] Loading settings from game state:', gs.settings);
      
      // Load audio settings (no normalization)
      if (gs.settings && gs.settings.audioSettings) {
        if (inputs.sfxVolume) inputs.sfxVolume.value = gs.settings.audioSettings.sfxVolume !== undefined ? gs.settings.audioSettings.sfxVolume : 0.8;
        if (inputs.musicVolume) inputs.musicVolume.value = gs.settings.audioSettings.musicVolume !== undefined ? gs.settings.audioSettings.musicVolume : 0.6;
      } else {
        // No audio settings exist, use defaults
        if (inputs.sfxVolume) inputs.sfxVolume.value = 0.8;
        if (inputs.musicVolume) inputs.musicVolume.value = 0.6;
      }

      // Load game settings
      if (gs.settings) {
        const maxTurnsInput = document.getElementById('input-max-turns');
        if (maxTurnsInput && typeof gs.settings.maxTurns === 'number') {
          maxTurnsInput.value = gs.settings.maxTurns;
        }

        const turnLengthInput = document.getElementById('input-turn-length');
        if (turnLengthInput && typeof gs.settings.turnLength === 'number') {
          turnLengthInput.value = gs.settings.turnLength;
        }

        const bossHpInput = document.getElementById('input-boss-hp');
        if (bossHpInput && typeof gs.settings.bossHp === 'number') {
          bossHpInput.value = gs.settings.bossHp;
        }

        const maxMatchesInput = document.getElementById('input-max-matches');
        if (maxMatchesInput) {
          if (typeof gs.settings.maxMatches === 'number') {
            maxMatchesInput.value = gs.settings.maxMatches;
          } else {
            maxMatchesInput.value = 1; // Default value
          }
        }

        const respawnModeSelect = document.getElementById('input-respawn-mode');
        if (respawnModeSelect && gs.settings.respawnMode) {
          respawnModeSelect.value = gs.settings.respawnMode;
        }

        const powerfulDamageInput = document.getElementById('input-powerful-damage');
        if (powerfulDamageInput && typeof gs.settings.powerfulAttackDamage === 'number') {
          powerfulDamageInput.value = gs.settings.powerfulAttackDamage;
        }

        // Boss probabilities
        if (gs.settings.bossProbabilities) {
          const probGrowl = document.getElementById('input-prob-growl');
          const probAttack = document.getElementById('input-prob-attack');
          const probCover = document.getElementById('input-prob-cover');
          const probCharge = document.getElementById('input-prob-charge');
          
          if (probGrowl) probGrowl.value = Math.round((gs.settings.bossProbabilities.growl || 0) * 100);
          if (probAttack) probAttack.value = Math.round((gs.settings.bossProbabilities.attack || 0) * 100);
          if (probCover) probCover.value = Math.round((gs.settings.bossProbabilities.cover || 0) * 100);
          if (probCharge) probCharge.value = Math.round((gs.settings.bossProbabilities.charge || 0) * 100);
        }

        // Chat commands - load all commands with fallback defaults
        // Handle migration from old flat structure to new platform-specific structure
        let chatCommands = gs.settings.chatCommands || {};
        
        console.log('[SettingsModal] Loading chatCommands from settings:', chatCommands);
        
        // If we have old flat structure, migrate it
        if (chatCommands.attack && !chatCommands.twitch && !chatCommands.youtube && !chatCommands.discord) {
          console.log('[SettingsModal] Migrating old chat commands structure');
          const oldCommands = { ...chatCommands };
          chatCommands = {
            twitch: { ...oldCommands },
            youtube: { ...oldCommands },
            discord: { ...oldCommands }
          };
          console.log('[SettingsModal] Migrated to:', chatCommands);
        }
        
        // Try new platform-specific structure first
        const cmdAttackTwitch = document.getElementById('cmd-attack-twitch');
        if (cmdAttackTwitch) {
          cmdAttackTwitch.value = (chatCommands.twitch && chatCommands.twitch.attack) || 
                                 (gs.settings.chatCommands && gs.settings.chatCommands.attack) || '!attack';
        }

        const cmdCoverTwitch = document.getElementById('cmd-cover-twitch');
        if (cmdCoverTwitch) {
          cmdCoverTwitch.value = (chatCommands.twitch && chatCommands.twitch.cover) || 
                                (gs.settings.chatCommands && gs.settings.chatCommands.cover) || '!cover';
        }

        const cmdHealTwitch = document.getElementById('cmd-heal-twitch');
        if (cmdHealTwitch) {
          cmdHealTwitch.value = (chatCommands.twitch && chatCommands.twitch.heal) || 
                               (gs.settings.chatCommands && gs.settings.chatCommands.heal) || '!heal';
        }

        const cmdAggressiveTwitch = document.getElementById('cmd-aggressive-twitch');
        if (cmdAggressiveTwitch) {
          cmdAggressiveTwitch.value = (chatCommands.twitch && chatCommands.twitch.aggressive) || 
                                     (gs.settings.chatCommands && gs.settings.chatCommands.aggressive) || '!strike';
        }

        const cmdBurstTwitch = document.getElementById('cmd-burst-twitch');
        if (cmdBurstTwitch) {
          cmdBurstTwitch.value = (chatCommands.twitch && chatCommands.twitch.burst) || 
                                (gs.settings.chatCommands && gs.settings.chatCommands.burst) || '!burst';
        }

        const cmdAvatarTwitch = document.getElementById('cmd-avatar-twitch');
        if (cmdAvatarTwitch) {
          cmdAvatarTwitch.value = (chatCommands.twitch && chatCommands.twitch.avatar) || 
                                 (gs.settings.chatCommands && gs.settings.chatCommands.avatar) || '!avatar';
        }

        // YouTube commands
        const cmdAttackYoutube = document.getElementById('cmd-attack-youtube');
        if (cmdAttackYoutube) {
          cmdAttackYoutube.value = (chatCommands.youtube && chatCommands.youtube.attack) || 
                                  (gs.settings.chatCommands && gs.settings.chatCommands.attack) || '!attack';
        }

        const cmdCoverYoutube = document.getElementById('cmd-cover-youtube');
        if (cmdCoverYoutube) {
          cmdCoverYoutube.value = (chatCommands.youtube && chatCommands.youtube.cover) || 
                                 (gs.settings.chatCommands && gs.settings.chatCommands.cover) || '!cover';
        }

        const cmdHealYoutube = document.getElementById('cmd-heal-youtube');
        if (cmdHealYoutube) {
          cmdHealYoutube.value = (chatCommands.youtube && chatCommands.youtube.heal) || 
                                (gs.settings.chatCommands && gs.settings.chatCommands.heal) || '!heal';
        }

        const cmdAggressiveYoutube = document.getElementById('cmd-aggressive-youtube');
        if (cmdAggressiveYoutube) {
          cmdAggressiveYoutube.value = (chatCommands.youtube && chatCommands.youtube.aggressive) || 
                                      (gs.settings.chatCommands && gs.settings.chatCommands.aggressive) || '!aggressive';
        }

        const cmdBurstYoutube = document.getElementById('cmd-burst-youtube');
        if (cmdBurstYoutube) {
          cmdBurstYoutube.value = (chatCommands.youtube && chatCommands.youtube.burst) || 
                                 (gs.settings.chatCommands && gs.settings.chatCommands.burst) || '!burst';
        }

        const cmdAvatarYoutube = document.getElementById('cmd-avatar-youtube');
        if (cmdAvatarYoutube) {
          cmdAvatarYoutube.value = (chatCommands.youtube && chatCommands.youtube.avatar) || 
                                  (gs.settings.chatCommands && gs.settings.chatCommands.avatar) || '!avatar';
        }

        // Discord commands
        const cmdAttackDiscord = document.getElementById('cmd-attack-discord');
        if (cmdAttackDiscord) {
          cmdAttackDiscord.value = (chatCommands.discord && chatCommands.discord.attack) || 
                                  (gs.settings.chatCommands && gs.settings.chatCommands.attack) || '!attack';
        }

        const cmdCoverDiscord = document.getElementById('cmd-cover-discord');
        if (cmdCoverDiscord) {
          cmdCoverDiscord.value = (chatCommands.discord && chatCommands.discord.cover) || 
                                 (gs.settings.chatCommands && gs.settings.chatCommands.cover) || '!cover';
        }

        const cmdHealDiscord = document.getElementById('cmd-heal-discord');
        if (cmdHealDiscord) {
          cmdHealDiscord.value = (chatCommands.discord && chatCommands.discord.heal) || 
                                (gs.settings.chatCommands && gs.settings.chatCommands.heal) || '!heal';
        }

        const cmdAggressiveDiscord = document.getElementById('cmd-aggressive-discord');
        if (cmdAggressiveDiscord) {
          cmdAggressiveDiscord.value = (chatCommands.discord && chatCommands.discord.aggressive) || 
                                      (gs.settings.chatCommands && gs.settings.chatCommands.aggressive) || '!strike';
        }

        const cmdBurstDiscord = document.getElementById('cmd-burst-discord');
        if (cmdBurstDiscord) {
          cmdBurstDiscord.value = (chatCommands.discord && chatCommands.discord.burst) || 
                                 (gs.settings.chatCommands && gs.settings.chatCommands.burst) || '!burst';
        }

        const cmdAvatarDiscord = document.getElementById('cmd-avatar-discord');
        if (cmdAvatarDiscord) {
          cmdAvatarDiscord.value = (chatCommands.discord && chatCommands.discord.avatar) || 
                                  (gs.settings.chatCommands && gs.settings.chatCommands.avatar) || '!avatar';
        }

        // Backward compatibility: Load old-style commands if they exist
        const cmdAttack = document.getElementById('cmd-attack');
        if (cmdAttack) {
          cmdAttack.value = (gs.settings.chatCommands && gs.settings.chatCommands.attack) || '!attack';
        }

        const cmdCover = document.getElementById('cmd-cover');
        if (cmdCover) {
          cmdCover.value = (gs.settings.chatCommands && gs.settings.chatCommands.cover) || '!cover';
        }

        const cmdHeal = document.getElementById('cmd-heal');
        if (cmdHeal) {
          cmdHeal.value = (gs.settings.chatCommands && gs.settings.chatCommands.heal) || '!heal';
        }

        const cmdAggressive = document.getElementById('cmd-aggressive');
        if (cmdAggressive) {
          cmdAggressive.value = (gs.settings.chatCommands && gs.settings.chatCommands.aggressive) || '!strike';
        }

        const cmdBurst = document.getElementById('cmd-burst');
        if (cmdBurst) {
          cmdBurst.value = (gs.settings.chatCommands && gs.settings.chatCommands.burst) || '!burst';
        }

        // Rules text
        const rulesText = document.getElementById('rules-text');
        if (rulesText && gs.settings.rules) {
          rulesText.value = gs.settings.rules;
        }

        // Load battlefield selection
        const battlefieldSelect = document.getElementById('input-battlefield-bg');
        if (battlefieldSelect && gs.settings.battlefieldImage) {
          battlefieldSelect.value = gs.settings.battlefieldImage;
        }

        // Load randomize battlefield checkbox
        const randCheckbox = document.getElementById('input-randomize-battlefield');
        if (randCheckbox) {
          try {
            randCheckbox.checked = !!(gs.settings && gs.settings.style && gs.settings.style.randomizeBattlefield);
          } catch(_) { randCheckbox.checked = false; }
        }

        // Load boss settings
        const bossNameInput = document.getElementById('input-boss-name');
        if (bossNameInput && gs.settings.bossName) {
          bossNameInput.value = gs.settings.bossName;
        }

        // Load Twitch settings
        const twitchChannelInput = document.getElementById('twitch-channel');
        if (twitchChannelInput && gs.settings.twitchChannel) {
          twitchChannelInput.value = gs.settings.twitchChannel;
        }

        const twitchClientIdInput = document.getElementById('input-twitch-client-id');
        if (twitchClientIdInput && gs.settings.twitchClientId) {
          twitchClientIdInput.value = gs.settings.twitchClientId;
        }

        const twitchClientSecretInput = document.getElementById('input-twitch-client-secret');
        if (twitchClientSecretInput && gs.settings.twitchClientSecret) {
          twitchClientSecretInput.value = gs.settings.twitchClientSecret;
        }

        const twitchBotUsernameInput = document.getElementById('twitch-bot-username');
        if (twitchBotUsernameInput && gs.settings.twitchBotUsername) {
          twitchBotUsernameInput.value = gs.settings.twitchBotUsername;
        }

        const twitchOauthTokenInput = document.getElementById('twitch-oauth-token');
        if (twitchOauthTokenInput && gs.settings.twitchOauthToken) {
          twitchOauthTokenInput.value = gs.settings.twitchOauthToken;
        }

        // Load YouTube settings - always set values, even if empty
        const youtubeApiKeyInput = document.getElementById('youtube-api-key');
        if (youtubeApiKeyInput) {
          youtubeApiKeyInput.value = gs.settings.youtubeApiKey || '';
          console.log('[SettingsModal] YouTube API Key loaded:', gs.settings.youtubeApiKey ? 'YES (length: ' + gs.settings.youtubeApiKey.length + ')' : 'NO (empty/undefined)');
        }

        const youtubeChannelIdInput = document.getElementById('youtube-channel-id');
        if (youtubeChannelIdInput) {
          youtubeChannelIdInput.value = gs.settings.youtubeChannelId || '';
          console.log('[SettingsModal] YouTube Channel ID loaded:', gs.settings.youtubeChannelId ? 'YES (length: ' + gs.settings.youtubeChannelId.length + ')' : 'NO (empty/undefined)');
        }

        // Load Discord settings - always set values, even if empty
        const discordBotTokenInput = document.getElementById('discord-bot-token');
        if (discordBotTokenInput) {
          discordBotTokenInput.value = gs.settings.discordBotToken || '';
          console.log('[SettingsModal] Discord Bot Token loaded:', gs.settings.discordBotToken ? 'YES (length: ' + gs.settings.discordBotToken.length + ')' : 'NO (empty/undefined)');
        }

        const discordChannelIdInput = document.getElementById('discord-channel-id');
        if (discordChannelIdInput) {
          discordChannelIdInput.value = gs.settings.discordChannelId || '';
          console.log('[SettingsModal] Discord Channel ID loaded:', gs.settings.discordChannelId ? 'YES (length: ' + gs.settings.discordChannelId.length + ')' : 'NO (empty/undefined)');
        }
      }

      // Populate ranks tab dynamically when settings modal opens
      if (window.populateRanksTab && typeof window.populateRanksTab === 'function') {
        window.populateRanksTab();
      }
      
      // Populate trigger sections with saved data when settings modal opens
      console.log('[SettingsModal] Loading trigger sections...');
      setTimeout(() => {
        if (window.renderRewardTriggers && typeof window.renderRewardTriggers === 'function') {
          console.log('[SettingsModal] Calling renderRewardTriggers...');
          try {
            window.renderRewardTriggers();
          } catch (e) {
            console.warn('[SettingsModal] Error in renderRewardTriggers:', e);
          }
        } else {
          console.warn('[SettingsModal] renderRewardTriggers not available');
        }
        if (window.renderBitsThresholds && typeof window.renderBitsThresholds === 'function') {
          console.log('[SettingsModal] Calling renderBitsThresholds...');
          try {
            window.renderBitsThresholds();
          } catch (e) {
            console.warn('[SettingsModal] Error in renderBitsThresholds:', e);
          }
        } else {
          console.warn('[SettingsModal] renderBitsThresholds not available');
        }
        if (window.renderSuperchatThresholds && typeof window.renderSuperchatThresholds === 'function') {
          console.log('[SettingsModal] Calling renderSuperchatThresholds...');
          try {
            window.renderSuperchatThresholds();
          } catch (e) {
            console.warn('[SettingsModal] Error in renderSuperchatThresholds:', e);
          }
        } else {
          console.warn('[SettingsModal] renderSuperchatThresholds not available');
        }
      }, 100);
      
      updateVolumeDisplay();
      console.log('[SettingsModal] Settings loaded successfully');
    } catch(err){ 
      console.warn('[SettingsModal] Open settings error', err); 
    }
  }

  function closeSettings(){ 
    console.log('[SettingsModal] Closing settings modal');
    const modal=document.getElementById('settings-modal'); 
    if (modal){ 
      modal.classList.add('hidden'); 
      modal.setAttribute('aria-hidden','true'); 
      if (window.ensurePrebattleOverlay) window.ensurePrebattleOverlay(); 
    } 
  }

  function saveSettings(){
    if (!window.Game) { 
      console.warn('[SettingsModal] Game not available during save attempt');
      showFeedback('Game not available', true); 
      return; 
    }
    
    console.log('[SettingsModal] Save attempt - Game state:', window.Game.getState());
    
    try {
      // Collect all settings from form inputs
      const newSettings = {};
      
      // Audio settings (simple per-category volumes only)
      newSettings.audioSettings = {
        sfxVolume: inputs.sfxVolume ? parseFloat(inputs.sfxVolume.value) : 1.0,
        musicVolume: inputs.musicVolume ? parseFloat(inputs.musicVolume.value) : 1.0,
      };

      // Game settings
      const maxTurnsInput = document.getElementById('input-max-turns');
      if (maxTurnsInput && maxTurnsInput.value !== '') {
        newSettings.maxTurns = parseInt(maxTurnsInput.value, 10);
      }

      const turnLengthInput = document.getElementById('input-turn-length');
      if (turnLengthInput && turnLengthInput.value !== '') {
        newSettings.turnLength = parseInt(turnLengthInput.value, 10);
      }

      const bossHpInput = document.getElementById('input-boss-hp');
      if (bossHpInput && bossHpInput.value !== '') {
        newSettings.bossHp = parseInt(bossHpInput.value, 10);
      }

      const maxMatchesInput = document.getElementById('input-max-matches');
      if (maxMatchesInput && maxMatchesInput.value !== '') {
        newSettings.maxMatches = parseInt(maxMatchesInput.value, 10);
      }

      const respawnModeSelect = document.getElementById('input-respawn-mode');
      if (respawnModeSelect && respawnModeSelect.value) {
        newSettings.respawnMode = respawnModeSelect.value;
      }

      const powerfulDamageInput = document.getElementById('input-powerful-damage');
      if (powerfulDamageInput && powerfulDamageInput.value !== '') {
        newSettings.powerfulAttackDamage = parseInt(powerfulDamageInput.value, 10);
      }

      // Boss probabilities
      const probGrowl = document.getElementById('input-prob-growl');
      const probAttack = document.getElementById('input-prob-attack');
      const probCover = document.getElementById('input-prob-cover');
      const probCharge = document.getElementById('input-prob-charge');
      
      if (probGrowl || probAttack || probCover || probCharge) {
        const growl = probGrowl ? (parseInt(probGrowl.value, 10) || 0) / 100 : 0;
        const attack = probAttack ? (parseInt(probAttack.value, 10) || 0) / 100 : 0;
        const cover = probCover ? (parseInt(probCover.value, 10) || 0) / 100 : 0;
        const charge = probCharge ? (parseInt(probCharge.value, 10) || 0) / 100 : 0;
        
        const total = growl + attack + cover + charge;
        
        // Check if total equals 100% (within small tolerance)
        if (Math.abs(total - 1.0) > 0.01) {
          const confirmed = confirm(
            `Boss move probabilities total ${Math.round(total * 100)}%, not 100%.\n\n` +
            `Click OK to ignore and use default probabilities (15% Growl, 45% Attack, 15% Cover, 25% Charge).\n` +
            `Click Cancel to go back and fix the percentages.`
          );
          
          if (!confirmed) {
            showFeedback('Probabilities must total 100%', true);
            return;
          }
          
          // Use default probabilities
          newSettings.bossProbabilities = { growl: 0.15, attack: 0.45, cover: 0.15, charge: 0.25 };
        } else {
          newSettings.bossProbabilities = { growl, attack, cover, charge };
        }
      }

      // Chat commands - platform specific structure
      newSettings.chatCommands = {
        twitch: {},
        youtube: {},
        discord: {}
      };
      
      // Migrate any old flat structure that might still exist
      const currentState = window.Game ? window.Game.getState() : {};
      const existingCommands = currentState.settings?.chatCommands || {};
      if (existingCommands.attack && !existingCommands.twitch) {
        console.log('[SettingsModal] Migrating old flat commands during save');
        // Copy old commands as defaults for all platforms
        ['twitch', 'youtube', 'discord'].forEach(platform => {
          newSettings.chatCommands[platform] = { ...existingCommands };
        });
      }
      
      // Twitch commands
      const cmdAttackTwitch = document.getElementById('cmd-attack-twitch');
      const cmdCoverTwitch = document.getElementById('cmd-cover-twitch');
      const cmdHealTwitch = document.getElementById('cmd-heal-twitch');
      const cmdAggressiveTwitch = document.getElementById('cmd-aggressive-twitch');
      const cmdBurstTwitch = document.getElementById('cmd-burst-twitch');
      const cmdAvatarTwitch = document.getElementById('cmd-avatar-twitch');
      
      if (cmdAttackTwitch) newSettings.chatCommands.twitch.attack = cmdAttackTwitch.value.trim() || '!attack';
      if (cmdCoverTwitch) newSettings.chatCommands.twitch.cover = cmdCoverTwitch.value.trim() || '!cover';
      if (cmdHealTwitch) newSettings.chatCommands.twitch.heal = cmdHealTwitch.value.trim() || '!heal';
      if (cmdAggressiveTwitch) newSettings.chatCommands.twitch.aggressive = cmdAggressiveTwitch.value.trim() || '!strike';
      if (cmdBurstTwitch) newSettings.chatCommands.twitch.burst = cmdBurstTwitch.value.trim() || '!burst';
      if (cmdAvatarTwitch) newSettings.chatCommands.twitch.avatar = cmdAvatarTwitch.value.trim() || '!avatar';
      
      // YouTube commands
      const cmdAttackYoutube = document.getElementById('cmd-attack-youtube');
      const cmdCoverYoutube = document.getElementById('cmd-cover-youtube');
      const cmdHealYoutube = document.getElementById('cmd-heal-youtube');
      const cmdAggressiveYoutube = document.getElementById('cmd-aggressive-youtube');
      const cmdBurstYoutube = document.getElementById('cmd-burst-youtube');
      const cmdAvatarYoutube = document.getElementById('cmd-avatar-youtube');
      
      if (cmdAttackYoutube) newSettings.chatCommands.youtube.attack = cmdAttackYoutube.value.trim() || '!attack';
      if (cmdCoverYoutube) newSettings.chatCommands.youtube.cover = cmdCoverYoutube.value.trim() || '!cover';
      if (cmdHealYoutube) newSettings.chatCommands.youtube.heal = cmdHealYoutube.value.trim() || '!heal';
      if (cmdAggressiveYoutube) newSettings.chatCommands.youtube.aggressive = cmdAggressiveYoutube.value.trim() || '!aggressive';
      if (cmdBurstYoutube) newSettings.chatCommands.youtube.burst = cmdBurstYoutube.value.trim() || '!burst';
      if (cmdAvatarYoutube) newSettings.chatCommands.youtube.avatar = cmdAvatarYoutube.value.trim() || '!avatar';
      
      // Discord commands
      const cmdAttackDiscord = document.getElementById('cmd-attack-discord');
      const cmdCoverDiscord = document.getElementById('cmd-cover-discord');
      const cmdHealDiscord = document.getElementById('cmd-heal-discord');
      const cmdAggressiveDiscord = document.getElementById('cmd-aggressive-discord');
      const cmdBurstDiscord = document.getElementById('cmd-burst-discord');
      const cmdAvatarDiscord = document.getElementById('cmd-avatar-discord');
      
      if (cmdAttackDiscord) newSettings.chatCommands.discord.attack = cmdAttackDiscord.value.trim() || '!attack';
      if (cmdCoverDiscord) newSettings.chatCommands.discord.cover = cmdCoverDiscord.value.trim() || '!cover';
      if (cmdHealDiscord) newSettings.chatCommands.discord.heal = cmdHealDiscord.value.trim() || '!heal';
      if (cmdAggressiveDiscord) newSettings.chatCommands.discord.aggressive = cmdAggressiveDiscord.value.trim() || '!strike';
      if (cmdBurstDiscord) newSettings.chatCommands.discord.burst = cmdBurstDiscord.value.trim() || '!burst';
      if (cmdAvatarDiscord) newSettings.chatCommands.discord.avatar = cmdAvatarDiscord.value.trim() || '!avatar';
      
      // Backward compatibility: if old style commands exist, use them as fallback
      const cmdAttack = document.getElementById('cmd-attack');
      const cmdCover = document.getElementById('cmd-cover');
      const cmdHeal = document.getElementById('cmd-heal');
      const cmdAggressive = document.getElementById('cmd-aggressive');
      const cmdBurst = document.getElementById('cmd-burst');
      const cmdAvatar = document.getElementById('cmd-avatar');
      
      if (cmdAttack && !cmdAttackTwitch) {
        newSettings.chatCommands.twitch.attack = cmdAttack.value.trim() || '!attack';
        newSettings.chatCommands.youtube.attack = cmdAttack.value.trim() || '!attack';
        newSettings.chatCommands.discord.attack = cmdAttack.value.trim() || '!attack';
      }
      if (cmdCover && !cmdCoverTwitch) {
        newSettings.chatCommands.twitch.cover = cmdCover.value.trim() || '!cover';
        newSettings.chatCommands.youtube.cover = cmdCover.value.trim() || '!cover';
        newSettings.chatCommands.discord.cover = cmdCover.value.trim() || '!cover';
      }
      if (cmdHeal && !cmdHealTwitch) {
        newSettings.chatCommands.twitch.heal = cmdHeal.value.trim() || '!heal';
        newSettings.chatCommands.youtube.heal = cmdHeal.value.trim() || '!heal';
        newSettings.chatCommands.discord.heal = cmdHeal.value.trim() || '!heal';
      }
      if (cmdAggressive && !cmdAggressiveTwitch) {
        newSettings.chatCommands.twitch.aggressive = cmdAggressive.value.trim() || '!strike';
        newSettings.chatCommands.youtube.aggressive = cmdAggressive.value.trim() || '!aggressive';
        newSettings.chatCommands.discord.aggressive = cmdAggressive.value.trim() || '!strike';
      }
      if (cmdBurst && !cmdBurstTwitch) {
        newSettings.chatCommands.twitch.burst = cmdBurst.value.trim() || '!burst';
        newSettings.chatCommands.youtube.burst = cmdBurst.value.trim() || '!burst';
        newSettings.chatCommands.discord.burst = cmdBurst.value.trim() || '!burst';
      }
      if (cmdAvatar && !cmdAvatarTwitch) {
        newSettings.chatCommands.twitch.avatar = cmdAvatar.value.trim() || '!avatar';
        newSettings.chatCommands.youtube.avatar = cmdAvatar.value.trim() || '!avatar';
        newSettings.chatCommands.discord.avatar = cmdAvatar.value.trim() || '!avatar';
      }
      
      console.log('[SettingsModal] Collected platform-specific chat commands:', newSettings.chatCommands);
      console.log('[SettingsModal] About to save settings:', {
        twitchCommands: newSettings.chatCommands.twitch,
        youtubeCommands: newSettings.chatCommands.youtube,
        discordCommands: newSettings.chatCommands.discord
      });

      // Rules text
      const rulesText = document.getElementById('rules-text');
      if (rulesText && rulesText.value.trim() !== '') {
        newSettings.rules = rulesText.value.trim();
      }

      // Rank definitions - collect from rank list inputs
      const rankList = document.getElementById('rank-list');
      if (rankList) {
        const rankDefinitions = [];
        const rankRows = rankList.querySelectorAll('div');
        rankRows.forEach(row => {
          const nameInput = row.querySelector('.rank-name-input');
          const winsInput = row.querySelector('.rank-wins-input');
          if (nameInput && winsInput) {
            const name = nameInput.value.trim();
            const wins = parseInt(winsInput.value, 10) || 0;
            if (name) {
              rankDefinitions.push({ name, wins });
            }
          }
        });
        if (rankDefinitions.length > 0) {
          newSettings.rankDefinitions = rankDefinitions;
          console.log('[SettingsModal] Collected rank definitions:', rankDefinitions);
        }
      }

      // Battlefield selection
      const battlefieldSelect = document.getElementById('input-battlefield-bg');
      if (battlefieldSelect && battlefieldSelect.value) {
        newSettings.battlefieldImage = battlefieldSelect.value;
        // Also update the global selected battlefield immediately
        window.selectedBattlefield = battlefieldSelect.value;
        if (window.updateBattlefield) {
          window.updateBattlefield(battlefieldSelect.value);
        }
      }

  // Randomize battlefield setting
  const randCheckboxSave = document.getElementById('input-randomize-battlefield');
  if (!newSettings.style) newSettings.style = {};
  newSettings.style.randomizeBattlefield = !!(randCheckboxSave && randCheckboxSave.checked);

      // Boss name and image
      const bossNameInput = document.getElementById('input-boss-name');
      if (bossNameInput && bossNameInput.value) {
        newSettings.bossName = bossNameInput.value;
      }

      // Twitch settings
      const twitchChannelInput = document.getElementById('twitch-channel');
      if (twitchChannelInput && twitchChannelInput.value) {
        newSettings.twitchChannel = twitchChannelInput.value;
      }

      const twitchClientIdInput = document.getElementById('input-twitch-client-id');
      if (twitchClientIdInput && twitchClientIdInput.value) {
        newSettings.twitchClientId = twitchClientIdInput.value;
      }

      const twitchClientSecretInput = document.getElementById('input-twitch-client-secret');
      if (twitchClientSecretInput && twitchClientSecretInput.value) {
        newSettings.twitchClientSecret = twitchClientSecretInput.value;
      }

      const twitchBotUsernameInput = document.getElementById('twitch-bot-username');
      if (twitchBotUsernameInput && twitchBotUsernameInput.value) {
        newSettings.twitchBotUsername = twitchBotUsernameInput.value;
      }

      const twitchOauthTokenInput = document.getElementById('twitch-oauth-token');
      if (twitchOauthTokenInput && twitchOauthTokenInput.value) {
        newSettings.twitchOauthToken = twitchOauthTokenInput.value;
      }

      // YouTube settings - always save, even if empty
      const youtubeApiKeyInput = document.getElementById('youtube-api-key');
      if (youtubeApiKeyInput) {
        newSettings.youtubeApiKey = youtubeApiKeyInput.value || '';
        console.log('[SettingsModal] YouTube API Key being saved:', newSettings.youtubeApiKey ? 'YES (length: ' + newSettings.youtubeApiKey.length + ')' : 'NO (empty)');
      }

      const youtubeChannelIdInput = document.getElementById('youtube-channel-id');
      if (youtubeChannelIdInput) {
        newSettings.youtubeChannelId = youtubeChannelIdInput.value || '';
        console.log('[SettingsModal] YouTube Channel ID being saved:', newSettings.youtubeChannelId ? 'YES (length: ' + newSettings.youtubeChannelId.length + ')' : 'NO (empty)');
      }

      // Discord settings - always save, even if empty
      const discordBotTokenInput = document.getElementById('discord-bot-token');
      if (discordBotTokenInput) {
        newSettings.discordBotToken = discordBotTokenInput.value || '';
        console.log('[SettingsModal] Discord Bot Token being saved:', newSettings.discordBotToken ? 'YES (length: ' + newSettings.discordBotToken.length + ')' : 'NO (empty)');
      }

      const discordChannelIdInput = document.getElementById('discord-channel-id');
      if (discordChannelIdInput) {
        newSettings.discordChannelId = discordChannelIdInput.value || '';
        console.log('[SettingsModal] Discord Channel ID being saved:', newSettings.discordChannelId ? 'YES (length: ' + newSettings.discordChannelId.length + ')' : 'NO (empty)');
      }

      console.log('[SettingsModal] Collected settings:', newSettings);

      // Collect trigger data from DOM
      try {
        if (window.__settings) {
          if (window.__settings.collectRewardTriggersFromDOM) {
            newSettings.channelPointTriggers = window.__settings.collectRewardTriggersFromDOM();
          }
          if (window.__settings.collectBitsThresholdsFromDOM) {
            newSettings.bitsThresholds = window.__settings.collectBitsThresholdsFromDOM();
          }
          if (window.__settings.collectSuperchatThresholdsFromDOM) {
            newSettings.superchatThresholds = window.__settings.collectSuperchatThresholdsFromDOM();
          }
        }
      } catch (e) {
        console.warn('[SettingsModal] Failed to collect trigger data:', e);
      }

      // If boss probabilities are present, apply via centralized helper to also sync registries
      try {
        if (newSettings.bossProbabilities && window.__settings && typeof window.__settings.applyBossProbabilities === 'function') {
          window.__settings.applyBossProbabilities(newSettings.bossProbabilities);
          // Avoid double-setting; remaining fields will be applied below
          delete newSettings.bossProbabilities;
        }
      } catch(_) {}

      // Update game state for remaining settings
      window.Game.setSettings(newSettings);
      
      // Update AudioMixer with new settings and apply to all playing tracks
      if (window.__audioMixer) {
        window.__audioMixer.updateAudioSettings(newSettings);
        console.log('[SettingsModal] AudioMixer settings updated');
      } else {
        console.warn('[SettingsModal] AudioMixer not available');
      }
      
      // Also update any traditional audio that might be playing
      if (window.updateAudioSettings) {
        window.updateAudioSettings(newSettings);
      }

  // Persist settings to disk
      if (window.__settings && window.Game) {
        console.log('[SettingsModal] About to persist settings:', newSettings);
        window.__settings.persist(window.Game);
        console.log('[SettingsModal] Settings persisted to disk');
      } else {
        console.warn('[SettingsModal] Cannot persist - missing __settings or Game:', {
          hasSettings: !!window.__settings,
          hasGame: !!window.Game
        });
      }

      // Apply randomize battlefield setting immediately via assets helper
      try {
        if (window.setRandomizeBattlefield) {
          const enabled = !!(newSettings.style && newSettings.style.randomizeBattlefield);
          window.setRandomizeBattlefield(enabled);
        }
      } catch(_) {}

      showFeedback('Settings saved');
      console.log('[SettingsModal] Settings saved successfully');
      
      // Close the modal after successful save
      setTimeout(() => {
        closeSettings();
      }, 500); // Small delay to show the "Settings saved" message
    } catch(err){ 
      console.warn('[SettingsModal] Save settings error', err); 
      showFeedback('Save failed', true);
    }
  }

  function updateVolumeDisplay() {
    const sfxVolumeSlider = document.getElementById('input-sfx-volume');
    const sfxVolumeDisplay = document.getElementById('sfx-volume-display');
    const musicVolumeSlider = document.getElementById('input-music-volume');
    const musicVolumeDisplay = document.getElementById('music-volume-display');

    if (sfxVolumeSlider && sfxVolumeDisplay) {
      sfxVolumeDisplay.textContent = Math.round(sfxVolumeSlider.value * 100) + '%';
    }
    if (musicVolumeSlider && musicVolumeDisplay) {
      musicVolumeDisplay.textContent = Math.round(musicVolumeSlider.value * 100) + '%';
    }

  // Normalization removed; nothing else to update here
  }

  function wireSettingsModal(){
    console.log('[SettingsModal] ========== WIRING SETTINGS MODAL ==========');
    console.log('[SettingsModal] Wiring settings modal');
    
    // Cache input elements
  inputs.sfxVolume = document.getElementById('input-sfx-volume');
  inputs.musicVolume = document.getElementById('input-music-volume');

    console.log('[SettingsModal] Found input elements:', {
      sfxVolume: !!inputs.sfxVolume,
      musicVolume: !!inputs.musicVolume,
  normalizeSfx: false,
  normalizeMusic: false
    });

    // Volume sliders with percentage display
    const sfxVolumeSlider = document.getElementById('input-sfx-volume');
    const sfxVolumeDisplay = document.getElementById('sfx-volume-display');
    const musicVolumeSlider = document.getElementById('input-music-volume');
    const musicVolumeDisplay = document.getElementById('music-volume-display');

    console.log('[SettingsModal] Audio controls found:', {
      sfxSlider: !!sfxVolumeSlider,
      sfxDisplay: !!sfxVolumeDisplay, 
      musicSlider: !!musicVolumeSlider,
      musicDisplay: !!musicVolumeDisplay,
      audioMixer: !!window.__audioMixer
    });

    // Initial volume display update
    updateVolumeDisplay();

    console.log('[SettingsModal] Checking for audio elements...');
    console.log('[SettingsModal] sfxVolumeSlider exists:', !!sfxVolumeSlider);
    console.log('[SettingsModal] window.__audioMixer exists:', !!window.__audioMixer);
    console.log('[SettingsModal] AudioMixer instance:', window.__audioMixer);
    
    // Wire volume slider events
    if (sfxVolumeSlider) {
      console.log('[SettingsModal] SFX volume slider found, attaching event listener');
      console.log('[SettingsModal] SFX slider current value:', sfxVolumeSlider.value);
      console.log('[SettingsModal] SFX slider element:', sfxVolumeSlider);
      
      sfxVolumeSlider.addEventListener('input', (event) => {
        console.log('[SettingsModal] *** SFX VOLUME SLIDER EVENT FIRED ***');
        console.log('[SettingsModal] SFX volume changed to:', sfxVolumeSlider.value);
        console.log('[SettingsModal] Event object:', event);
        updateVolumeDisplay();
        // Apply changes in real-time for immediate feedback
        if (window.__audioMixer) {
          window.__audioMixer.audioSettings.sfxVolume = parseFloat(sfxVolumeSlider.value);
          console.log('[SettingsModal] About to call updateAllTrackVolumes for SFX...');
          window.__audioMixer.updateAllTrackVolumes();
          
          // DIRECT BOSS AUDIO UPDATE - Target the specific audio objects used by this application
          let updatedCount = 0;
          console.log(`[SettingsModal] Starting direct boss SFX audio update...`);
          
          // Method 1: Update boss SFX audio objects directly (primary method)
          if (window.__audioModule && window.__audioModule.state && window.__audioModule.state.bossAudio && window.__audioModule.state.bossAudio.sfx) {
            const bossSfx = window.__audioModule.state.bossAudio.sfx;
            console.log('[SettingsModal] Found boss SFX objects:', Object.keys(bossSfx));
            
            Object.entries(bossSfx).forEach(([sfxType, audio]) => {
              if (audio && typeof audio.volume !== 'undefined') {
                const oldVolume = audio.volume;
                const newVolume = window.__audioMixer.calculateCategoryVolume('sfx', 0.8); // 0.8 is the default SFX volume from audio.js
                audio.volume = newVolume;
                console.log(`[SettingsModal] Updated boss SFX ${sfxType} volume: ${oldVolume} -> ${newVolume}`);
                updatedCount++;
              }
            });

            // Throttled preview play for immediate audible feedback
            try {
              if (!window.___sfxPreviewLast || Date.now() - window.___sfxPreviewLast > 600) {
                const pick = bossSfx.attack || bossSfx.growl || bossSfx.charge || bossSfx.special || bossSfx.victory || bossSfx.defeat;
                if (pick && typeof pick.currentTime !== 'undefined') {
                  pick.currentTime = 0;
                  pick.play().catch(()=>{});
                  window.___sfxPreviewLast = Date.now();
                  console.log('[SettingsModal] Played SFX preview clip');
                }
              }
            } catch(_) {}
          }

          // Update boss welcome voice clip if present
          try {
            if (window.__audioModule && window.__audioModule.state && window.__audioModule.state.bossWelcome && typeof window.__audioModule.state.bossWelcome.volume !== 'undefined') {
              const a = window.__audioModule.state.bossWelcome;
              const oldV = a.volume;
              const newV = window.__audioMixer.calculateCategoryVolume('sfx', 0.7);
              a.volume = newV;
              console.log(`[SettingsModal] Updated boss welcome volume: ${oldV} -> ${newV}`);
              // Optionally replay a tiny blip? We'll avoid forced playback here.
            }
          } catch(_) {}
          
          // Method 2: Fallback - Check alternative audio storage locations
          if (window.state && window.state.bossAudio && window.state.bossAudio.sfx) {
            console.log('[SettingsModal] Found fallback boss SFX objects:', Object.keys(window.state.bossAudio.sfx));
            Object.entries(window.state.bossAudio.sfx).forEach(([sfxType, audio]) => {
              if (audio && typeof audio.volume !== 'undefined') {
                const oldVolume = audio.volume;
                const newVolume = window.__audioMixer.calculateCategoryVolume('sfx', 0.8);
                audio.volume = newVolume;
                console.log(`[SettingsModal] Updated fallback boss SFX ${sfxType} volume: ${oldVolume} -> ${newVolume}`);
                updatedCount++;
              }
            });
          }
          
          // Method 3: DOM audio elements (traditional)
          const allAudioElements = document.querySelectorAll('audio');
          console.log(`[SettingsModal] Found ${allAudioElements.length} audio elements in DOM`);
          
          allAudioElements.forEach((audio, index) => {
            if (audio.src) {
              const src = audio.src || audio.currentSrc;
              const category = window.__audioMixer.categorizeAudio(src);
              if (category === 'sfx') {
                const oldVolume = audio.volume;
                const newVolume = window.__audioMixer.calculateCategoryVolume('sfx', 0.8);
                audio.volume = newVolume;
                console.log(`[SettingsModal] Updated DOM SFX audio ${index}: ${oldVolume} -> ${newVolume}`);
                updatedCount++;
              }
            }
          });
          console.log(`[SettingsModal] Found ${allAudioElements.length} audio elements in DOM`);
          
          
          console.log(`[SettingsModal] SFX volume update complete. Updated ${updatedCount} audio sources.`);
          
        } else {
          console.warn('[SettingsModal] AudioMixer not available for SFX volume change');
        }
      });
      
  // Note: Removed automatic test dispatch that could trigger unintended SFX preview playback
      
    } else {
      console.error('[SettingsModal] SFX volume slider not found! Element with ID "input-sfx-volume" does not exist');
    }
    if (musicVolumeSlider) {
      musicVolumeSlider.addEventListener('input', () => {
        console.log('[SettingsModal] Music volume changed to:', musicVolumeSlider.value);
        updateVolumeDisplay();
        // Apply changes in real-time for immediate feedback
        if (window.__audioMixer) {
          window.__audioMixer.audioSettings.musicVolume = parseFloat(musicVolumeSlider.value);
          console.log('[SettingsModal] About to call updateAllTrackVolumes for Music...');
          window.__audioMixer.updateAllTrackVolumes();
          
          // Also update any currently playing waiting music directly
          if (window.setWaiting && window.setWaiting._waitingAudio && !window.setWaiting._waitingAudio.paused) {
            const newWaitingVolume = window.__audioMixer.calculateCategoryVolume('music');
            window.setWaiting._waitingAudio.volume = newWaitingVolume;
            console.log('[SettingsModal] Updated currently playing waiting music volume to:', newWaitingVolume);
          }
          
          console.log('[SettingsModal] Music volume applied via AudioMixer');
        } else {
          console.warn('[SettingsModal] AudioMixer not available for music volume change');
        }
      });
    }

  // Normalization controls removed

    // Boss probability controls
    const probInputs = {
      growl: document.getElementById('input-prob-growl'),
      attack: document.getElementById('input-prob-attack'),
      cover: document.getElementById('input-prob-cover'),
      charge: document.getElementById('input-prob-charge')
    };
    
    const probTotalDisplay = document.getElementById('prob-total-display');
    const probTotalValue = document.getElementById('prob-total-value');
    
    function updateProbabilityTotal() {
      const growl = parseInt(probInputs.growl?.value || 0);
      const attack = parseInt(probInputs.attack?.value || 0);
      const cover = parseInt(probInputs.cover?.value || 0);
      const charge = parseInt(probInputs.charge?.value || 0);
      const total = growl + attack + cover + charge;
      
      if (probTotalValue) probTotalValue.textContent = total;
      
      if (probTotalDisplay) {
        probTotalDisplay.classList.remove('valid', 'invalid');
        if (total === 100) {
          probTotalDisplay.classList.add('valid');
        } else {
          probTotalDisplay.classList.add('invalid');
        }
      }
    }
    
    // Add event listeners to probability inputs
    Object.values(probInputs).forEach(input => {
      if (input) {
        input.addEventListener('input', updateProbabilityTotal);
        input.addEventListener('change', updateProbabilityTotal);
      }
    });
    
    // Default probabilities storage
    let defaultProbabilities = { growl: 15, attack: 45, cover: 15, charge: 25 };
    
    // Save Default button
    const saveDefaultBtn = document.getElementById('btn-save-default-probs');
    if (saveDefaultBtn) {
      saveDefaultBtn.addEventListener('click', () => {
        const total = Object.values(probInputs).reduce((sum, input) => 
          sum + (parseInt(input?.value || 0)), 0);
        
        if (total !== 100) {
          showFeedback('Cannot save: probabilities must total 100%', true);
          return;
        }
        
        defaultProbabilities = {
          growl: parseInt(probInputs.growl?.value || 0),
          attack: parseInt(probInputs.attack?.value || 0),
          cover: parseInt(probInputs.cover?.value || 0),
          charge: parseInt(probInputs.charge?.value || 0)
        };
        
        showFeedback('Default probabilities saved');
      });
    }
    
    // Reset to Default button
    const resetDefaultBtn = document.getElementById('btn-reset-default-probs');
    if (resetDefaultBtn) {
      resetDefaultBtn.addEventListener('click', () => {
        if (probInputs.growl) probInputs.growl.value = defaultProbabilities.growl;
        if (probInputs.attack) probInputs.attack.value = defaultProbabilities.attack;
        if (probInputs.cover) probInputs.cover.value = defaultProbabilities.cover;
        if (probInputs.charge) probInputs.charge.value = defaultProbabilities.charge;
        updateProbabilityTotal();
      });
    }
    
    // Initial update
    updateProbabilityTotal();

    // Settings modal controls
    const openBtn=document.getElementById('btn-open-settings');
    const closeBtn=document.getElementById('settings-close');
    const saveBtn=document.getElementById('btn-settings-save');
    const cancelBtn=document.getElementById('btn-settings-cancel');
    
    console.log('[SettingsModal] Modal controls found:', {
      openBtn: !!openBtn,
      closeBtn: !!closeBtn,
      saveBtn: !!saveBtn,
      cancelBtn: !!cancelBtn
    });
    
    if (openBtn) openBtn.addEventListener('click', openSettings);
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
    if (cancelBtn) cancelBtn.addEventListener('click', closeSettings);

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('settings-modal');
        if (modal && !modal.classList.contains('hidden')) {
          closeSettings();
        }
      }
    });
    
    console.log('[SettingsModal] Settings modal wired successfully');
    
    // Wire YouTube tab if function exists
    if (typeof window.wireYouTubeTab === 'function') {
      console.log('[SettingsModal] Wiring YouTube tab');
      window.wireYouTubeTab();
    } else {
      console.warn('[SettingsModal] wireYouTubeTab function not found');
    }

    // Wire Discord tab if function exists
    if (typeof window.DiscordTab === 'object' && typeof window.DiscordTab.setupEventListeners === 'function') {
      console.log('[SettingsModal] Wiring Discord tab');
      window.DiscordTab.setupEventListeners();
    } else {
      console.warn('[SettingsModal] DiscordTab not found or setupEventListeners missing');
    }
  }

  // Export functions globally for backwards compatibility
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.saveSettings = saveSettings;
  
  console.log('[SettingsModal] About to check DOM readyState:', document.readyState);
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    console.log('[SettingsModal] DOM still loading, adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', wireSettingsModal);
  } else {
    console.log('[SettingsModal] DOM already ready, calling wireSettingsModal immediately');
    wireSettingsModal();
  }
})();

