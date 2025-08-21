// src/renderer/stateManager.js
// Advanced state management with efficient diffing and selective updates

(function(global) {
  'use strict';
  
  if (global.__stateManager) return; // Singleton guard
  
  /**
   * Deep comparison utility for state diffing
   * @param {*} oldVal - Previous value
   * @param {*} newVal - New value
   * @param {string} path - Property path for debugging
   * @returns {boolean} - True if values are different
   */
  function hasChanged(oldVal, newVal, path = '') {
    // Handle null/undefined cases
    if (oldVal === newVal) return false;
    if (oldVal == null || newVal == null) return true;
    
    // Handle primitive types
    if (typeof oldVal !== 'object' || typeof newVal !== 'object') {
      return oldVal !== newVal;
    }
    
    // Handle arrays
    if (Array.isArray(oldVal) !== Array.isArray(newVal)) return true;
    if (Array.isArray(oldVal)) {
      if (oldVal.length !== newVal.length) return true;
      return oldVal.some((item, index) => hasChanged(item, newVal[index], `${path}[${index}]`));
    }
    
    // Handle objects
    const oldKeys = Object.keys(oldVal);
    const newKeys = Object.keys(newVal);
    if (oldKeys.length !== newKeys.length) return true;
    
    return oldKeys.some(key => {
      if (!newKeys.includes(key)) return true;
      return hasChanged(oldVal[key], newVal[key], path ? `${path}.${key}` : key);
    });
  }
  
  /**
   * Generate a diff object showing what changed
   * @param {Object} oldState - Previous state
   * @param {Object} newState - New state
   * @returns {Object} - Diff object with changed paths
   */
  function generateStateDiff(oldState, newState) {
    const diff = {
      changed: [],
      players: {},
      boss: {},
      ui: {},
      settings: {}
    };
    
    if (!oldState || !newState) {
      diff.changed.push('full_state');
      return diff;
    }
    
    // Check top-level properties
    const topLevelProps = ['running', 'round', 'secondsLeft', 'victoryState', 'completedMatches'];
    topLevelProps.forEach(prop => {
      if (hasChanged(oldState[prop], newState[prop])) {
        diff.changed.push(prop);
        diff.ui[prop] = { old: oldState[prop], new: newState[prop] };
      }
    });
    
    // Check boss state
    if (oldState.boss && newState.boss) {
      ['hp', 'maxHp', 'lastMove', 'visualState'].forEach(prop => {
        if (hasChanged(oldState.boss[prop], newState.boss[prop])) {
          diff.changed.push(`boss.${prop}`);
          diff.boss[prop] = { old: oldState.boss[prop], new: newState.boss[prop] };
        }
      });
    } else if (hasChanged(oldState.boss, newState.boss)) {
      diff.changed.push('boss');
      diff.boss = { old: oldState.boss, new: newState.boss };
    }
    
    // Check players (most complex part)
    const oldPlayers = oldState.players || {};
    const newPlayers = newState.players || {};
    const allPlayerNames = new Set([...Object.keys(oldPlayers), ...Object.keys(newPlayers)]);
    
    allPlayerNames.forEach(name => {
      const oldPlayer = oldPlayers[name];
      const newPlayer = newPlayers[name];
      
      if (!oldPlayer && newPlayer) {
        // New player added
        diff.changed.push(`players.${name}.added`);
        diff.players[name] = { type: 'added', player: newPlayer };
      } else if (oldPlayer && !newPlayer) {
        // Player removed
        diff.changed.push(`players.${name}.removed`);
        diff.players[name] = { type: 'removed', player: oldPlayer };
      } else if (oldPlayer && newPlayer) {
        // Check for changes in existing player
        const playerDiff = {};
        ['hp', 'avatar', 'lastAction', 'pendingAction', 'invincibleTurns'].forEach(prop => {
          if (hasChanged(oldPlayer[prop], newPlayer[prop])) {
            diff.changed.push(`players.${name}.${prop}`);
            playerDiff[prop] = { old: oldPlayer[prop], new: newPlayer[prop] };
          }
        });
        
        if (Object.keys(playerDiff).length > 0) {
          diff.players[name] = { type: 'changed', changes: playerDiff };
        }
      }
    });
    
    return diff;
  }
  
  /**
   * Optimized state manager with selective updates
   */
  class StateManager {
    constructor() {
      this.previousState = null;
      this.updateCallbacks = new Map();
      this.performanceMetrics = {
        updates: 0,
        fullRenders: 0,
        partialRenders: 0,
        avgDiffTime: 0
      };
    }
    
    /**
     * Register a callback for specific state changes
     * @param {string} component - Component name
     * @param {Array|string} watchPaths - Paths to watch (e.g., ['players', 'boss.hp'])
     * @param {Function} callback - Callback function
     */
    subscribe(component, watchPaths, callback) {
      if (typeof watchPaths === 'string') watchPaths = [watchPaths];
      
      this.updateCallbacks.set(component, {
        watchPaths,
        callback,
        lastUpdate: 0
      });
    }
    
    /**
     * Process state update with intelligent diffing
     * @param {Object} newState - New game state
     */
    processUpdate(newState) {
      const startTime = performance.now();
      this.performanceMetrics.updates++;
      
      if (!this.previousState) {
        // First update - trigger all callbacks
        this.previousState = this._cloneState(newState);
        this._triggerAllCallbacks(newState, { changed: ['full_state'] });
        this.performanceMetrics.fullRenders++;
        return;
      }
      
      // Generate diff
      const diff = generateStateDiff(this.previousState, newState);
      const diffTime = performance.now() - startTime;
      this.performanceMetrics.avgDiffTime = (this.performanceMetrics.avgDiffTime + diffTime) / 2;
      
      if (diff.changed.length === 0) {
        // No changes - skip all updates
        return;
      }
      
      // Trigger selective updates
      if (diff.changed.includes('full_state') || diff.changed.length > 10) {
        // Too many changes - do full update
        this._triggerAllCallbacks(newState, diff);
        this.performanceMetrics.fullRenders++;
      } else {
        // Selective updates
        this._triggerSelectiveCallbacks(newState, diff);
        this.performanceMetrics.partialRenders++;
      }
      
      // Update previous state
      this.previousState = this._cloneState(newState);
      
      // Log performance occasionally
      if (this.performanceMetrics.updates % 100 === 0) {
        console.log('[StateManager] Performance:', this.performanceMetrics);
      }
    }
    
    /**
     * Trigger all registered callbacks
     */
    _triggerAllCallbacks(state, diff) {
      this.updateCallbacks.forEach((config, component) => {
        try {
          config.callback(state, diff, 'full');
          config.lastUpdate = Date.now();
        } catch (e) {
          console.warn(`[StateManager] Callback error in ${component}:`, e);
        }
      });
    }
    
    /**
     * Trigger only callbacks that care about changed paths
     */
    _triggerSelectiveCallbacks(state, diff) {
      this.updateCallbacks.forEach((config, component) => {
        const shouldUpdate = config.watchPaths.some(watchPath => 
          diff.changed.some(changedPath => 
            changedPath.startsWith(watchPath) || watchPath.startsWith(changedPath)
          )
        );
        
        if (shouldUpdate) {
          try {
            config.callback(state, diff, 'selective');
            config.lastUpdate = Date.now();
          } catch (e) {
            console.warn(`[StateManager] Callback error in ${component}:`, e);
          }
        }
      });
    }
    
    /**
     * Efficient state cloning (better than JSON.parse/stringify)
     */
    _cloneState(state) {
      if (!state || typeof state !== 'object') return state;
      
      // Use structured cloning for better performance
      try {
        return structuredClone(state);
      } catch (e) {
        // Fallback to JSON method if structuredClone not available
        return JSON.parse(JSON.stringify(state));
      }
    }
    
    /**
     * Get performance metrics
     */
    getMetrics() {
      return { ...this.performanceMetrics };
    }
    
    /**
     * Reset performance metrics
     */
    resetMetrics() {
      this.performanceMetrics = {
        updates: 0,
        fullRenders: 0,
        partialRenders: 0,
        avgDiffTime: 0
      };
    }
  }
  
  // Create singleton instance
  const stateManager = new StateManager();
  
  // Export API
  const api = {
    subscribe: (component, watchPaths, callback) => stateManager.subscribe(component, watchPaths, callback),
    processUpdate: (state) => stateManager.processUpdate(state),
    getMetrics: () => stateManager.getMetrics(),
    resetMetrics: () => stateManager.resetMetrics(),
    hasChanged,
    generateStateDiff
  };
  
  global.__stateManager = api;
  
  // Also export the StateManager class for bootstrap compatibility
  global.StateManager = StateManager;

})(typeof window !== 'undefined' ? window : globalThis);
