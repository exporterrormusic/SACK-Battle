// src/game/gameStateMigration.js
// Utility to gradually migrate gameState.js to use the new action processor

(function(global) {
  'use strict';

  // Helper to integrate action processor with existing game state
  function integrateActionProcessor(gameState) {
  if (!global.SackBattle?.actionProcessor) {
      console.warn('[Migration] Action processor not available, skipping integration');
      return gameState;
    }

  const processor = global.SackBattle.actionProcessor;
    const originalProcessTurn = gameState.processTurn;

    // Wrap processTurn to use our action processor for player actions
    gameState.processTurn = function() {
      console.log('[Migration] Using enhanced processTurn with action processor');
      
      if (!gameState.state?.running) return;

      // Use original logic for auto-repeat and bot actions
      const state = gameState.state;
      
      // Auto-repeat actions for human players
      Object.entries(state.players).forEach(([name, p]) => { 
        if (!p.isBot && p.hp > 0 && !p.pendingAction && p.repeatAction) { 
          p.pendingAction = p.repeatAction; 
          p.lastAction = gameState.actionDisplayName?.(p.repeatAction) || p.repeatAction; 
        } 
      }); 
      
      // AI actions for bots
      Object.entries(state.players).forEach(([name, p]) => { 
        if (p.isBot && p.hp > 0) { 
          if (!p.pendingAction) { 
            p.pendingAction = gameState.botChooseAction?.(p) || 'attack'; 
            p.lastAction = gameState.actionDisplayName?.(p.pendingAction) || p.pendingAction; 
            console.log(`[BotAction][Migration] Bot ${name} chose action: ${p.pendingAction}`);
          } 
        } 
      }); 

      // Determine boss action (keep original logic)
      let action = state.manualBossAction; 
      if (!action) { 
        if (state.bossActionQueue.length) { 
          action = state.bossActionQueue.shift(); 
          console.log('[Migration] Using queued boss action:', action, 'remaining queue:', state.bossActionQueue);
        } else { 
          // Use boss registry if available
          if (global.SackBattle?.registries?.bossMoves) {
            const bossMoves = global.SackBattle.registries.bossMoves;
            const move = bossMoves.selectRandomMove();
            action = move ? move.id : null;
            console.log('[Migration] Selected random boss action:', action);
          } else {
            // Fallback to original probability logic
            const p = gameState.settings?.bossProbabilities || { growl: 0.15, attack: 0.45, cover: 0.15, charge: 0.25 };
            const rand = Math.random(); 
            if (rand < p.growl) action = 'growl'; 
            else if (rand < p.growl + p.attack) action = 'attack'; 
            else if (rand < p.growl + p.attack + p.cover) action = 'cover'; 
            else action = 'charge'; 
            console.log('[Migration] Selected probability-based boss action:', action);
          }
          
          // Set up action queue for charge actions
          if (action === 'charge') { 
            state.bossActionQueue = ['special', 'cooldown']; 
            console.log('[Migration] Auto-selected charge action, setting queue:', state.bossActionQueue);
          }
        } 
      } else { 
        console.log('[Migration] Using manual boss action:', action);
        if (action === 'charge') { 
          state.bossActionQueue = ['special', 'cooldown']; 
          console.log('[Migration] Charge action, setting queue:', state.bossActionQueue);
        } 
      } 
      
      state.manualBossAction = null; 
      state.pendingBossAction = action; 
      
      if (action === 'charge') { 
        state.boss.visualState = 'charging'; 
        gameState.emitUpdate?.(); 
      }

    // Use action processor for player actions
      setTimeout(() => {
        try {
      // Process actions directly on the game state using the centralized processor
      processor.processActions(state, { isBossSpecial: action === 'special' });

          // Apply boss action
          if (gameState.applyBossAction) {
            console.log('[Migration] Applying boss action:', action);
            gameState.applyBossAction(action);
            console.log('[Migration] Boss action applied, current visual state:', state.boss.visualState);
          } else {
            console.warn('[Migration] applyBossAction not available on gameState');
          }

          // Handle visual state updates for all boss actions
          if (action === 'special') {
            state.boss.visualState = 'exhausted';
            console.log('[Migration] Setting visual state to exhausted after special action');
            gameState.emitUpdate?.();
          } else if (action === 'cooldown') {
            state.boss.visualState = 'cooldown';
            console.log('[Migration] Setting visual state to cooldown after cooldown action');
            gameState.emitUpdate?.();
          } else if (['attack', 'growl', 'cover'].includes(action)) {
            // Clear visual state for regular actions
            state.boss.visualState = null;
            gameState.emitUpdate?.();
          }

      // Audio and visual effects are handled inside the processor and existing UI systems

        } catch (error) {
          console.error('[Migration] Action processor failed, falling back to original logic:', error);
          // Fall back to original processTurn implementation
          originalProcessTurn.call(this);
        }
      }, 100);
    };

    return gameState;
  }

  // Export integration function
  if (!global.SackBattle) global.SackBattle = {};
  if (!global.SackBattle.game) global.SackBattle.game = {};
  
  global.SackBattle.game.migration = {
    integrateActionProcessor
  };

})(typeof window !== 'undefined' ? window : globalThis);
