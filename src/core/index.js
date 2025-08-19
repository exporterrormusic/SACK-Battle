// src/core/index.js
module.exports = {
  ...require('./constants'),
  ipcChannels: require('./ipcChannels'),
  logger: require('./logger')
};
