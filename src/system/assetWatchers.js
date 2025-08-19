// src/system/assetWatchers.js
// Asset folder reading & watch logic extracted from main.js
const fs = require('fs');
const path = require('path');
const { buildBossManifest } = require('./bossManifest');
const logger = require('../core/logger');

let assetWatchers = [];

function readAssetFolder(folder) {
  try {
    const assetsPath = path.join(__dirname, '..', 'assets', folder);
    const files = fs.readdirSync(assetsPath);
    
    // For avatar folders, look for subfolder structure (foldername/foldername.png)
    if (folder === 'avatars') {
      let result = [];
      for (const file of files) {
        const subPath = path.join(assetsPath, file);
        try {
          const stats = fs.statSync(subPath);
          if (stats.isDirectory()) {
            // Look for image files in the subfolder
            const subFiles = fs.readdirSync(subPath);
            const imageFiles = subFiles.filter(subFile => {
              return /\.(png|jpg|jpeg|gif)$/i.test(subFile);
            });
            
            // Add files in format "foldername/filename.png"
            imageFiles.forEach(imageFile => {
              result.push(`${file}/${imageFile}`);
            });
          }
        } catch(subE) {
          // Skip files that can't be read
        }
      }
      return result;
    } else {
      // For other asset folders, look for image files directly
      return files.filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f));
    }
  } catch(e) { return []; }
}

function sendAllAssetLists(win) {
  ['avatars','boss','battlefield'].forEach(folder => {
    const list = readAssetFolder(folder);
    logger.debug('assets','initial_list',{ folder, count: list.length });
    win.webContents.send('assets-updated', { folder, files: list });
  });
  const manifest = buildBossManifest();
  logger.debug('assets','boss_manifest_initial',{ count: Array.isArray(manifest)?manifest.length:0 });
  win.webContents.send('boss-manifest', manifest);
}

function startAssetWatchers(win) {
  // Clear existing
  assetWatchers.forEach(w => { try { w.close(); } catch(_){} });
  assetWatchers = [];
  const folders = ['avatars','boss','battlefield'];
  folders.forEach(folder => {
    const dirPath = path.join(__dirname, '..', 'assets', folder);
    try {
      if (!fs.existsSync(dirPath)) { logger.warn('assets','watch_skip_missing',{ folder }); return; }
      const watcher = fs.watch(dirPath, { persistent: true }, (eventType, filename) => {
        if (!filename) return;
        if (!startAssetWatchers._timers) startAssetWatchers._timers = {};
        clearTimeout(startAssetWatchers._timers[folder]);
        startAssetWatchers._timers[folder] = setTimeout(() => {
          const list = readAssetFolder(folder);
          logger.debug('assets','change',{ folder, eventType, file: filename, count: list.length });
          win.webContents.send('assets-updated', { folder, files: list });
        }, 120);
      });
      logger.info('assets','watch_started',{ folder });
      assetWatchers.push(watcher);
    } catch(e) { logger.warn('assets','watch_failed',{ folder, error: e.message }); }
  });
  sendAllAssetLists(win);
}

function stopAssetWatchers(){
  assetWatchers.forEach(w => { try { w.close(); } catch(_){} });
  const count = assetWatchers.length;
  assetWatchers = [];
  logger.info('assets','watchers_stopped',{ count });
}

module.exports = { startAssetWatchers, stopAssetWatchers, readAssetFolder, sendAllAssetLists };
