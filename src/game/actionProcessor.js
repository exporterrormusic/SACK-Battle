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
    },
  };

  global.SackBattle.actionProcessor = actionProcessor;

})(typeof window !== 'undefined' ? window : globalThis);
