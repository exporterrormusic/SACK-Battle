// src/renderer/persistenceHelper.js
// Centralized persistence utilities to reduce code duplication

(function(global) {
  'use strict';
  
  if (global.__persistenceHelper) return; // Singleton guard
  
  /**
   * Standard persist function used across multiple modules
   * @param {string} context - Optional context for debugging
   */
  function persist(context = '') {
    if (global.__schedulePersist) {
      global.__schedulePersist();
      if (context && global.console) {
        global.console.log(`[PersistenceHelper] Scheduled persist from: ${context}`);
      }
    }
  }
  
  /**
   * Immediate persist without debouncing
   * @param {Object} game - Game instance
   * @param {string} context - Optional context for debugging
   */
  function persistImmediate(game, context = '') {
    if (global.__settings && global.__settings.persist) {
      global.__settings.persist(game);
      if (context && global.console) {
        global.console.log(`[PersistenceHelper] Immediate persist from: ${context}`);
      }
    }
  }
  
  /**
   * Safe game state update with persistence
   * @param {Object} game - Game instance
   * @param {Object} newSettings - Settings to merge
   * @param {string} context - Optional context for debugging
   */
  function updateSettingsAndPersist(game, newSettings, context = '') {
    try {
      const currentState = game.getState();
      game.setSettings({ ...currentState.settings, ...newSettings });
      persist(context);
    } catch (e) {
      if (global.console) {
        global.console.warn(`[PersistenceHelper] Failed to update settings:`, e, `Context: ${context}`);
      }
    }
  }
  
  // Export API
  const api = {
    persist,
    persistImmediate,
    updateSettingsAndPersist
  };
  
  global.__persistenceHelper = api;
  
  // Also expose individual functions for backward compatibility
  global.__persist = persist;
  global.__persistImmediate = persistImmediate;
  global.__updateSettingsAndPersist = updateSettingsAndPersist;
  
})(typeof window !== 'undefined' ? window : globalThis);
