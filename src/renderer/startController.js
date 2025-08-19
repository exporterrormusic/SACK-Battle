// startController.js - Start/Next & Reset orchestration
(function(global){ function resetOutcomeFlags(){ const ovFn=global.__gameBindings?.applyVictoryDefeatOverlay; if(ovFn){ ovFn._played=false; ovFn._musicApplied=null; ovFn._activeKind=null; } }
  function startHandler(){ const Game=global.Game; if(!Game) return; if(global.__startingMatch) return; const startBtn=document.getElementById('btn-start-game'); if(startBtn){ global.__startingMatch=true; startBtn.disabled=true; setTimeout(()=>{ global.__startingMatch=false; startBtn.disabled=false; },1300); }
  
    // Debug: Log what button text was when clicked
    const buttonText = startBtn ? startBtn.textContent : 'unknown';
    console.log(`[StartController] Button clicked with text: "${buttonText}"`);
    console.log(`[StartController] Game running state before start: ${Game.getState().running}`);
    
    const st=Game.getState(); if(document.querySelector('#boss-image-wrapper .game-overlay.prebattle')) global.__prebattleShownOnce=true; if(global.__prebattleShownOnce) global.__suppressPrebattle=true; if(global.waitingActive){ try { global.setWaiting(false); } catch(_){ } if(global.setWaiting){ global.setWaiting._prevMusic=null; if(global.setWaiting._waitingAudio) try { global.setWaiting._waitingAudio.pause(); } catch(_){ } } global.__prebattleActive=false; const pbw=document.getElementById('boss-image-wrapper'); const preOv=pbw?.querySelector('.game-overlay.prebattle'); preOv&&preOv.remove(); pbw&&pbw.classList.remove('prebattle'); const ovMusic=global.__audioModule?.__audioState?.overlayMusic||null; if(ovMusic && ovMusic.type==='prebattle') global.stopOverlayMusic&&global.stopOverlayMusic('prebattle'); }
    function clearForNew(){ const bossWrapper=document.getElementById('boss-image-wrapper'); const ov=bossWrapper?.querySelector('.game-overlay:not(.prebattle)'); ov&&ov.remove(); bossWrapper?.classList.remove('boss-outcome-victory','boss-outcome-defeat'); const pc=document.getElementById('players-container'); 
      // Remove scoreboard elements and class to show players again
      if(pc) {
        const scoreboardElements = pc.querySelectorAll('.scoreboard-head, .scoreboard-list');
        scoreboardElements.forEach(el => el.remove());
        pc.classList.remove('scoreboard-mode', 'scoreboard-active');
        pc.style.overflow = '';
        pc.style.overflowY = '';
        pc.style.overflowX = '';
        
        // Force visibility of player cards by removing any hiding styles
        const playerCards = pc.querySelectorAll('.player-card');
        playerCards.forEach(card => {
          card.style.display = '';
          card.style.visibility = '';
          card.style.opacity = '';
          card.style.position = '';
          card.style.left = '';
          card.style.top = '';
          card.style.width = '';
          card.style.height = '';
          card.style.margin = '';
          card.style.padding = '';
          card.style.pointerEvents = '';
          card.style.zIndex = '';
        });
      }
      if(global.__gameBindings?.renderScoreboardIfNeeded) global.__gameBindings.renderScoreboardIfNeeded._key=null; 
      
      // Clear scoreboard flags
      global.__scoreboardActive = false; const bar=document.getElementById('buff-bar'); bar&&bar.querySelectorAll('.buff-icon').forEach(n=>n.remove()); global.stopAllMusic&&global.stopAllMusic('startBtn:newMatch'); Game.clearVictoryState&&Game.clearVictoryState(); resetOutcomeFlags(); Game.clearBuffs&&Game.clearBuffs(); 
    }
  clearForNew();
  
  // Debug: Log player health BEFORE Game.start()
  if (global.Game && global.Game._rawState && global.Game._rawState.players) {
    console.log('[StartController] Player health BEFORE Game.start():');
    Object.entries(global.Game._rawState.players).forEach(([name, player]) => {
      console.log(`  ${name}: hp=${player.hp}`);
    });
  }
  
  // Always reset burst gauges at start of any game
  if (global.Game && global.Game._rawState && global.Game._rawState.players) {
    Object.values(global.Game._rawState.players).forEach(player => {
      console.log(`[BurstReset] Player ${player.name || 'unnamed'}: ${player.burstGauge} -> 0`);
      player.burstGauge = 0;
    });
    console.log('[StartController] Reset burst gauges for game start');
    
    // Force immediate visual update of players to reflect burst gauge reset
    if (global.renderPlayers) {
      try {
        global.renderPlayers(global.Game._rawState.players);
        console.log('[StartController] Forced visual update after burst reset');
      } catch(e) {
        console.warn('[StartController] Failed to force visual update:', e);
      }
    }
  }
  
  Game.start();
  
  // Debug: Log player health AFTER Game.start()
  if (global.Game && global.Game._rawState && global.Game._rawState.players) {
    console.log('[StartController] Player health AFTER Game.start():');
    Object.entries(global.Game._rawState.players).forEach(([name, player]) => {
      console.log(`  ${name}: hp=${player.hp}`);
    });
  }
  // Only increment bossPlaylistIndex if a game has already started
  let shouldAdvance = false;
  if (global.Game && global.Game._rawState) {
    let list = global.__playlist.getBossPlaylist(global.Game.getState().settings);
    if (Array.isArray(list) && list.length) {
      if (window.__firstMatchStarted) {
        global.Game._rawState.bossPlaylistIndex = (global.Game._rawState.bossPlaylistIndex + 1) % list.length;
        shouldAdvance = true;
        
        // Reset all player burst gauges when moving to a new boss
        Object.values(global.Game._rawState.players).forEach(player => {
          console.log(`[BurstReset] Player ${player.name || 'unnamed'}: ${player.burstGauge} -> 0 (new boss)`);
          player.burstGauge = 0;
        });
        console.log('[StartController] Reset burst gauges for new boss');
        
        // Force immediate visual update for boss transition burst reset
        if (global.renderPlayers) {
          try {
            global.renderPlayers(global.Game._rawState.players);
            console.log('[StartController] Forced visual update after boss transition burst reset');
          } catch(e) {
            console.warn('[StartController] Failed to force visual update for boss transition:', e);
          }
        }
      }
    }
  }
  // Always apply boss after index change
  if (global.__playlist?.applyNextBossFromPlaylist) {
    global.__playlist.applyNextBossFromPlaylist();
  }
  try { global.__audioModule?.stopOverlayMusic(); setTimeout(()=> global.__audioModule?.tryStartBossMusic?.(),300); } catch(_){ }
  global.__firstMatchStarted=true;
  global.__suppressPrebattle=true;
  global.BuffSystem?.forceMatchBoundary?.();
  if(global.scheduleBossMusicStart) try { global.scheduleBossMusicStart(); } catch(e){ console.warn('[StartBtn] scheduleBossMusicStart failed', e); }
  global.__audioModule?.tryStartBossMusic && setTimeout(()=> global.__audioModule.tryStartBossMusic(),400);
  global.__prebattleActive=false;
  const bossWrapper=document.getElementById('boss-image-wrapper');
  bossWrapper?.querySelector('.game-overlay.prebattle')?.remove();
  bossWrapper?.classList.remove('prebattle');
  }
  function resetHandler(){
    const Game = global.Game; if (!Game) return;
    
    // First, ensure AudioMixer has the most current settings before any audio operations
    if (global.__audioMixer && global.Game) {
      try {
        console.log('[Reset] Ensuring AudioMixer has current settings at start of reset');
        const currentState = global.Game.getState();
        if (currentState.settings && currentState.settings.audioSettings) {
          global.__audioMixer.updateAudioSettings(currentState.settings);
          console.log('[Reset] AudioMixer updated at reset start with:', currentState.settings.audioSettings);
        }
      } catch(e) { console.warn('[Reset] Failed to update AudioMixer settings at start', e); }
    }
    
    // 1. Stop any running game
    Game.stop && Game.stop();
    // 2. Clear all state and match counters
    Game.resetActivePlayers && Game.resetActivePlayers();
    Game.resetMatchTotal && Game.resetMatchTotal();
    if (Game.clearVictoryState) Game.clearVictoryState();
    // Reset playlist position to top
    if (Game._rawState) {
      Game._rawState.bossPlaylistIndex = 0;
    }
    // 3. Clean overlays and UI
    const bossWrapper = document.getElementById('boss-image-wrapper');
    bossWrapper?.querySelectorAll('.game-overlay')?.forEach(o=>o.remove());
    bossWrapper?.classList.remove('boss-outcome-victory','boss-outcome-defeat','prebattle','has-prebattle-overlay');
    const pc = document.getElementById('players-container');
    // Completely clear the players container for fresh start
    if (pc) {
      pc.innerHTML = '';
      pc.classList.remove('scoreboard-mode', 'scoreboard-active');
      pc.style.overflow = '';
      pc.style.overflowY = '';
      pc.style.overflowX = '';
    }
    if (global.__gameBindings?.renderScoreboardIfNeeded) global.__gameBindings.renderScoreboardIfNeeded._key = null;
    const startBtn = document.getElementById('btn-start-game');
    startBtn && (startBtn.textContent = 'Start Game');
  // 4. Stop all music and show welcome screen
    // Only stopAllMusic and force stop boss music if not already in waiting (welcome) state
    if (!global.waitingActive) {
      if (typeof global.stopAllMusic === 'function') global.stopAllMusic('reset');
      // Force stop boss music audio if present
      try {
        const audio = global.__audioModule;
        if (audio && audio.state && audio.state.bossAudio && audio.state.bossAudio.music) {
          audio.state.bossAudio.music.pause && audio.state.bossAudio.music.pause();
          audio.state.bossAudio.music.currentTime = 0;
        }
      } catch(e) { console.warn('[Reset] Failed to force stop boss music', e); }
    }
    
    // Ensure AudioMixer has the most current settings before going to welcome screen
    if (global.__audioMixer && global.Game) {
      try {
        console.log('[Reset] Forcing AudioMixer refresh before welcome screen');
        const currentState = global.Game.getState();
        if (currentState.settings && currentState.settings.audioSettings) {
          global.__audioMixer.updateAudioSettings(currentState.settings);
          console.log('[Reset] AudioMixer updated with current settings:', currentState.settings.audioSettings);
        }
      } catch(e) { console.warn('[Reset] Failed to update AudioMixer settings', e); }
    }
  // Reset all prebattle flags to allow prebattle overlay/music
  global.__prebattleActive = false;
  global.__prebattleShownOnce = false;
  global.__suppressPrebattle = false;
  window.__firstMatchStarted = false;
    if (global.__waitingRoom && typeof global.__waitingRoom.initialShow === 'function') {
      // Reset the initialShow guard so the robust logic runs again
      global.__waitingRoom.initialShow._done = false;
      global.__waitingRoom.initialShow();
    } else if (global.setWaiting && typeof global.setWaiting === 'function') {
      global.setWaiting(true);
    }
    // 5. On welcome screen dismiss, show prebattle overlay ONLY (do not auto-start game)
    if (typeof global.wireWaitingDismiss === 'function') {
      const origWire = global.wireWaitingDismiss;
      global.wireWaitingDismiss = function patchedWireWaitingDismiss() {
        origWire();
        // Attach a one-time handler to run after welcome is dismissed
        const waitingEl = document.getElementById('welcome-screen');
        if (waitingEl) {
          const handler = function () {
            setTimeout(() => {
              // Reset prebattle flags to allow overlay/music
              global.__prebattleActive = true;
              global.__prebattleShownOnce = false;
              global.__suppressPrebattle = false;
              // Show prebattle overlay (user must click to start game)
              if (typeof global.showInitialPrebattle === 'function') global.showInitialPrebattle();
              // Do NOT call playOverlayMusic('prebattle') here; let prebattle overlay logic handle it
              // Do NOT auto-start the game here; let user click to proceed
              // Restore original wireWaitingDismiss
              global.wireWaitingDismiss = origWire;
            }, 50);
            waitingEl.removeEventListener('transitionend', handler);
          };
          waitingEl.addEventListener('transitionend', handler);
        }
      };
      global.wireWaitingDismiss();
    }
  }
  function wire(){ const sb=document.getElementById('btn-start-game'); const rb=document.getElementById('btn-stop-game'); if(sb&&!sb._wired){ sb._wired=true; sb.addEventListener('click', startHandler); } if(rb&&!rb._wired){ rb._wired=true; rb.addEventListener('click', resetHandler); } const bfSel=document.getElementById('input-battlefield-bg'); if(bfSel&&!bfSel._wired){ bfSel._wired=true; bfSel.addEventListener('change', e=>{ global.selectedBattlefield=e.target.value; global.updateBattlefield && global.updateBattlefield(global.selectedBattlefield); }); } }
  document.addEventListener('DOMContentLoaded', wire);
  // Update button text based on game state
  const startBtn = document.getElementById('btn-start-game');
  if (startBtn) {
    if (global.Game && global.Game.getState && global.Game.getState().running) {
      startBtn.textContent = 'Next Game';
    } else {
      startBtn.textContent = 'Start Game';
    }
  }
})(typeof window!=='undefined'?window:globalThis);
