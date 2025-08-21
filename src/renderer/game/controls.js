// src/renderer/controls.js
(function(){
  function ensurePrebattleOverlay(){
    try {
      if (window.__prebattleActive && window.Game && !window.Game.getState().running) {
        const bossWrapper=document.getElementById('boss-image-wrapper');
        if (bossWrapper && !bossWrapper.querySelector('.game-overlay.prebattle')) {
          if (typeof window.showInitialPrebattle === 'function') window.showInitialPrebattle();
        } else if (bossWrapper) {
          const existing=bossWrapper.querySelector('.game-overlay.prebattle'); if (existing) existing.classList.add('shown');
        }
      }
    } catch(_){}
  }
  function wireControls(){
    const Game = window.Game; if (!Game) return;
    const startBtn=document.getElementById('btn-start-game');
    const stopBtn=document.getElementById('btn-stop-game');
    const forceNextBtn=document.getElementById('btn-force-turn');
    const spawnBotBtn=document.getElementById('btn-spawn-bot');
    const botBehaviorSelect=document.getElementById('bot-behavior-select');
    const bossAttackSelect=document.getElementById('boss-attack-select');
    const setBossAttackBtn=document.getElementById('btn-set-boss-attack');
  const testBuffBtn=document.getElementById('btn-test-buff');
  const testBuffSelect = document.getElementById('dev-buff-select');
  
  if (forceNextBtn && !forceNextBtn._wired) { 
    forceNextBtn._wired = true; 
    forceNextBtn.onclick = () => Game.forceNextTurn && Game.forceNextTurn(); 
  }
  
  if (spawnBotBtn && !spawnBotBtn._wired) {
    spawnBotBtn._wired = true;
    spawnBotBtn.onclick = () => {
      try {
        const behavior = botBehaviorSelect ? botBehaviorSelect.value : 'random';
        const botName = `Bot${Math.floor(Math.random() * 100000)}`;
        let avatar = null;
        const avatarsList = window.__avatarsList || [];
        if (avatarsList.length) avatar = avatarsList[Math.floor(Math.random() * avatarsList.length)];
        
        if (Game.addPlayer) {
          Game.addPlayer(botName, { isBot: true, behavior, avatar });
          Game.setPlayerAction && Game.setPlayerAction(botName, 'attack');
          if (window.__prebattleActive) ensurePrebattleOverlay();
          
          // Force UI update after bot spawn
          if (Game.getState) {
            const state = Game.getState();
            if (typeof window.renderPlayers === 'function') window.renderPlayers(state.players);
          }
        }
      } catch (e) { 
        console.warn('[Controls] spawn bot failed', e); 
      }
    };
  }
    if (setBossAttackBtn && !setBossAttackBtn._wired){ setBossAttackBtn._wired=true; setBossAttackBtn.onclick=()=>{ try { const attack=bossAttackSelect?bossAttackSelect.value:null; if (attack && Game.setBossNextMove) Game.setBossNextMove(attack); ensurePrebattleOverlay(); } catch(e){ console.warn('[Controls] set boss attack failed', e); } }; }
    if (testBuffBtn && !testBuffBtn._wired){
      testBuffBtn._wired = true;
      testBuffBtn.onclick = ()=>{
        try {
          const key = testBuffSelect ? testBuffSelect.value : 'powerfulattack';
          console.log('[DevBuffTest] Trigger', key);
          if (window.BuffSystem && window.BuffSystem.trigger) {
            const ok = window.BuffSystem.trigger(key, 'ExportErrorMusic');
            console.log('[DevBuffTest] trigger returned', ok);
          } else if (window.__buffDev && window.__buffDev.trigger) {
            window.__buffDev.trigger(key);
          } else if (window.playBuffAnimation) {
            window.playBuffAnimation(key);
          } else {
            console.warn('[DevBuffTest] No buff trigger path available');
          }
        } catch(e){ console.warn('[DevBuffTest] failed', e); }
      };
    }
  }
  document.addEventListener('DOMContentLoaded', wireControls);
})();
