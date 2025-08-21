// src/renderer/gameLoop.js
// Centralized Game.onUpdate subscription & per-tick UI orchestration.
// Depends on globals injected by prior scripts (game state + __gameLoopDeps + __gameBindings + audio helpers).

(function(global) {
  if (global.__gameLoop) return; // guard against double inclusion

  // Helper functions to break down complex logic
  function updateCountdownTimer(state) {
    try {
      const countdownTimer = document.getElementById('countdown-timer');
      if (!countdownTimer) return;
      
      if (state.running && !state.victoryState && state.secondsLeft >= 0) {
        countdownTimer.textContent = state.secondsLeft;
        countdownTimer.style.color = state.secondsLeft <= 5 ? '#ff4444' : '#ffc75f';
        countdownTimer.classList.toggle('flash', state.secondsLeft <= 5);
      } else {
        countdownTimer.textContent = '--';
        countdownTimer.style.color = '#ffc75f';
        countdownTimer.classList.remove('flash');
      }
    } catch (e) {
      console.warn('[GameLoop] Countdown timer update failed:', e);
    }
  }

  function cleanupGameOverlays(state) {
    if (!state.running || state.victoryState) return;
    
    try {
      const bossWrapper = document.getElementById('boss-image-wrapper');
      const ov = bossWrapper && bossWrapper.querySelector('.game-overlay:not(.prebattle)');
      if (ov) ov.remove();
      
      if (bossWrapper) {
        bossWrapper.classList.remove('boss-outcome-victory', 'boss-outcome-defeat');
      }
      
      const playersContainer = document.getElementById('players-container');
      // Only clear scoreboard if we're not in a victory state and there's no damage data
      if (!state.lastMatchDamage && !state.victoryState && playersContainer && playersContainer.querySelector('.scoreboard-head')) {
        playersContainer.innerHTML = '';
        
        // Reset game binding states
        if (global.__gameBindings) {
          if (global.__gameBindings.renderScoreboardIfNeeded) {
            global.__gameBindings.renderScoreboardIfNeeded._key = null;
          }
          if (global.__gameBindings.applyVictoryDefeatOverlay) {
            global.__gameBindings.applyVictoryDefeatOverlay._played = false;
            global.__gameBindings.applyVictoryDefeatOverlay._musicApplied = null;
            global.__gameBindings.applyVictoryDefeatOverlay._activeKind = null;
          }
        }
        global.__scoreboardActive = false;
      }
    } catch (e) {
      console.warn('[GameLoop] Cleanup overlays failed:', e);
    }
  }

  function handleBossActions(Game, deps, state) {
    if (!Game._prevBossMove) Game._prevBossMove = null;
    
    const lastMove = state.boss.lastMove;
    const bossVS = state.boss && state.boss.visualState;
    const roundNum = state.round || 0;
    const newTurn = (typeof Game._prevRound !== 'number') || roundNum !== Game._prevRound;
    const phaseAllowed = !(bossVS === 'cooldown' || bossVS === 'charging');
    
    if (phaseAllowed && lastMove && ['attack', 'growl', 'cover', 'special'].includes(lastMove)) {
      const changed = lastMove !== Game._prevBossMove;
      if (newTurn || changed) {
        if (!state.victoryState) {
          // Apply visual effects based on boss action
          if (lastMove === 'attack') {
            deps.flashBattlefield && deps.flashBattlefield('attack');
            deps.shakeHitPlayers && deps.shakeHitPlayers();
          } else if (lastMove === 'growl') {
            deps.flashBattlefield && deps.flashBattlefield('growl');
          } else if (lastMove === 'cover') {
            // No visual effects for cover, just audio
          } else if (lastMove === 'special') {
            deps.flashBattlefield && deps.flashBattlefield('special');
            deps.shakeHitPlayers && deps.shakeHitPlayers();
          }
          
          // Play boss sound effects
          if (global.playBossSfx) global.playBossSfx(lastMove);
        }
      }
    }
    
    Game._prevBossMove = lastMove;
    Game._prevRound = roundNum;
  }

  function updateStartButtonText(state) {
    try {
      const startBtn = document.getElementById('btn-start-game');
      if (startBtn) {
        if (state.victoryState || state.running) {
          startBtn.textContent = 'Next Game';
        } else {
          startBtn.textContent = 'Start Game';
        }
      }
    } catch (e) {
      console.warn('[GameLoop] Start button update failed:', e);
    }
  }

  function attemptInit() {
    const Game = global.Game;
    const deps = global.__gameLoopDeps;
    const stateManager = global.__stateManager;
    
    if (!Game || !Game.onUpdate || !deps || !stateManager) {
      return false;
    }
    
    // Register component-specific state watchers
    stateManager.subscribe('players', ['players'], (state, diff, updateType) => {
      if (updateType === 'full' || diff.players && Object.keys(diff.players).length > 0) {
        const playersContainer = document.getElementById('players-container');
        const scoreboardActive = !!(playersContainer && playersContainer.classList.contains('scoreboard-active')) || 
                                  !!(playersContainer && playersContainer.querySelector('.scoreboard-head')) ||
                                  global.__scoreboardActive ||
                                  state.victoryState;
        
        if (scoreboardActive) {
          // If scoreboard is active, refresh it to include new players instead of rendering player avatars
          deps.renderScoreboardIfNeeded && deps.renderScoreboardIfNeeded(true);
        } else {
          // Otherwise, render players normally
          deps.renderPlayers && deps.renderPlayers(state.players);
        }
      }
    });
    
    stateManager.subscribe('boss', ['boss'], (state, diff, updateType) => {
      if (updateType === 'full' || diff.boss && Object.keys(diff.boss).length > 0) {
        deps.updateBossUI && deps.updateBossUI(state.boss);
      }
    });
    
    stateManager.subscribe('timer', ['secondsLeft', 'running', 'victoryState'], (state, diff, updateType) => {
      updateCountdownTimer(state);
    });
    
    stateManager.subscribe('ui', ['running', 'victoryState', 'round', 'completedMatches'], (state, diff, updateType) => {
      deps.updateRoundMatchHeader && deps.updateRoundMatchHeader(state);
      updateStartButtonText(state);
      
      // Handle victory state changes
      if (diff.ui && diff.ui.victoryState) {
        try { 
          if (typeof global.applyVictoryDefeatOverlay === 'function') global.applyVictoryDefeatOverlay(); 
        } catch (_) { }
      }
    });
    
    stateManager.subscribe('buffs', ['players'], (state, diff, updateType) => {
      try { 
        deps.updateBuffIconTimers && deps.updateBuffIconTimers(); 
      } catch (_) { }
    });
    
    // Use optimized update function
    const onUpdate = buildOptimizedOnUpdate(Game, deps, stateManager);
    Game.onUpdate(onUpdate);
    global.__gameLoop = { dispose: () => {} };
    return true;
  }

  function buildOptimizedOnUpdate(Game, deps, stateManager) {
    return function onUpdate(state) {
      // Pre-battle handling
      if (state.running && !state.victoryState) {
        const bossWrapper = document.getElementById('boss-image-wrapper');
        const ov = bossWrapper && bossWrapper.querySelector('.game-overlay');
        if (ov) ov.remove();
        bossWrapper && bossWrapper.classList.remove('boss-outcome-victory', 'boss-outcome-defeat');
        const playersContainer = document.getElementById('players-container');
        if (playersContainer && playersContainer.classList.contains('scoreboard-active')) {
          playersContainer.classList.remove('scoreboard-active');
          playersContainer.innerHTML = '';
        }
      }

      try {
        if (!state) return;
        
        // Process state changes through the state manager
        stateManager.processUpdate(state);
        
        // Handle pre-battle display
        const bossOverlaySection = document.getElementById('boss-overlay');
        if (global.__prebattleActive && !state.running) {
          if (bossOverlaySection) bossOverlaySection.style.display = 'none';
          if (typeof deps.showInitialPrebattle === 'function') deps.showInitialPrebattle();
        } else if (bossOverlaySection) {
          bossOverlaySection.style.display = '';
        }

        // Avatar assignment (only on explicit events)
        if (typeof deps.ensureAvatarsAssigned === 'function') deps.ensureAvatarsAssigned(state);
        if (typeof deps.initWaitingAssets === 'function') deps.initWaitingAssets();
        
        // Handle scoreboard visibility
        const playersContainer = document.getElementById('players-container');
        const scoreboardVisible = !!(playersContainer && playersContainer.querySelector('.scoreboard-head')) || global.__scoreboardActive;
        
        if (state.victoryState && !scoreboardVisible) {
          try { 
            deps.renderScoreboardIfNeeded && deps.renderScoreboardIfNeeded(true); 
          } catch (e) { 
            console.warn('[gameLoop] early scoreboard failed', e); 
          }
        }

        // Static UI updates (these don't change often)
        deps.updateBattlefield && deps.updateBattlefield();
        deps.populateRanksTab && deps.populateRanksTab();
        deps.renderRecords && deps.renderRecords();

        // Clean up overlays during active gameplay
        cleanupGameOverlays(state);

        if (state.victoryState && Game._stoppedOnOutcome !== state.completedMatches) {
          Game._stoppedOnOutcome = state.completedMatches;
          Game.stop && Game.stop();
        }

        // Handle boss actions and effects
        handleBossActions(Game, deps, state);

        // Scoreboard handling
        deps.renderScoreboardIfNeeded && deps.renderScoreboardIfNeeded();
        
        if (state.victoryState && playersContainer && !playersContainer.querySelector('.scoreboard-head')) {
          try { 
            deps.renderScoreboardIfNeeded && deps.renderScoreboardIfNeeded(true); 
          } catch (_) { }
        }
        
      } catch (err) { 
        console.warn('[gameLoop] update error', err); 
      }
    }
  }
  if (!attemptInit()) {
    let tries = 0;
    const t = setInterval(()=>{ if (attemptInit() || ++tries>100) clearInterval(t); }, 30);
  }
})(typeof window !== 'undefined' ? window : globalThis);
