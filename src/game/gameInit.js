// src/game/gameInit.js
// Initialize registries with existing game content and integrate systems

(function(global) {
  'use strict';

  function initializeGame() {
    console.log('[GameInit] Initializing registries and systems...');

    // Ensure registries are available
    if (!global.SackBattle?.registries) {
      console.error('[GameInit] Registries not available!');
      return;
    }

  // Registries already initialize defaults in core/registries.js
  // We only integrate systems here.

    // Integrate with existing Game object if available
  if (global.Game && global.SackBattle?.game?.migration) {
      console.log('[GameInit] Integrating action processor with existing Game...');
      global.SackBattle.game.migration.integrateActionProcessor(global.Game);
    }

    // Set up logger debug mode based on dev environment
    if (global.SackBattle?.utils?.logger && global.__DEV__) {
      global.SackBattle.utils.logger.setDebug(true);
    }

    console.log('[GameInit] Initialization complete!');
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
  } else {
    // DOM already loaded
    setTimeout(initializeGame, 100);
  }

  // Export for manual initialization
  if (!global.SackBattle) global.SackBattle = {};
  if (!global.SackBattle.game) global.SackBattle.game = {};
  
  global.SackBattle.game.init = initializeGame;

})(typeof window !== 'undefined' ? window : globalThis);
