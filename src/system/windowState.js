// src/system/windowState.js
// Window size/position persistence helpers extracted from main.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function windowStateFile(){
  return path.join(app.getPath('userData'), 'window-state.json');
}
function readWindowState(){
  try { if (fs.existsSync(windowStateFile())) return JSON.parse(fs.readFileSync(windowStateFile(),'utf8')); } catch(e){ /* ignore */ }
  return null;
}
function writeWindowState(data){
  try { fs.writeFileSync(windowStateFile(), JSON.stringify(data,null,2),'utf8'); } catch(e){ /* ignore */ }
}
module.exports = { windowStateFile, readWindowState, writeWindowState };
