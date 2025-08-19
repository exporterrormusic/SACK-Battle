// src/core/logger.js
// Minimal structured logger; can be expanded later.
const levels = ['debug','info','warn','error'];
let currentLevelIndex = 0; // debug
function setLevel(l){
  const idx = levels.indexOf(l);
  if (idx !== -1) currentLevelIndex = idx;
}
function log(level, scope, message, extra){
  const idx = levels.indexOf(level);
  if (idx === -1 || idx < currentLevelIndex) return;
  const ts = new Date().toISOString();
  const payload = { ts, level, scope, message, ...(extra||{}) };
  // For now just console log. Could route to file/UI later.
  if (level === 'error') console.error('[LOG]', payload); else if (level === 'warn') console.warn('[LOG]', payload); else console.log('[LOG]', payload);
}
module.exports = {
  setLevel,
  debug: (s,m,e)=>log('debug',s,m,e),
  info: (s,m,e)=>log('info',s,m,e),
  warn: (s,m,e)=>log('warn',s,m,e),
  error: (s,m,e)=>log('error',s,m,e)
};
