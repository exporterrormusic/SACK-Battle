// src/utils/logger.js
// Lightweight logging utility with debug gating

(function(global) {
  'use strict';

  if (global.SackBattle && global.SackBattle.utils.logger) return;

  // Ensure SackBattle namespace exists
  if (!global.SackBattle) {
    global.SackBattle = { utils: {} };
  }
  if (!global.SackBattle.utils) {
    global.SackBattle.utils = {};
  }

  const logger = {
    debug(module, message, data) {
      if (global.SackBattle?.flags?.debug) {
        console.log(`[${module}] ${message}`, data || '');
      }
    },

    info(module, message, data) {
      console.log(`[${module}] ${message}`, data || '');
    },

    warn(module, message, data) {
      console.warn(`[${module}] ${message}`, data || '');
    },

    error(module, message, error) {
      console.error(`[${module}] ${message}`, error || '');
    },

    // Set debug mode
    setDebug(enabled) {
      if (!global.SackBattle.flags) {
        global.SackBattle.flags = {};
      }
      global.SackBattle.flags.debug = enabled;
    },

    // Get current debug state
    isDebug() {
      return global.SackBattle?.flags?.debug || false;
    }
  };

  global.SackBattle.utils.logger = logger;

})(typeof window !== 'undefined' ? window : globalThis);
