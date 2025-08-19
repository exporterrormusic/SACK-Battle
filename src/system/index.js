// src/system/index.js
module.exports = {
  ...require('./settings'),
  ...require('./windowState'),
  ...require('./bossManifest'),
  ...require('./assetWatchers'),
  ...require('./health')
};
