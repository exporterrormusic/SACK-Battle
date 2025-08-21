// src/index.js
// Main source index - useful for imports and testing
module.exports = {
  // Core modules
  core: require('./core'),
  constants: require('./constants'),
  
  // Major subsystems
  platforms: require('./platforms'),
  game: require('./game'),
  renderer: require('./renderer'),
  system: require('./system'),
  utils: require('./utils'),
  
  // Integration
  integration: require('./integration/backendSync')
};
