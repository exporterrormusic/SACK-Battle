// src/renderer/buffs.js
// Extracted buff animation & icon logic from monolithic renderer.js (no require; uses global event bus)
(function(global){
  const emit = (global.__eventBus && global.__eventBus.emit) ? global.__eventBus.emit : ()=>{};
  const on = (global.__eventBus && global.__eventBus.on) ? global.__eventBus.on : ()=>()=>{};

const BUFF_ICON_META = {
  massheal: { cls:'heal', label:'Heal Buff Used', iconFolder:'rapunzel' },
  reviveall: { cls:'revive', label:'Revive All', iconFolder:'rapunzel' },
  powerfulattack: { cls:'power', label:'Power Attack', iconFolder:'snowwhite' },
  attackup: { cls:'attackup', label:'Attack Up', iconFolder:'crown' }
};

const CHAT_BUFF_NAMES = {
  powerfulattack: 'SEVEN DWARVES',
  massheal: 'GARDEN OF SHANGRI LA',
  reviveall: 'GARDEN OF SHANGRI LA',
  attackup: 'LIGHT OF THE KINGDOM'
};

const _BUFF_BURST_DURATION_MS = 3200;
const _BUFF_MAX_ACTIVE = 8;
const _BUFF_FOLDER_MAP = {
  massheal:'rapunzel',
  reviveall:'rapunzel',
  powerfulattack:'snowwhite', powerattack:'snowwhite', powerful:'snowwhite',
  attackup:'crown', atkup:'crown', attackboost:'crown'
};
const _BUFF_AUDIO_CACHE = {};

function _buffEnsureLayer(){
  let host = document.getElementById('players-container');
  if (!host) host = document.body;
  if (!host._buffStage){
    const stage = document.createElement('div');
    stage.className='buff-anim-stage';
    Object.assign(stage.style, { position:'absolute', left:'0', top:'0', width:'100%', height:'100%', pointerEvents:'none', overflow:'visible', zIndex:'50' });
    host.appendChild(stage); host._buffStage = stage;
    if (getComputedStyle(host).position === 'static') host.style.position='relative';
  }
  return host._buffStage;
}
function _buffPreloadAudio(folder){
  if (_BUFF_AUDIO_CACHE[folder]) return _BUFF_AUDIO_CACHE[folder];
  let aud;
  const src = `app://assets/powers/${folder}/burst.mp3`;
  if (window.SackBattle?.utils?.audio) {
    aud = window.SackBattle.utils.audio.createAudio(src, 'sfx', 0.9);
  } else {
    aud = new Audio(src);
    aud.loop = false;
    // Use AudioMixer for volume instead of hardcoded value
    if (window.__audioMixer) {
      aud.volume = window.__audioMixer.calculateCategoryVolume('sfx');
    } else {
      aud.volume = 0.9; // Fallback if AudioMixer not available
    }
  }
  aud.preload='auto'; 
  aud.loop=false; 
  _BUFF_AUDIO_CACHE[folder]=aud; 
  return aud;
}
function _createVisual(folder){
  const wrap = document.createElement('div');
  wrap.className = 'buff-anim buff-' + folder;
  Object.assign(wrap.style, { position:'absolute', left:'0', top:'50%', transform:'translateY(-50%)', width:'100%', display:'flex', alignItems:'center', justifyContent:'flex-start', gap:'0' });
  const img = document.createElement('img'); img.className='buff-burst'; img.draggable=false; img.alt=''; img.src = `app://assets/powers/${folder}/burst.png`; wrap.appendChild(img);
  if (folder==='rapunzel') {
    for (let i=0;i<8;i++){ const r=document.createElement('span'); r.className='ray'; r.style.setProperty('--ri', i); wrap.appendChild(r);}    
  } else if (folder==='snowwhite') {
    const positions=[8,20,32,44,56,68,16,28,40,52,64,24,36,48,60,72];
    positions.forEach((p,idx)=>{ const f=document.createElement('span'); f.className='flake'; f.style.left=p+'%'; f.style.fontSize=(10 + (idx%4)*4)+'px'; wrap.appendChild(f); });
  } else { // crown sparkles
    const coords=[[18,18],[32,24],[46,20],[60,26],[24,46],[40,50],[56,44],[30,66],[48,64],[66,58],[20,34],[62,38]];
    coords.forEach(([x,y])=>{ const s=document.createElement('span'); s.className='sparkle'; s.style.left=x+'%'; s.style.top=y+'%'; wrap.appendChild(s); });
  }
  return wrap;
}
function playBuffAnimation(rawKey){
  try {
    const key = (rawKey||'').toLowerCase();
    const folder = _BUFF_FOLDER_MAP[key] || 'crown';
    const stage = _buffEnsureLayer(); if (!stage) { console.warn('[Buffs] no stage'); return; }
    const active = stage.querySelectorAll('.buff-anim');
    if (active.length >= _BUFF_MAX_ACTIVE){ if (stage.firstChild) stage.firstChild.remove(); }
    const node = _createVisual(folder);
    node.dataset.buff = key; node.dataset.ts = Date.now();
    const burst = node.querySelector('.buff-burst');
    if (burst){ burst.style.animation='none'; void burst.offsetWidth; burst.style.animation='buffUnified 3.2s ease-in-out forwards'; }
    stage.appendChild(node); void node.offsetWidth; node.classList.add('active');
    const lifespan = _BUFF_BURST_DURATION_MS;
    setTimeout(()=>{ node.classList.add('buff-anim-fade'); setTimeout(()=> node.remove(), 450); }, lifespan);
    try { const aud = _buffPreloadAudio(folder); aud.currentTime = 0; aud.play().catch(()=>{}); } catch(_){ }
  } catch(err){ console.warn('[Buffs] animation error', err); }
}

function getBuffBar(){ return document.getElementById('buff-bar'); }
function ensureBuffIcon(key){
  const bar = getBuffBar(); if(!bar) return;
  const meta = BUFF_ICON_META[key]; if(!meta) return;
  let icon = bar.querySelector(`.buff-icon[data-key="${key}"]`);
  if (!icon){
    icon = document.createElement('div'); icon.className = 'buff-icon '+meta.cls; icon.dataset.key = key; icon.title = meta.label;
    const img = document.createElement('img'); img.src = `app://assets/powers/${meta.iconFolder}/burst.png`; img.alt = meta.label; icon.appendChild(img);
    const timer = document.createElement('div'); timer.className='buff-timer'; icon.appendChild(timer);
    bar.appendChild(icon);
  }
  return icon;
}
function updateBuffIconTimers(state){
  try {
    const bar = getBuffBar(); if(!bar) return; const s = state || (window.Game && window.Game.getState ? window.Game.getState() : null); if(!s) return;
    bar.querySelectorAll('.buff-icon').forEach(icon=>{
      const key = icon.dataset.key;
      if (key==='powerfulattack') { icon.removeAttribute('data-rem'); icon.removeAttribute('data-active'); }
      else if (key==='attackup') { const rem = Number(s.attackUpTurns||0); const badge = rem>0?String(rem):(rem===0?'0':'-'); icon.dataset.rem = badge; icon.dataset.active = '1'; }
      else if (key==='massheal') { let maxInv=0; try { Object.values(s.players||{}).forEach(p=>{ if(p && p.hp>0 && p.invincibleTurns>maxInv) maxInv=p.invincibleTurns; }); } catch(_){} const badge = maxInv>0?String(maxInv):(maxInv===0?'0':'-'); icon.dataset.rem=badge; icon.dataset.active='1'; }
      else { icon.removeAttribute('data-rem'); icon.removeAttribute('data-active'); }
    });
  } catch(e){ console.warn('[Buffs] updateBuffIconTimers error', e); }
}
function addBuffIcon(key, gameState){
  const before = document.querySelectorAll('#buff-bar .buff-icon').length;
  const icon = ensureBuffIcon(key);
  const after = document.querySelectorAll('#buff-bar .buff-icon').length;
  if (after>before) console.log('[BuffBar] icon added', key);
  updateBuffIconTimers(gameState);
}

// Public API
  const api = { playBuffAnimation, addBuffIcon, updateBuffIconTimers, CHAT_BUFF_NAMES };
  global.__buffsModule = api;
  if (!global.addBuffIcon) global.addBuffIcon = addBuffIcon; // ensure BuffSystem sees it
  if (!global.updateBuffIconTimers) global.updateBuffIconTimers = updateBuffIconTimers;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
