// src/utils/settingsSchema.js
// Centralized settings validation and migration

(function(global) {
  'use strict';

  if (global.SackBattle && global.SackBattle.utils.settings) return;

  // Ensure namespace exists
  if (!global.SackBattle) {
    global.SackBattle = { utils: {} };
  }
  if (!global.SackBattle.utils) {
    global.SackBattle.utils = {};
  }

  // Schema definition with validation rules
  const schema = {
    // Game mechanics
    turnLength: { 
      type: 'number', 
      min: 5, 
      max: 300, 
      default: 30,
      description: 'Length of each turn in seconds'
    },
    maxTurns: { 
      type: 'number', 
      min: 1, 
      max: 20, 
      default: 6,
      description: 'Maximum turns per match'
    },
    bossHp: { 
      type: 'number', 
      min: 1, 
      max: 10000, 
      default: 100,
      description: 'Boss health points'
    },
    powerfulAttackDamage: { 
      type: 'number', 
      min: 1, 
      max: 1000, 
      default: 30,
      description: 'Damage dealt by powerful attacks'
    },
    respawnMode: { 
      type: 'enum', 
      values: ['cooldown', 'matchend'], 
      default: 'cooldown',
      description: 'When players respawn after dying'
    },

    // Boss behavior
    bossProbabilities: {
      type: 'object',
      default: { growl: 0.15, attack: 0.45, cover: 0.15, charge: 0.25 },
      validate: (obj) => {
        if (!obj || typeof obj !== 'object') return false;
        const required = ['growl', 'attack', 'cover', 'charge'];
        return required.every(key => typeof obj[key] === 'number' && obj[key] >= 0);
      },
      description: 'Probability weights for boss actions'
    },

    // Arrays
    channelPointTriggers: { 
      type: 'array', 
      default: [],
      description: 'Channel point reward triggers'
    },
    bitsThresholds: { 
      type: 'array', 
      default: [],
      description: 'Bits threshold triggers'
    },
    bossPlaylist: { 
      type: 'array', 
      default: [],
      description: 'Boss rotation playlist'
    },
    rankDefinitions: {
      type: 'array',
      default: [
        { name: 'Rookie', wins: 0 },
        { name: 'Fighter', wins: 5 },
        { name: 'Warrior', wins: 10 },
        { name: 'Commander', wins: 20 }
      ],
      description: 'Player rank definitions'
    },

    // Strings
    bossName: { type: 'string', default: '', description: 'Current boss name' },
    bossImage: { type: 'string', default: '', description: 'Current boss image' },
    battlefieldImage: { type: 'string', default: '', description: 'Battlefield background' },
    rules: { 
      type: 'string', 
      default: 'Attack the boss, cover to block damage, heal to regain hearts. Use chat commands: !attack !cover !heal.',
      description: 'Game rules text'
    },

    // Twitch integration
    twitchClientId: { type: 'string', default: '', description: 'Twitch client ID' },
    twitchClientSecret: { type: 'string', default: '', description: 'Twitch client secret' },
    twitchBotUsername: { type: 'string', default: '', description: 'Twitch bot username' },
    twitchOauthToken: { type: 'string', default: '', description: 'Twitch OAuth token' },
    twitchChannel: { type: 'string', default: '', description: 'Twitch channel name' },
    twitchTokenScopes: { type: 'array', default: [], description: 'Twitch token scopes' },
    twitchTokenExpiresAt: { type: 'number', default: 0, description: 'Token expiration timestamp' },

    // YouTube integration
    youtubeApiKey: { type: 'string', default: '', description: 'YouTube Data API v3 key' },
    youtubeChannelId: { type: 'string', default: '', description: 'YouTube channel ID' },
    youtubeOAuthClientId: { type: 'string', default: '', description: 'YouTube OAuth Client ID' },
    youtubeOAuthClientSecret: { type: 'string', default: '', description: 'YouTube OAuth Client Secret' },
    youtubeOAuthTokens: { type: 'object', default: null, description: 'YouTube OAuth tokens' },

    // Discord integration
    discordBotToken: { type: 'string', default: '', description: 'Discord bot token' },
    discordChannelId: { type: 'string', default: '', description: 'Discord channel ID for commands' },

    // Chat commands
    chatCommands: {
      type: 'object',
      default: { attack: '!attack', cover: '!cover', heal: '!heal' },
      description: 'Chat command mappings'
    },

    // Assets
    waitingBackgroundImage: { type: 'string', default: '', description: 'Waiting room background' },
    waitingMainLogoImage: { type: 'string', default: '', description: 'Waiting room main logo' },
    waitingSecondaryLogoImage: { type: 'string', default: '', description: 'Waiting room secondary logo' },

    // Audio settings
    audioSettings: {
      type: 'object',
      default: {},
      description: 'Audio mixer settings'
    }
  };

  const settingsUtils = {
    // Validate a single setting value
    validateField(key, value) {
      const field = schema[key];
      if (!field) return { valid: false, error: `Unknown setting: ${key}` };

      // Type validation
      if (field.type === 'number') {
        const num = parseFloat(value);
        if (isNaN(num)) return { valid: false, error: `${key} must be a number` };
        if (field.min !== undefined && num < field.min) {
          return { valid: false, error: `${key} must be >= ${field.min}` };
        }
        if (field.max !== undefined && num > field.max) {
          return { valid: false, error: `${key} must be <= ${field.max}` };
        }
        return { valid: true, value: num };
      }

      if (field.type === 'string') {
        return { valid: true, value: String(value) };
      }

      if (field.type === 'array') {
        if (!Array.isArray(value)) {
          return { valid: false, error: `${key} must be an array` };
        }
        return { valid: true, value };
      }

      if (field.type === 'object') {
        if (typeof value !== 'object' || value === null) {
          return { valid: false, error: `${key} must be an object` };
        }
        if (field.validate && !field.validate(value)) {
          return { valid: false, error: `${key} failed custom validation` };
        }
        return { valid: true, value };
      }

      if (field.type === 'enum') {
        if (!field.values.includes(value)) {
          return { valid: false, error: `${key} must be one of: ${field.values.join(', ')}` };
        }
        return { valid: true, value };
      }

      return { valid: true, value };
    },

    // Validate and migrate entire settings object
    validateAndMigrate(rawSettings) {
      const result = {
        settings: {},
        errors: [],
        warnings: []
      };

      // Start with defaults
      Object.keys(schema).forEach(key => {
        result.settings[key] = schema[key].default;
      });

      // Debug OAuth fields during migration
      const oauthFields = ['youtubeOAuthClientId', 'youtubeOAuthClientSecret', 'youtubeOAuthTokens'];
      console.log('[SchemaDebug] validateAndMigrate input rawSettings OAuth:', 
        oauthFields.reduce((acc, field) => ({...acc, [field]: rawSettings?.[field]}), {}));

      // Apply and validate provided settings
      if (rawSettings && typeof rawSettings === 'object') {
        Object.entries(rawSettings).forEach(([key, value]) => {
          if (schema[key]) {
            const validation = this.validateField(key, value);
            if (validation.valid) {
              // Special debug for OAuth fields
              if (oauthFields.includes(key)) {
                console.log(`[SchemaDebug] Processing ${key}: original="${value}" validated="${validation.value}"`);
              }
              result.settings[key] = validation.value;
            } else {
              result.errors.push(validation.error);
              result.warnings.push(`Using default for ${key}: ${schema[key].default}`);
            }
          } else {
            // Preserve unknown settings but warn
            result.settings[key] = value;
            result.warnings.push(`Unknown setting preserved: ${key}`);
          }
        });
      }

      console.log('[SchemaDebug] validateAndMigrate output OAuth:', 
        oauthFields.reduce((acc, field) => ({...acc, [field]: result.settings[field]}), {}));

      return result;
    },

    // Get default settings
    getDefaults() {
      const defaults = {};
      Object.keys(schema).forEach(key => {
        defaults[key] = schema[key].default;
      });
      return defaults;
    },

    // Get schema for a field
    getFieldSchema(key) {
      return schema[key];
    },

    // Get all schema
    getSchema() {
      return { ...schema };
    },

    // Enhanced migration that handles version differences
    migrate(rawSettings, fromVersion = 1, toVersion = 2) {
      let migrated = { ...rawSettings };

      // Version 1 -> 2 migrations
      if (fromVersion < 2) {
        // Ensure arrays exist
        if (!Array.isArray(migrated.channelPointTriggers)) {
          migrated.channelPointTriggers = [];
        }
        if (!Array.isArray(migrated.bitsThresholds)) {
          migrated.bitsThresholds = [];
        }

        // Coerce numeric fields with bounds checking
        ['turnLength', 'maxTurns', 'powerfulAttackDamage', 'bossHp'].forEach(field => {
          if (migrated[field] != null) {
            const validation = this.validateField(field, migrated[field]);
            if (validation.valid) {
              migrated[field] = validation.value;
            } else {
              migrated[field] = schema[field].default;
            }
          }
        });

        // Normalize respawnMode
        if (!['cooldown', 'matchend'].includes(migrated.respawnMode)) {
          migrated.respawnMode = 'cooldown';
        }
      }

      return migrated;
    }
  };

  global.SackBattle.utils.settings = settingsUtils;

})(typeof window !== 'undefined' ? window : globalThis);
