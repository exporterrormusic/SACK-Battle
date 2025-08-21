// src/utils/animationQueue.js
// Unified Animation Queue Manager - Handles all animation queueing needs

(function(global) {
  'use strict';

  /**
   * Unified Animation Queue Manager
   * Replaces separate queue systems in fx.js and buffSystem.js
   */
  class AnimationQueueManager {
    constructor() {
      this.queues = new Map(); // Multiple named queues
      this.activeFlags = new Map(); // Track which queues are processing
      this.processors = new Map(); // Queue-specific processing functions
      this.defaultDelay = 100; // Default delay between animations
      
      console.log('[AnimationQueue] Manager initialized');
    }

    /**
     * Register a new animation queue
     * @param {string} queueName - Unique name for this queue
     * @param {function} processor - Function to process individual items
     * @param {number} delay - Delay between processing items (ms)
     */
    registerQueue(queueName, processor, delay = this.defaultDelay) {
      if (this.queues.has(queueName)) {
        console.warn(`[AnimationQueue] Queue '${queueName}' already exists, overwriting`);
      }
      
      this.queues.set(queueName, []);
      this.activeFlags.set(queueName, false);
      this.processors.set(queueName, processor);
      
      console.log(`[AnimationQueue] Registered queue '${queueName}' with ${delay}ms delay`);
      
      // Return bound methods for convenience
      return {
        enqueue: (item) => this.enqueue(queueName, item),
        getLength: () => this.getQueueLength(queueName),
        isActive: () => this.isQueueActive(queueName),
        clear: () => this.clearQueue(queueName)
      };
    }

    /**
     * Add an item to a specific queue
     * @param {string} queueName - Name of the queue
     * @param {any} item - Item to add to queue
     */
    enqueue(queueName, item) {
      if (!this.queues.has(queueName)) {
        console.error(`[AnimationQueue] Queue '${queueName}' not registered`);
        return false;
      }

      const queue = this.queues.get(queueName);
      queue.push(item);
      
      console.log(`[AnimationQueue] Added to '${queueName}' queue, length: ${queue.length}`);
      
      // Start processing if not already active
      this.processQueue(queueName);
      return true;
    }

    /**
     * Process the next item in a queue
     * @param {string} queueName - Name of the queue to process
     */
    async processQueue(queueName) {
      if (!this.queues.has(queueName)) {
        console.error(`[AnimationQueue] Queue '${queueName}' not registered`);
        return;
      }

      const queue = this.queues.get(queueName);
      const isActive = this.activeFlags.get(queueName);
      
      // Don't process if already active or queue is empty
      if (isActive || queue.length === 0) {
        return;
      }

      // Mark as active
      this.activeFlags.set(queueName, true);
      
      // Get the next item
      const item = queue.shift();
      console.log(`[AnimationQueue] Processing '${queueName}' item, remaining: ${queue.length}`);

      try {
        // Get the processor function
        const processor = this.processors.get(queueName);
        
        // Process the item (processor should handle its own timing)
        await processor(item, () => {
          // Completion callback - mark as inactive and process next
          this.activeFlags.set(queueName, false);
          
          // Process next item after delay
          if (queue.length > 0) {
            setTimeout(() => this.processQueue(queueName), this.defaultDelay);
          }
        });
        
      } catch (error) {
        console.error(`[AnimationQueue] Error processing '${queueName}' queue:`, error);
        
        // Mark as inactive even on error
        this.activeFlags.set(queueName, false);
        
        // Try to continue with next item
        if (queue.length > 0) {
          setTimeout(() => this.processQueue(queueName), this.defaultDelay);
        }
      }
    }

    /**
     * Get the current length of a queue
     * @param {string} queueName - Name of the queue
     * @returns {number} Queue length
     */
    getQueueLength(queueName) {
      const queue = this.queues.get(queueName);
      return queue ? queue.length : 0;
    }

    /**
     * Check if a queue is currently processing
     * @param {string} queueName - Name of the queue
     * @returns {boolean} True if processing
     */
    isQueueActive(queueName) {
      return this.activeFlags.get(queueName) || false;
    }

    /**
     * Clear all items from a queue
     * @param {string} queueName - Name of the queue
     */
    clearQueue(queueName) {
      if (this.queues.has(queueName)) {
        const queue = this.queues.get(queueName);
        const cleared = queue.length;
        queue.length = 0;
        console.log(`[AnimationQueue] Cleared ${cleared} items from '${queueName}' queue`);
      }
    }

    /**
     * Get status of all queues
     * @returns {object} Status information
     */
    getStatus() {
      const status = {};
      this.queues.forEach((queue, name) => {
        status[name] = {
          length: queue.length,
          active: this.activeFlags.get(name),
          hasProcessor: this.processors.has(name)
        };
      });
      return status;
    }

    /**
     * Emergency stop - clear all queues and reset flags
     */
    emergencyStop() {
      console.warn('[AnimationQueue] Emergency stop triggered');
      this.queues.forEach((queue, name) => {
        queue.length = 0;
        this.activeFlags.set(name, false);
      });
    }
  }

  // Create global instance
  global.AnimationQueueManager = global.AnimationQueueManager || new AnimationQueueManager();
  
  // Also expose on SackBattle namespace for consistency
  if (!global.SackBattle) global.SackBattle = {};
  if (!global.SackBattle.utils) global.SackBattle.utils = {};
  global.SackBattle.utils.animationQueue = global.AnimationQueueManager;

})(typeof window !== 'undefined' ? window : globalThis);
