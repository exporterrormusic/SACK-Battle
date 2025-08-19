// src/utils/audioHelper.js
// Centralized audio volume handling to eliminate duplication

(function(global) {
  'use strict';

  if (global.SackBattle && global.SackBattle.utils.audio) return;

  // Ensure namespace exists
  if (!global.SackBattle) {
    global.SackBattle = { utils: {} };
  }
  if (!global.SackBattle.utils) {
    global.SackBattle.utils = {};
  }

  const audioHelper = {
    // Create audio with proper volume handling
    createAudio(src, category = 'sfx', baseVolume = 1.0) {
      const audio = new Audio(src);
      this.setVolume(audio, category, baseVolume);
      return audio;
    },

    // Set volume using AudioMixer if available, fallback to direct setting
    setVolume(audio, category = 'sfx', baseVolume = 1.0) {
      if (global.__audioMixer && typeof global.__audioMixer.calculateCategoryVolume === 'function') {
        audio.volume = global.__audioMixer.calculateCategoryVolume(category, baseVolume);
      } else {
        // Fallback volume levels
        const categoryDefaults = {
          sfx: 0.8,
          music: 0.6,
          voice: 0.9
        };
        
        const categoryVolume = categoryDefaults[category] || 0.8;
        audio.volume = categoryVolume * baseVolume;
      }
    },

    // Play audio with proper volume
    async playAudio(src, category = 'sfx', baseVolume = 1.0) {
      try {
        const audio = this.createAudio(src, category, baseVolume);
        return await audio.play();
      } catch (error) {
        console.warn(`[AudioHelper] Failed to play ${src}:`, error);
        return null;
      }
    },

    // Play boss SFX with consistent volume handling
    playBossSfx(sfxKey, baseVolume = 0.8) {
      if (global.playBossSfx) {
        global.playBossSfx(sfxKey);
      } else {
        console.warn(`[AudioHelper] playBossSfx not available for ${sfxKey}`);
      }
    },

    // Update volume for existing audio elements
    updateVolume(audio, category = 'sfx', baseVolume = 1.0) {
      this.setVolume(audio, category, baseVolume);
    },

    // Get current volume for a category
    getCategoryVolume(category = 'sfx') {
      if (global.__audioMixer && typeof global.__audioMixer.calculateCategoryVolume === 'function') {
        return global.__audioMixer.calculateCategoryVolume(category, 1.0);
      } else {
        const categoryDefaults = {
          sfx: 0.8,
          music: 0.6,
          voice: 0.9
        };
        return categoryDefaults[category] || 0.8;
      }
    }
  };

  global.SackBattle.utils.audio = audioHelper;

})(typeof window !== 'undefined' ? window : globalThis);
