// src/renderer/core/index.js
// Core renderer modules
module.exports = {
  bootstrap: require('./bootstrap'),
  coreWrappers: require('./coreWrappers'),
  domUtils: require('./domUtils'),
  eventBus: require('./eventBus'),
  memoryManager: require('./memoryManager'),
  performanceMonitor: require('./performanceMonitor'),
  stateManager: require('./stateManager'),
  utils: require('./utils')
};
