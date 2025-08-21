// src/renderer/game/index.js
// Game-related renderer modules
module.exports = {
  controls: require('./controls'),
  gameBindings: require('./gameBindings'),
  gameLoop: require('./gameLoop'),
  playerRender: require('./playerRender'),
  playerRenderOptimized: require('./playerRenderOptimized'),
  startController: require('./startController'),
  waitingRoom: require('./waitingRoom')
};
