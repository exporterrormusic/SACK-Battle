// src/constants.js
// Project-wide constants and configuration
module.exports = {
  // Application info
  APP_NAME: 'SACK BATTLE',
  APP_VERSION: require('../package.json').version,
  
  // Window configuration
  DEFAULT_WINDOW: {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600
  },
  
  // File paths
  PATHS: {
    ASSETS: 'src/assets',
    CONFIG: 'src/config',
    LOGS: 'logs'
  },
  
  // Performance settings
  PERFORMANCE: {
    MAX_DEBUG_LOG_ENTRIES: 500,
    ASSET_WATCH_DEBOUNCE: 1000,
    HEALTH_CHECK_INTERVAL: 5000
  },
  
  // Re-export core constants
  ...require('./core/constants')
};
