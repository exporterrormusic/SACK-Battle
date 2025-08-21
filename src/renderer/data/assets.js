// assets.js - centralized asset loading & live updates
(function(global){
  const api = global.electronAPI || {};
  let avatars=[], bosses=[], battlefields=[]; let selectedBattlefield=null, selectedBoss=null;
  // Randomizer state
  let _randomizeTimer = null;
  let _randomizeIntervalMs = 15000; // default 15s
  let _randomizeEnabled = false; // tracks desired enabled state
  let _lastObservedBossId = null;
  let _lastGameRunning = false; // tracks when game starts/stops
  Object.defineProperties(global, {
    __avatarsList:{ get:()=>avatars, set:v=>{ avatars=Array.isArray(v)?v:[]; }},
    __bossImagesList:{ get:()=>bosses, set:v=>{ bosses=Array.isArray(v)?v:[]; }},
    __battlefieldImagesList:{ get:()=>battlefields, set:v=>{ battlefields=Array.isArray(v)?v:[]; }},
    selectedBattlefield:{ get:()=>selectedBattlefield, set:v=>{ selectedBattlefield=v; }},
    selectedBoss:{ get:()=>selectedBoss, set:v=>{ selectedBoss=v; }}
  });
  function populateSelect(sel,list){ if(!sel) return; sel.innerHTML=''; list.forEach(f=>{ const o=document.createElement('option'); o.value=f; o.textContent=f; sel.appendChild(o); }); }
  global.populateSelect = global.populateSelect || populateSelect;

  function _chooseRandomBattlefield(){
    if (!Array.isArray(battlefields) || battlefields.length === 0) return null;
    if (battlefields.length === 1) return battlefields[0];
    let idx = Math.floor(Math.random() * battlefields.length);
    let attempts = 8;
    while (battlefields[idx] === selectedBattlefield && attempts-- > 0) {
      idx = Math.floor(Math.random() * battlefields.length);
    }
    return battlefields[idx];
  }

  function _startRandomizer(){
  if (_randomizeTimer) return;
    _randomizeTimer = setInterval(()=>{
      try {
        const pick = _chooseRandomBattlefield();
        if (pick && pick !== selectedBattlefield) {
          selectedBattlefield = pick;
          const bfSel = document.getElementById('input-battlefield-bg'); if (bfSel) bfSel.value = pick;
          if (typeof global.updateBattlefield === 'function') global.updateBattlefield(pick);
        }
      } catch(e){ console.warn('[Assets][Randomizer] Error during cycle', e); }
    }, _randomizeIntervalMs);
    console.log('[Assets] Random battlefield cycling started, interval(ms):', _randomizeIntervalMs);
  }

  function _stopRandomizer(){ if (_randomizeTimer) { clearInterval(_randomizeTimer); _randomizeTimer=null; console.log('[Assets] Random battlefield cycling stopped'); } }

  function setRandomizeBattlefield(enabled, intervalMs){
    _randomizeEnabled = !!enabled;
    // Stop any existing timer since we only randomize on game start now
    _stopRandomizer();
    // Don't pick immediately when enabling from settings - only when game starts
    console.log('[Assets] Randomize battlefield setting changed to:', enabled);
  }
  global.setRandomizeBattlefield = setRandomizeBattlefield;
  async function load(){
    try {
      avatars = await api.getAssetsList?.('avatars') || [];
      bosses = await api.getAssetsList?.('boss') || [];
      battlefields = await api.getAssetsList?.('battlefield') || [];
      try { global.bossManifest = await api.getBossManifest(); } catch(_){ global.bossManifest=[]; }
    } catch(e){ console.warn('[assets] load failed', e); avatars=bosses=battlefields=[]; }
    const png= f=>/\.(png|jpg|jpeg|gif)$/i.test(f);
    // Avatars now come as "folder/file.png" so they already pass the PNG test
    // bosses and battlefields are still direct files
    bosses=bosses.filter(png); battlefields=battlefields.filter(png);
    const bfSel=document.getElementById('input-battlefield-bg');
    populateSelect(bfSel,battlefields);
    // If a persisted value exists, use it; otherwise, default to first
    if(global.selectedBattlefield && battlefields.includes(global.selectedBattlefield)) {
      selectedBattlefield = global.selectedBattlefield;
      if(bfSel) bfSel.value = selectedBattlefield;
    } else {
      selectedBattlefield = battlefields[0]||null;
      if(bfSel) bfSel.value = selectedBattlefield;
    }
    // Always update the battlefield background image immediately on load
    if (typeof global.updateBattlefield === 'function' && selectedBattlefield) {
      global.updateBattlefield(selectedBattlefield);
    }
    // If settings indicate randomized battlefield, enable the feature (but don't start timer)
    try {
      const gs = global.Game && typeof global.Game.getState === 'function' ? global.Game.getState() : null;
      const enabled = !!(gs && gs.settings && gs.settings.style && gs.settings.style.randomizeBattlefield);
      if (enabled) _randomizeEnabled = true;
    } catch(_) {}
    const manifestSelect=document.getElementById('boss-manifest-select'); if(manifestSelect){ manifestSelect.innerHTML=''; (global.bossManifest||[]).forEach(b=>{ const opt=document.createElement('option'); opt.value=b.id; opt.textContent=b.name; manifestSelect.appendChild(opt); }); }
    if (global.__playlist?.onManifestLoaded) try { global.__playlist.onManifestLoaded(); } catch(_) { }
  }
  if (api.onAssetsUpdated){
    api.onAssetsUpdated(payload=>{ if(!payload||!payload.folder||!Array.isArray(payload.files)) return; 
      if(payload.folder==='avatars'){ 
        // Avatar files come as "folder/file.png" format, no need to filter
        avatars=payload.files; 
      }
      else { 
        const pngs=payload.files.filter(f=>/\.(png|jpg|jpeg|gif)$/i.test(f));
        if(payload.folder==='boss'){ bosses=pngs; if(!bosses.includes(selectedBoss)) selectedBoss=bosses[0]||null; global.updateBossUI && global.updateBossUI(global.Game?.getState()?.boss); }
        else if(payload.folder==='battlefield'){ battlefields=pngs; populateSelect(document.getElementById('input-battlefield-bg'), battlefields); if(!battlefields.includes(selectedBattlefield)) selectedBattlefield=battlefields[0]||null; if(selectedBattlefield) global.updateBattlefield && global.updateBattlefield(selectedBattlefield); }
      }
    });
  }
  document.addEventListener('DOMContentLoaded', load);

  // React to game starts: hook into Game.start to detect when games actually start
  try {
    if (global.Game && typeof global.Game.start === 'function') {
      // Save the original Game.start function
      const originalGameStart = global.Game.start;
      
      // Replace it with our wrapper that includes battlefield randomization
      global.Game.start = function() {
        console.log('[Assets] Game.start() called, checking if should randomize battlefield');
        
        // Check if randomization is enabled
        const gs = global.Game && typeof global.Game.getState === 'function' ? global.Game.getState() : null;
        const enabled = _randomizeEnabled || !!(gs && gs.settings && gs.settings.style && gs.settings.style.randomizeBattlefield);
        
        if (enabled) {
          try {
            const pick = _chooseRandomBattlefield();
            if (pick && pick !== selectedBattlefield) {
              selectedBattlefield = pick;
              const bfSel = document.getElementById('input-battlefield-bg'); if (bfSel) bfSel.value = pick;
              if (typeof global.updateBattlefield === 'function') global.updateBattlefield(pick);
              console.log('[Assets] Randomized battlefield on Game.start():', pick);
            }
          } catch(e){ console.warn('[Assets] Failed to pick battlefield on Game.start()', e); }
        }
        
        // Call the original Game.start function
        return originalGameStart.apply(this, arguments);
      };
    }
  } catch(_){}

  // Keep the old listener for boss tracking (simplified)
  try {
    if (global.Game && typeof global.Game.onUpdate === 'function') {
      global.Game.onUpdate((publicState) => {
        try {
          const bossId = (publicState && publicState.boss && (publicState.boss.name || publicState.boss.imageSrc)) || null;
          
          if (bossId && _lastObservedBossId !== bossId) {
            console.log('[Assets] Boss change detected:', { from: _lastObservedBossId, to: bossId });
            _lastObservedBossId = bossId;
          }
        } catch(_){}
      });
    }
  } catch(_){}
})(typeof window!=='undefined'?window:globalThis);
