// src/game/index.js
// Central export for game logic modules
module.exports = {
  gameState: require('./gameState'),
  gameInit: require('./gameInit'),
  gameStateMigration: require('./gameStateMigration'),
  buffSystem: require('./buffSystem'),
  actionProcessor: require('./actionProcessor')
};
