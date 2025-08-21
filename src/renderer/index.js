// src/renderer/index.js
// Main renderer modules index
module.exports = {
  // Core modules
  core: require('./core'),
  
  // Subsystem modules
  audio: require('./audio'),
  data: require('./data'),
  effects: require('./effects'),
  game: require('./game'),
  platform: require('./platform'),
  settings: require('./settings'),
  tabs: require('./tabs'),
  ui: require('./ui')
};
