// src/core/registries.js
// Central registry system for game actions, boss moves, and animations
// This enables data-driven extensibility for new abilities and bosses

(function(global) {
  'use strict';

  // Ensure namespace exists but do NOT early return; attach registries if missing
  const SB = (global.SackBattle = global.SackBattle || {});
  SB.registries = SB.registries || {};
  SB.utils = SB.utils || {};
  SB.config = SB.config || {};
  SB.flags = SB.flags || { debug: false };

  // Player Action Registry
  const actionRegistry = SB.registries.__actions || new Map();
  const actionAliases = SB.registries.__actionAliases || new Map();

  SB.registries.actions = SB.registries.actions || {
    register(config) {
      if (!config || !config.id) {
        throw new Error('Action config requires id');
      }

      const action = {
        id: config.id,
        label: config.label || config.id,
        priority: config.priority || 0,
        canExecute: config.canExecute || (() => true),
        apply: config.apply || (() => {}),
        gaugeDelta: config.gaugeDelta || 0,
        selfDamage: config.selfDamage || 0,
        blockedByBossState: config.blockedByBossState || [],
        visualKey: config.visualKey || config.id,
        sfxKey: config.sfxKey || config.id
      };

      actionRegistry.set(config.id, action);

      // Register aliases
      if (config.aliases) {
        config.aliases.forEach(alias => {
          actionAliases.set(alias.toLowerCase(), config.id);
        });
      }

      return action;
    },

    get(id) {
      return actionRegistry.get(id);
    },

    getByAlias(alias) {
      const realId = actionAliases.get(alias.toLowerCase());
      return realId ? actionRegistry.get(realId) : null;
    },

    getAll() {
      return Array.from(actionRegistry.values()).sort((a, b) => b.priority - a.priority);
    },

    resolve(actionName) {
      return this.get(actionName) || this.getByAlias(actionName);
    }
  };
  // Persist internal maps on registries for reuse
  SB.registries.__actions = actionRegistry;
  SB.registries.__actionAliases = actionAliases;

  // Boss Move Registry
  const bossMovesRegistry = SB.registries.__bossMoves || new Map();

  SB.registries.bossMoves = SB.registries.bossMoves || {
    register(config) {
      if (!config || !config.id) {
        throw new Error('Boss move config requires id');
      }

      const move = {
        id: config.id,
        label: config.label || config.id,
        weight: config.weight || 0.1,
        sequence: config.sequence || [config.id],
        visualState: config.visualState || null,
        apply: config.apply || (() => {}),
        sfxKey: config.sfxKey || config.id
      };

      bossMovesRegistry.set(config.id, move);
      return move;
    },

    get(id) {
      return bossMovesRegistry.get(id);
    },

    getAll() {
      return Array.from(bossMovesRegistry.values());
    },

    getProbabilities() {
      const moves = this.getAll();
      const total = moves.reduce((sum, move) => sum + move.weight, 0);
      return moves.map(move => ({
        id: move.id,
        probability: total > 0 ? move.weight / total : 0
      }));
    },

    // Return a plain object of current weights for debugging/inspection
    getWeights() {
      const out = {};
      for (const [id, move] of bossMovesRegistry.entries()) out[id] = move.weight;
      return out;
    },

    selectRandomMove() {
      const moves = this.getAll();
      const totalWeight = moves.reduce((sum, move) => sum + move.weight, 0);
      
      if (totalWeight === 0) return null;
      
      // Optional debug log of weights and total
      try {
        const dbg = (SB.flags && SB.flags.debug) || global.__DEBUG_BOSS_PICK;
        if (dbg) {
          const weights = this.getWeights();
          console.log('[BossMoves.selectRandom] totalWeight=', totalWeight, 'weights=', weights);
        }
      } catch(_) {}

      let random = Math.random() * totalWeight;
      
      for (const move of moves) {
        random -= move.weight;
        if (random <= 0) {
          try {
            const dbg = (SB.flags && SB.flags.debug) || global.__DEBUG_BOSS_PICK;
            if (dbg) console.log('[BossMoves.selectRandom] picked=', move.id);
          } catch(_) {}
          return move;
        }
      }
      
      return moves[moves.length - 1]; // Fallback
    },

    // Update weights in bulk from a probabilities object {id: weight}
    setWeights(weights) {
      if (!weights || typeof weights !== 'object') return;
      Object.entries(weights).forEach(([id, w]) => {
        const move = bossMovesRegistry.get(id);
        if (move && typeof w === 'number') move.weight = w;
      });
    }
  };
  SB.registries.__bossMoves = bossMovesRegistry;

  // Animation Registry
  const animationRegistry = SB.registries.__animations || new Map();

  SB.registries.animations = SB.registries.animations || {
    register(key, config) {
      if (!key || !config) {
        throw new Error('Animation registration requires key and config');
      }

      const animation = {
        fx: config.fx || (() => {}),
        audioKey: config.audioKey || null,
        layer: config.layer || 'battlefield',
        duration: config.duration || 1000
      };

      animationRegistry.set(key, animation);
      return animation;
    },

    get(key) {
      return animationRegistry.get(key);
    },

    play(key, context = {}) {
      const animation = this.get(key);
      if (!animation) {
        console.warn(`[Animations] Unknown animation: ${key}`);
        return;
      }

      try {
        if (animation.fx) {
          animation.fx(context);
        }
        
        if (animation.audioKey && global.playBossSfx) {
          global.playBossSfx(animation.audioKey);
        }
      } catch (error) {
        console.error(`[Animations] Error playing ${key}:`, error);
      }
    }
  };
  SB.registries.__animations = animationRegistry;

  // Initialize default actions
  function initializeDefaultActions() {
  const { actions } = SB.registries;

    actions.register({
      id: 'attack',
      label: 'Attack',
      priority: 30,
      gaugeDelta: 1,
      visualKey: 'attack',
      sfxKey: 'attack',
      blockedByBossState: ['covered']
    });

    actions.register({
      id: 'cover',
      label: 'Cover',
      priority: 10,
      aliases: ['defend'],
      visualKey: 'cover'
    });

    actions.register({
      id: 'heal',
      label: 'Heal',
      priority: 20,
      visualKey: 'heal'
    });

    actions.register({
      id: 'strike',
      label: 'Strike',
      priority: 40,
      aliases: ['aggressive'],
      gaugeDelta: 2,
      selfDamage: 1,
      visualKey: 'strike',
      sfxKey: 'attack'
    });

    actions.register({
      id: 'burst',
      label: 'Burst',
      priority: 50,
      canExecute: (state, player) => player.burstGauge >= 5,
      visualKey: 'burst',
      sfxKey: 'burst'
    });
  }

  // Initialize default boss moves
  function initializeDefaultBossMoves() {
  const { bossMoves } = SB.registries;

    bossMoves.register({
      id: 'growl',
      label: 'Growl',
      weight: 0.15,
      sfxKey: 'growl'
    });

    bossMoves.register({
      id: 'attack',
      label: 'Attack',
      weight: 0.45,
      sfxKey: 'attack'
    });

    bossMoves.register({
      id: 'cover',
      label: 'Cover',
      weight: 0.15,
      visualState: 'covered',
      sfxKey: 'cover'
    });

    bossMoves.register({
      id: 'charge',
      label: 'Charge',
      weight: 0.25,
      sequence: ['charge', 'special', 'cooldown'],
      visualState: 'charging',
      sfxKey: 'charge'
    });

    bossMoves.register({
      id: 'special',
      label: 'Special Attack',
      weight: 0,
      visualState: 'exhausted',
      sfxKey: 'special'
    });

    bossMoves.register({
      id: 'cooldown',
      label: 'Cooldown',
      weight: 0,
      visualState: 'cooldown'
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeDefaultActions();
      initializeDefaultBossMoves();
    });
  } else {
    initializeDefaultActions();
    initializeDefaultBossMoves();
  }

})(typeof window !== 'undefined' ? window : globalThis);
