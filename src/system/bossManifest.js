// src/system/bossManifest.js
// Builds a manifest of bosses by scanning the assets/boss directory
const fs = require('fs');
const path = require('path');
const logger = require('../core/logger');

function buildBossManifest(baseDir = path.join(__dirname, '..', 'assets', 'boss')) {
  const manifest = [];
  try {
    if (!fs.existsSync(baseDir)) return manifest;
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    entries.filter(d => d.isDirectory()).forEach(dirEnt => {
      const folderName = dirEnt.name;
      const full = path.join(baseDir, folderName);
      const files = fs.readdirSync(full);
      const imageFile = files.find(f => /^portrait\.(png|jpg|jpeg|gif)$/i.test(f)) || files.find(f => /(png|jpg|jpeg|gif)$/i.test(f)) || null;
      const audio = {};
      const audioKeys = ['music','attack','charge','special','growl','cover','defeat','victory','cooldown'];
      audioKeys.forEach(k => {
        const found = files.find(f => new RegExp('^'+k+'\.(mp3|wav|ogg)$','i').test(f));
        if (found) audio[k] = 'app://' + path.join('assets','boss', folderName, found).replace(/\\/g,'/');
      });
      manifest.push({
        id: folderName,
        name: folderName.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
        folder: folderName,
        portrait: imageFile ? 'app://' + path.join('assets','boss', folderName, imageFile).replace(/\\/g,'/') : null,
        audio
      });
    });
  } catch(e) { logger.warn('bossManifest','build_failed',{ error: e.message }); }
  return manifest;
}
module.exports = { buildBossManifest };
