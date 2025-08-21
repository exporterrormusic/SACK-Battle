// src/renderer/memoryManager.js
// Memory management utilities for performance optimization

(function() {
  'use strict';

  class MemoryManager {
    constructor() {
      this.eventListeners = new Map();
      this.timers = new Set();
      this.observers = new Set();
      this.audioObjects = new Map();
      this.cleanupCallbacks = new Set();
      this.memoryStats = {
        maxEventListeners: 0,
        maxTimers: 0,
        maxObservers: 0,
        maxAudioObjects: 0,
        cleanupCount: 0
      };
      
      // Track DOM mutations for memory leaks
      this.domObserver = null;
      this.initDOMTracking();
      
      // Auto-cleanup on page unload
      this.initAutoCleanup();
    }

    // Event listener management with automatic cleanup
    addEventListener(element, event, handler, options = {}) {
      const key = this.generateKey(element, event, handler);
      
      if (this.eventListeners.has(key)) {
        console.warn('[MemoryManager] Duplicate event listener detected:', { element, event });
        return key; // Return existing key instead of adding duplicate
      }

      // Ensure options is properly formatted for addEventListener
      const eventOptions = typeof options === 'boolean' ? options : (options || {});
      element.addEventListener(event, handler, eventOptions);
      
      this.eventListeners.set(key, {
        element,
        event,
        handler,
        options: eventOptions,
        timestamp: Date.now()
      });

      this.memoryStats.maxEventListeners = Math.max(
        this.memoryStats.maxEventListeners,
        this.eventListeners.size
      );

      return key;
    }

    removeEventListener(key) {
      const listener = this.eventListeners.get(key);
      if (listener) {
        listener.element.removeEventListener(listener.event, listener.handler, listener.options);
        this.eventListeners.delete(key);
        this.memoryStats.cleanupCount++;
        return true;
      }
      return false;
    }

    // Timer management
    setTimeout(callback, delay, ...args) {
      const timeoutId = setTimeout(() => {
        this.timers.delete(timeoutId);
        callback(...args);
      }, delay);

      this.timers.add(timeoutId);
      this.memoryStats.maxTimers = Math.max(this.memoryStats.maxTimers, this.timers.size);
      
      return timeoutId;
    }

    setInterval(callback, interval, ...args) {
      const intervalId = setInterval(callback, interval, ...args);
      this.timers.add(intervalId);
      this.memoryStats.maxTimers = Math.max(this.memoryStats.maxTimers, this.timers.size);
      
      return intervalId;
    }

    clearTimer(timerId) {
      if (this.timers.has(timerId)) {
        clearTimeout(timerId);
        clearInterval(timerId);
        this.timers.delete(timerId);
        this.memoryStats.cleanupCount++;
        return true;
      }
      return false;
    }

    // Observer management (MutationObserver, IntersectionObserver, etc.)
    addObserver(observer, config) {
      const observerData = {
        observer,
        config,
        timestamp: Date.now(),
        id: this.generateObserverId()
      };

      this.observers.add(observerData);
      this.memoryStats.maxObservers = Math.max(this.memoryStats.maxObservers, this.observers.size);
      
      return observerData.id;
    }

    removeObserver(observerId) {
      for (const observerData of this.observers) {
        if (observerData.id === observerId) {
          observerData.observer.disconnect();
          this.observers.delete(observerData);
          this.memoryStats.cleanupCount++;
          return true;
        }
      }
      return false;
    }

    // Audio object pooling
    getAudioObject(src, poolKey = 'default') {
      const poolMap = this.audioObjects.get(poolKey) || new Map();
      
      // Check for available pooled audio
      for (const [audioSrc, audioPool] of poolMap) {
        if (audioSrc === src && audioPool.length > 0) {
          const audio = audioPool.pop();
          audio.currentTime = 0; // Reset for reuse
          return audio;
        }
      }

      // Create new audio object (prefer centralized audio helper)
      let audio;
      if (window.SackBattle?.utils?.audio) {
        // Attempt to infer category from path; default to sfx
        const isMusic = /\/assets\/ui\//i.test(src) || /music/i.test(src);
        audio = window.SackBattle.utils.audio.createAudio(src, isMusic ? 'music' : 'sfx', 1.0);
      } else {
        audio = new Audio(src);
        audio.preload = 'auto';
        try {
          if (window.__audioMixer) {
            const isMusic = /\/assets\/ui\//i.test(src) || /music/i.test(src);
            audio.volume = window.__audioMixer.calculateCategoryVolume(isMusic ? 'music' : 'sfx', 1.0);
          }
        } catch(_) {}
      }
      
      // Add return-to-pool functionality
      const originalPause = audio.pause.bind(audio);
      audio.pause = () => {
        originalPause();
        this.returnAudioToPool(audio, src, poolKey);
      };

      // Add ended event listener to auto-return
      audio.addEventListener('ended', () => {
        this.returnAudioToPool(audio, src, poolKey);
      });

      this.memoryStats.maxAudioObjects = Math.max(
        this.memoryStats.maxAudioObjects, 
        this.getTotalAudioObjects()
      );

      return audio;
    }

    returnAudioToPool(audio, src, poolKey = 'default') {
      if (!this.audioObjects.has(poolKey)) {
        this.audioObjects.set(poolKey, new Map());
      }
      
      const poolMap = this.audioObjects.get(poolKey);
      if (!poolMap.has(src)) {
        poolMap.set(src, []);
      }

      const pool = poolMap.get(src);
      if (pool.length < 5) { // Limit pool size
        audio.currentTime = 0;
        pool.push(audio);
      }
    }

    // Generic cleanup callback registration
    addCleanupCallback(callback) {
      this.cleanupCallbacks.add(callback);
      return callback;
    }

    removeCleanupCallback(callback) {
      return this.cleanupCallbacks.delete(callback);
    }

    // Memory leak detection
    detectMemoryLeaks() {
      const report = {
        timestamp: new Date().toISOString(),
        eventListeners: this.eventListeners.size,
        timers: this.timers.size,
        observers: this.observers.size,
        audioObjects: this.getTotalAudioObjects(),
        warnings: []
      };

      // Check for excessive event listeners
      if (this.eventListeners.size > 100) {
        report.warnings.push(`High event listener count: ${this.eventListeners.size}`);
      }

      // Check for old timers
      const now = Date.now();
      let oldTimerCount = 0;
      for (const timer of this.timers) {
        // This is a simplified check; real implementation would need timer metadata
        oldTimerCount++;
      }
      if (oldTimerCount > 20) {
        report.warnings.push(`High timer count: ${oldTimerCount}`);
      }

      // Check for stale observers
      if (this.observers.size > 10) {
        report.warnings.push(`High observer count: ${this.observers.size}`);
      }

      return report;
    }

    // Cleanup all managed resources
    cleanup() {
      console.log('[MemoryManager] Starting cleanup...');
      
      // Execute custom cleanup callbacks first
      for (const callback of this.cleanupCallbacks) {
        try {
          callback();
        } catch (e) {
          console.warn('[MemoryManager] Cleanup callback failed:', e);
        }
      }

      // Clean up event listeners
      for (const [key, listener] of this.eventListeners) {
        try {
          listener.element.removeEventListener(listener.event, listener.handler, listener.options);
        } catch (e) {
          console.warn('[MemoryManager] Event listener cleanup failed:', e);
        }
      }
      this.eventListeners.clear();

      // Clean up timers
      for (const timerId of this.timers) {
        try {
          clearTimeout(timerId);
          clearInterval(timerId);
        } catch (e) {
          console.warn('[MemoryManager] Timer cleanup failed:', e);
        }
      }
      this.timers.clear();

      // Clean up observers
      for (const observerData of this.observers) {
        try {
          observerData.observer.disconnect();
        } catch (e) {
          console.warn('[MemoryManager] Observer cleanup failed:', e);
        }
      }
      this.observers.clear();

      // Clean up audio objects
      for (const [poolKey, poolMap] of this.audioObjects) {
        for (const [src, pool] of poolMap) {
          for (const audio of pool) {
            try {
              audio.pause();
              audio.src = '';
            } catch (e) {
              console.warn('[MemoryManager] Audio cleanup failed:', e);
            }
          }
        }
      }
      this.audioObjects.clear();

      // Disconnect DOM observer
      if (this.domObserver) {
        this.domObserver.disconnect();
        this.domObserver = null;
      }

      console.log('[MemoryManager] Cleanup completed');
    }

    // Get memory usage statistics
    getMemoryStats() {
      return {
        ...this.memoryStats,
        current: {
          eventListeners: this.eventListeners.size,
          timers: this.timers.size,
          observers: this.observers.size,
          audioObjects: this.getTotalAudioObjects()
        }
      };
    }

    // Private helper methods
    generateKey(element, event, handler) {
      const elementId = element.id || element.tagName || 'unknown';
      const handlerStr = handler.toString().substring(0, 50);
      return `${elementId}-${event}-${Date.now()}-${Math.random()}`;
    }

    generateObserverId() {
      return `obs-${Date.now()}-${Math.random()}`;
    }

    getTotalAudioObjects() {
      let total = 0;
      for (const [poolKey, poolMap] of this.audioObjects) {
        for (const [src, pool] of poolMap) {
          total += pool.length;
        }
      }
      return total;
    }

    initDOMTracking() {
      if (typeof MutationObserver === 'undefined') return;

      this.domObserver = new MutationObserver((mutations) => {
        let addedNodes = 0;
        let removedNodes = 0;

        mutations.forEach((mutation) => {
          addedNodes += mutation.addedNodes.length;
          removedNodes += mutation.removedNodes.length;
        });

        // Warn if DOM is growing too quickly
        if (addedNodes > 50 && addedNodes > removedNodes * 2) {
          console.warn('[MemoryManager] DOM growing rapidly - potential memory leak');
        }
      });

      // Start observing with a delay to avoid initial page load noise
      setTimeout(() => {
        if (this.domObserver) {
          this.domObserver.observe(document.body, {
            childList: true,
            subtree: true
          });
        }
      }, 5000);
    }

    initAutoCleanup() {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });

      // Also cleanup on visibility change (tab switching)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Perform light cleanup when tab is hidden
          this.performLightCleanup();
        }
      });
    }

    performLightCleanup() {
      // Clean up only non-essential resources when tab is hidden
      const report = this.detectMemoryLeaks();
      if (report.warnings.length > 0) {
        console.warn('[MemoryManager] Memory warnings detected:', report.warnings);
      }
    }
  }

  // Create global instance
  window.MemoryManager = MemoryManager;
  if (!window.__memoryManager) {
    window.__memoryManager = new MemoryManager();
    console.log('[MemoryManager] Initialized');
  }

})();
