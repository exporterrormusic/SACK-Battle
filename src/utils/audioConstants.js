// src/utils/audioConstants.js
// Centralized audio constants to eliminate magic numbers throughout the codebase

(function(global) {
  'use strict';

  // Default volume levels for different audio types
  const AUDIO_CONSTANTS = {
    // Base volume levels - increased to allow max user volume to reach 100%
    DEFAULT_SFX_VOLUME: 1.0,
    DEFAULT_MUSIC_VOLUME: 0.8,
    
    // Specific effect volumes - increased to allow full volume potential
    BUFF_BURST_VOLUME: 1.0,
    BURST_ATTACK_VOLUME: 1.0,
    BOSS_SFX_VOLUME: 0.9,
    UI_FEEDBACK_VOLUME: 0.9,
    
    // Volume ranges
    MIN_VOLUME: 0.0,
    MAX_VOLUME: 1.0,
    
    // Audio categories
    CATEGORIES: {
      SFX: 'sfx',
      MUSIC: 'music'
    },
    
    // File extensions to try in order
    AUDIO_EXTENSIONS: ['mp3', 'wav', 'ogg'],
    
    // Default audio settings - updated for better volume range
    DEFAULT_SETTINGS: {
      sfxVolume: 0.8,
      musicVolume: 0.6,
      loop: false,
      preload: 'auto'
    }
  };

  // Expose constants globally
  global.AUDIO_CONSTANTS = AUDIO_CONSTANTS;
  
  // Unified audio creation helper function
  global.createAudioWithVolume = function(src, category = 'sfx', baseVolume = null, options = {}) {
    const constants = global.AUDIO_CONSTANTS || {};
    
    // Determine default volume based on category if not provided
    if (baseVolume === null) {
      if (category === constants.CATEGORIES?.MUSIC || category === 'music') {
        baseVolume = constants.DEFAULT_MUSIC_VOLUME || 0.8;
      } else {
        baseVolume = constants.DEFAULT_SFX_VOLUME || 1.0;
      }
    }
    
    // Try centralized audio helper first
    if (global.SackBattle?.utils?.audio) {
      return global.SackBattle.utils.audio.createAudio(src, category, baseVolume);
    }
    
    // Fallback to manual creation
    const audio = new Audio(src);
    audio.loop = options.loop || false;
    audio.preload = options.preload || 'auto';
    
    // Apply volume using mixer if available, otherwise direct
    if (global.__audioMixer && typeof global.__audioMixer.calculateCategoryVolume === 'function') {
      audio.volume = global.__audioMixer.calculateCategoryVolume(category, baseVolume);
    } else {
      audio.volume = Math.max(0, Math.min(1, baseVolume));
    }
    
    // Store original volume for potential updates
    if (audio.dataset) {
      audio.dataset.originalVolume = baseVolume.toString();
      audio.dataset.category = category;
    }
    
    return audio;
  };
  
  // Also expose on SackBattle namespace for consistency
  if (!global.SackBattle) global.SackBattle = {};
  if (!global.SackBattle.constants) global.SackBattle.constants = {};
  global.SackBattle.constants.audio = AUDIO_CONSTANTS;

})(typeof window !== 'undefined' ? window : globalThis);
