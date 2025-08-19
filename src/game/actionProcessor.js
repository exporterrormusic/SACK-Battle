// src/game/actionProcessor.js
// Centralized action processing to eliminate duplication in gameState.js

(function(global) {
  'use strict';

  if (global.SackBattle && global.SackBattle.actionProcessor) return;

  // Ensure namespace exists
  if (!global.SackBattle) {
    global.SackBattle = {};
  }

  const actionProcessor = {
    // Process all player actions in priority order
    processActions(gameState, context = {}) {
      // Delegate to selective processor with all groups enabled
      return this.processActionsSelective(gameState, {
        isBossSpecial: context.isBossSpecial === true,
        processBurst: true,
        processStrike: true,
        processAttack: true,
        processHeal: true,
        processCover: true,
      });
    },

    // Process actions with fine-grained selection of groups
    processActionsSelective(gameState, options = {}) {
      if (!gameState || !gameState.players) return;

      const {
        isBossSpecial = false,
        processBurst = true,
        processStrike = true,
        processAttack = true,
        processHeal = true,
        processCover = true,
      } = options;

      const actions = global.SackBattle?.registries?.actions;
      if (!actions) {
        console.warn('[ActionProcessor] Actions registry not available');
        return;
      }

      // Collect actions by type
      const actionGroups = this.groupActionsByType(gameState.players);

      // Process in priority order: burst > strike > attack > heal > cover
      if (processBurst) this.processBurstActions(actionGroups.burst, gameState, isBossSpecial);
      if (processStrike) this.processStrikeActions(actionGroups.strike, gameState, isBossSpecial);
      if (processAttack) this.processAttackActions(actionGroups.attack, gameState, isBossSpecial);
      
      // Trigger multi-avatar animation after both strike and attack processing
      // BUT skip if any burst actions occurred (burst overrides multi-avatar animation)
      if ((processStrike || processAttack) && gameState.boss.hp > 0 && actionGroups.burst.length === 0) {
        this.triggerMultiAvatarAnimation(actionGroups, gameState);
      }
      
      if (processHeal) this.processHealActions(actionGroups.heal, gameState, isBossSpecial);
      if (processCover) this.processCoverActions(actionGroups.cover, gameState);
    },

    // Group players by their pending actions
    groupActionsByType(players) {
      const groups = {
        burst: [],
        strike: [],
        attack: [],
        heal: [],
        cover: []
      };

      Object.entries(players).forEach(([name, player]) => {
        if (player.hp <= 0 || !player.pendingAction) return;

        const actionType = this.normalizeActionType(player.pendingAction);
        if (groups[actionType]) {
          groups[actionType].push([name, player]);
        }
      });

      return groups;
    },

    // Normalize action names to standard types
    normalizeActionType(action) {
      const normalized = action.toLowerCase();
      if (normalized === 'aggressive') return 'strike';
      if (normalized === 'defend') return 'cover';
      return normalized;
    },

    // Process burst actions
    processBurstActions(burstPlayers, gameState, isBossSpecial) {
      burstPlayers.forEach(([name, player]) => {
        if (player.hp > 0 && gameState.boss.hp > 0) {
          const baseDamage = 10;
          const damage = this.calculateDamage(baseDamage, gameState.attackUpTurns);
          
          this.applyBossDamage(gameState, damage, `player-burst-${isBossSpecial ? 'special' : 'default'}-phase`);
          this.trackPlayerDamage(gameState, name, damage);
          
          player.burstGauge = 0; // Reset burst gauge
          this.triggerBurstEffects(player, name);
        }
        
        if (player.hp > 0) player.lastAction = 'burst';
        player.pendingAction = null;
      });
    },

  // Process strike actions (formerly 'aggressive')
    processStrikeActions(strikePlayers, gameState, isBossSpecial) {
      strikePlayers.forEach(([name, player]) => {
        if (player.hp > 0 && gameState.boss.hp > 0) {
          const baseDamage = 3;
          const damage = this.calculateDamage(baseDamage, gameState.attackUpTurns);
          
          this.applyBossDamage(gameState, damage, `player-strike-${isBossSpecial ? 'special' : 'default'}-phase`);
          this.trackPlayerDamage(gameState, name, damage);
          
          player.burstGauge = Math.min(5, player.burstGauge + 2); // Gain 2 burst gauge
          player.hp -= 1; // Self damage
          if (player.hp < 0) player.hp = 0;
        }
        
  // Keep legacy label for UI compatibility
  if (player.hp > 0) player.lastAction = 'aggressive';
        player.pendingAction = null;
      });
    },

    // Process attack actions
    processAttackActions(attackPlayers, gameState, isBossSpecial) {
      attackPlayers.forEach(([name, player]) => {
        if (player.hp > 0 && gameState.boss.hp > 0) {
          // Check if boss is covered - attacks do no damage
          if (gameState.boss.visualState !== 'covered') {
            const baseDamage = 1;
            const damage = this.calculateDamage(baseDamage, gameState.attackUpTurns);
            
            this.applyBossDamage(gameState, damage, `player-attack-${isBossSpecial ? 'special' : 'default'}-phase`);
            this.trackPlayerDamage(gameState, name, damage);
          }
          
          player.burstGauge = Math.min(5, player.burstGauge + 1); // Gain burst gauge
        }
        
        if (player.hp > 0) player.lastAction = 'attack';
        player.pendingAction = null;
      });
    },

    // Process heal actions
    processHealActions(healPlayers, gameState, isBossSpecial) {
      const shouldBlockHealing = isBossSpecial || gameState.boss.lastMove === 'attack';
      
      healPlayers.forEach(([name, player]) => {
        if (!shouldBlockHealing && player.hp > 0 && player.hp < 3) {
          player.hp += 1;
        }
        
        if (player.hp > 0) player.lastAction = 'heal';
        player.pendingAction = null;
      });
    },

    // Process cover actions
    processCoverActions(coverPlayers, gameState) {
      coverPlayers.forEach(([name, player]) => {
        if (player.hp > 0) player.lastAction = 'cover';
        // NOTE: DO NOT clear pendingAction here! 
        // It needs to stay as 'cover' for boss damage protection
        // It will be cleared in the cleanup phase after boss actions
      });
    },

    // Clean up pending actions after turn processing
    cleanupPendingActions(gameState) {
      Object.values(gameState.players).forEach(player => {
        if (player.pendingAction) {
          player.pendingAction = null;
        }
      });
    },

    // Calculate final damage with attack up multiplier
    calculateDamage(baseDamage, attackUpTurns) {
      return attackUpTurns > 0 ? baseDamage * 3 : baseDamage;
    },

    // Apply damage to boss with change tracking
    applyBossDamage(gameState, damage, context) {
      const oldHp = gameState.boss.hp;
      gameState.boss.hp -= damage;
      if (gameState.boss.hp < 0) gameState.boss.hp = 0;
      
      // Call the existing change tracking if available
      if (typeof window.noteBossHpChange === 'function') {
        window.noteBossHpChange(oldHp, gameState.boss.hp, context);
      }
    },

    // Track damage for individual players
    trackPlayerDamage(gameState, playerName, damage) {
      if (!gameState.playerDamageThisMatch) {
        gameState.playerDamageThisMatch = {};
      }
      gameState.playerDamageThisMatch[playerName] = 
        (gameState.playerDamageThisMatch[playerName] || 0) + damage;
    },

    // Trigger multi-avatar attack animation from both strike and attack players
    triggerMultiAvatarAnimation(actionGroups, gameState) {
      // Combine strike and attack players for animation
      const allAttackers = [...actionGroups.strike, ...actionGroups.attack];
      const eligible = allAttackers.filter(([name, player]) => player.hp > 0 && gameState.boss.hp > 0);
      
      console.log('[ActionProcessor] Eligible attackers (strike + attack):', eligible.length);
      console.log('[ActionProcessor] Strike players:', actionGroups.strike.length);
      console.log('[ActionProcessor] Attack players:', actionGroups.attack.length);
      
      // Prefer strike players (aggressive) first
      const strikePlayers = actionGroups.strike.filter(([name, player]) => player.hp > 0);
      let chosen = [];
      
      if (strikePlayers.length >= 3) {
        chosen = strikePlayers.sort(() => Math.random() - 0.5).slice(0, 3);
      } else {
        // Fill with attack players if not enough strikes
        const attackPlayers = actionGroups.attack.filter(([name, player]) => player.hp > 0);
        const combined = [...strikePlayers, ...attackPlayers];
        chosen = combined.sort(() => Math.random() - 0.5).slice(0, 3);
      }
      
      console.log('[ActionProcessor] Chosen for multi-attack:', chosen.length, chosen.map(([n]) => n));
      
      if (chosen.length > 0 && typeof window.animateMultiAttack === 'function') {
        // Prepare player info
        const multiAttackers = chosen.map(([name, player]) => {
          const avatarSrc = global.SackBattle?.utils?.assets ?
            global.SackBattle.utils.assets.getAvatarPath(player.avatar) :
            `app://assets/avatars/${player.avatar}`;
          return { name, avatarSrc, avatar: player.avatar };
        });
        console.log('[ActionProcessor] Calling animateMultiAttack with:', multiAttackers);
        window.animateMultiAttack(multiAttackers);
      } else {
        console.warn('[ActionProcessor] Cannot call animateMultiAttack:', {
          chosenLength: chosen.length,
          functionExists: typeof window.animateMultiAttack === 'function'
        });
      }
    },

    // Trigger burst visual and audio effects
    triggerBurstEffects(player, playerName) {
      // Visual effects
      setTimeout(() => {
        if (global.globalVictoryState) return; // Don't animate during victory/defeat
        
        if (global.flashBattlefield) {
          global.flashBattlefield('burst');
        }
        
        if (global.animateBurstAttack && player.avatar) {
          const avatarSrc = global.SackBattle?.utils?.assets ? 
            global.SackBattle.utils.assets.getAvatarPath(player.avatar) :
            `app://assets/avatars/${player.avatar}`;
          global.animateBurstAttack(playerName, avatarSrc);
        }
      }, 50);

      // Audio effects - let the visual queue system handle audio
      // The fx.js burst queue will play audio when the animation actually runs
      // this.playBurstAudio(player); // REMOVED: causing duplicate audio
    },

    // Play burst audio with proper volume handling and fallback
    playBurstAudio(player) {
      try {
        if (!player.avatar) return;

        // Extract folder name from avatar path
        const avatarFolder = player.avatar.split('/')[0];
        let burstPath = `app://assets/avatars/${avatarFolder}/burst.mp3`;

        const createAndPlayAudio = (path) => {
          // Prefer centralized audio helper for consistent volume
          if (global.SackBattle?.utils?.audio) {
            const a = global.SackBattle.utils.audio.createAudio(path, 'sfx', 0.8);
            return a.play().catch(() => {});
          } else {
            const audio = new Audio(path);
            if (global.__audioMixer) {
              audio.volume = global.__audioMixer.calculateCategoryVolume('sfx', 0.8);
            } else {
              audio.volume = 0.8;
            }
            return audio.play().catch(() => {});
          }
        };

        // First try to play the main path directly
        const mainAudio = new Audio(burstPath);
        if (global.__audioMixer) {
          mainAudio.volume = global.__audioMixer.calculateCategoryVolume('sfx', 0.8);
        } else {
          mainAudio.volume = 0.8;
        }

        let fallbackTriggered = false;

        // Set up fallback logic on error
        mainAudio.addEventListener('error', () => {
          if (fallbackTriggered) return; // Prevent multiple fallback attempts
          fallbackTriggered = true;
          
          console.log(`[BurstAudio] File not found: ${burstPath}, trying fallback`);
          
          // Try fallback to base character (remove prefixes like "summer", "winter", "tactical", etc.)
          let baseFolder = avatarFolder;
          const prefixes = ['summer', 'winter', 'tactical', 'maid', 'idol', 'over', 'spec'];
          
          for (const prefix of prefixes) {
            if (baseFolder.startsWith(prefix)) {
              baseFolder = baseFolder.substring(prefix.length);
              break;
            }
          }
          
          if (baseFolder !== avatarFolder) {
            const fallbackPath = `app://assets/avatars/${baseFolder}/burst.mp3`;
            console.log(`[BurstAudio] Trying fallback: ${fallbackPath}`);
            createAndPlayAudio(fallbackPath);
          } else {
            console.warn(`[BurstAudio] No fallback available for ${avatarFolder}`);
          }
        });

        // Play the main audio - don't use createAndPlayAudio to avoid duplication
        mainAudio.play().catch(() => {
          // Error event will handle fallback automatically
        });
      } catch (error) {
        console.warn('[ActionProcessor] Burst audio failed:', error);
      }
    }
  };

  global.SackBattle.actionProcessor = actionProcessor;

})(typeof window !== 'undefined' ? window : globalThis);
