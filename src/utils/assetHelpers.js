// src/utils/assetHelpers.js
// Centralized asset path helpers and simple caching

(function(global) {
  'use strict';

  if (global.SackBattle && global.SackBattle.utils.assets) return;

  // Ensure namespace exists
  if (!global.SackBattle) {
    global.SackBattle = { utils: {} };
  }
  if (!global.SackBattle.utils) {
    global.SackBattle.utils = {};
  }

  const assetCache = new Map();

  const assets = {
    // Get standardized asset path
    getPath(type, id, file = null) {
      if (file) {
        return `app://assets/${type}/${id}/${file}`;
      }
      return `app://assets/${type}/${id}`;
    },

    // Get boss asset path
    getBossPath(bossId, file) {
      return this.getPath('boss', bossId, file);
    },

    // Get avatar asset path
    getAvatarPath(avatarId, file = null) {
      if (file) {
        return this.getPath('avatars', avatarId, file);
      }
      // Handle the current "folder/file.png" format
      if (avatarId.includes('/')) {
        return `app://assets/avatars/${avatarId}`;
      }
      return `app://assets/avatars/${avatarId}/${avatarId}.png`;
    },

    // Get battlefield asset path
    getBattlefieldPath(battlefieldFile) {
      if (battlefieldFile.startsWith('app://')) {
        return battlefieldFile;
      }
      return `app://assets/battlefield/${battlefieldFile}`;
    },

    // Cache management
    cache: {
      set(key, value) {
        assetCache.set(key, value);
      },

      get(key) {
        return assetCache.get(key);
      },

      has(key) {
        return assetCache.has(key);
      },

      clear() {
        assetCache.clear();
      },

      size() {
        return assetCache.size;
      }
    },

    // Preload an asset with caching
    async preload(path, type = 'image') {
      if (this.cache.has(path)) {
        return this.cache.get(path);
      }

      try {
        let asset;
        if (type === 'image') {
          asset = new Image();
          asset.src = path;
          await new Promise((resolve, reject) => {
            asset.onload = resolve;
            asset.onerror = reject;
          });
        } else if (type === 'audio') {
          // Prefer centralized audio helper to ensure consistent category volume later
          if (global.SackBattle?.utils?.audio) {
            asset = global.SackBattle.utils.audio.createAudio(path, 'sfx', 1.0);
          } else {
            asset = new Audio(path);
          }
          await new Promise((resolve, reject) => {
            asset.oncanplaythrough = resolve;
            asset.onerror = reject;
          });
        }

        this.cache.set(path, asset);
        return asset;
      } catch (error) {
        console.warn(`[Assets] Failed to preload ${path}:`, error);
        return null;
      }
    },

    // Batch preload assets
    async preloadBatch(paths, type = 'image') {
      const promises = paths.map(path => this.preload(path, type));
      return Promise.allSettled(promises);
    }
  };

  global.SackBattle.utils.assets = assets;

})(typeof window !== 'undefined' ? window : globalThis);
