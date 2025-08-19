// src/renderer/coreWrappers.js
// Early lightweight wrappers so downstream modules have stable globals.
(function(global){
  if (global.__earlyWrappers) return;
  function log(msg, extra){ try { console.log('[CoreWrappers]', msg, extra||''); } catch(_){} }
  global.updateBattlefield = function(selected){
    try {
      if (global.__bossUI && global.__bossUI.updateBattlefield){
        return global.__bossUI.updateBattlefield(selected || global.selectedBattlefield || (global.__battlefieldImagesList && global.__battlefieldImagesList[0]));
      }
      const img = document.getElementById('battlefield-bg');
      const val = selected || global.selectedBattlefield;
      if (img && val){ img.src = val.startsWith('app://') ? val : `app://assets/battlefield/${val}`; }
    } catch(e){ log('updateBattlefield error', e); }
  };
  global.updateBossUI = function(bossState){
    try {
      if (global.__bossUI && global.__bossUI.updateBossUI){ return global.__bossUI.updateBossUI(bossState); }
      if (!bossState) return;
      const nameEl = document.getElementById('boss-name');
      if (nameEl && bossState.name) nameEl.textContent = bossState.name;
      const hpEl = document.getElementById('boss-hp'); if (hpEl && typeof bossState.hp==='number') hpEl.textContent = bossState.hp;
    } catch(e){ log('updateBossUI error', e); }
  };
  if (!global.addBuffIcon) global.addBuffIcon = function(){};
  if (!global.updateBuffIconTimers) global.updateBuffIconTimers = function(){};
  // Upgrade stubs when buffs module arrives
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(()=>{
      if (global.__buffsModule){
        if (global.__buffsModule.addBuffIcon) global.addBuffIcon = global.__buffsModule.addBuffIcon;
        if (global.__buffsModule.updateBuffIconTimers) global.updateBuffIconTimers = global.__buffsModule.updateBuffIconTimers;
        console.log('[CoreWrappers] Upgraded buff icon functions');
      }
    }, 0);
  });
  // Debug helper to inspect buff bar
  global.__dumpBuffBar = function(){ const bar=document.getElementById('buff-bar'); if(!bar){ console.log('[BuffBar] missing element'); return; } console.log('[BuffBar] children', bar.children.length, Array.from(bar.children).map(n=>({cls:n.className, key:n.dataset&&n.dataset.key}))); };
  global.__earlyWrappers = true;
})(typeof window !== 'undefined' ? window : globalThis);
