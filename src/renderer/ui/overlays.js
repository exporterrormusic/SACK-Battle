// src/renderer/overlays.js
(function(){
  function ensurePrebattleOverlay(){
    try {
      if (window.__prebattleActive && window.Game && !window.Game.getState().running) {
        const bossWrapper=document.getElementById('boss-image-wrapper');
        if (bossWrapper && !bossWrapper.querySelector('.game-overlay.prebattle')) {
          if (typeof window.showInitialPrebattle === 'function') window.showInitialPrebattle();
        } else if (bossWrapper) {
          const existing=bossWrapper.querySelector('.game-overlay.prebattle');
            if (existing) existing.classList.add('shown');
        }
      }
    } catch(_){ }
  }
  window.ensurePrebattleOverlay = ensurePrebattleOverlay;
})();
