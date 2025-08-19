// buffSystem.js (moved from project root)
// Modular, data-driven buff system replacing ad-hoc logic previously in renderer.js
(function(window){
  const Game = window.Game;
  const electronAPI = window.electronAPI || {};
  if (!Game) { console.warn('[BuffSystem] Game not ready'); }

  const REGISTRY = {};
  const NORMALIZE_MAP = {};
  function register(def){
    if (!def || !def.id) throw new Error('Buff definition requires id');
    const id = def.id.toLowerCase();
    def.id = id;
    REGISTRY[id] = Object.assign({
      label: id,
      singleUsePerMatch: true,
      deferIfNotRunning: true,
      announceName: id.toUpperCase(),
      folder: 'crown',
      iconFolder: 'crown',
      effect: ()=>{},
      timerProvider: null,
      applyArgs: [],
    }, def);
    (def.aliases||[]).concat([id]).forEach(k=>{ NORMALIZE_MAP[k.toLowerCase()] = id; });
    return REGISTRY[id];
  }
  function normalize(raw){ return NORMALIZE_MAP[(raw||'').toLowerCase()] || null; }

  const state = { usedThisMatch: new Set(), deferred: [], lastCompletedMatches: null, lastRunning: false, matchIndex: null };

  const MAX_ACTIVE = 6;
  const DURATION_MS = 2600;
  
  // Animation queue system
  const animationQueue = [];
  let isPlayingAnimation = false;
  
  function processAnimationQueue() {
    if (isPlayingAnimation || animationQueue.length === 0) return;
    
    isPlayingAnimation = true;
    const buffId = animationQueue.shift();
    
    console.log('[BuffSystem] Starting queued animation', { buffId, queueLength: animationQueue.length });
    playAnimationInternal(buffId);
  }
  
  function queueAnimation(buffId) {
    animationQueue.push(buffId);
    console.log('[BuffSystem] Queued animation', { buffId, queueLength: animationQueue.length });
    processAnimationQueue();
  }
  function ensureStage(){
    let host = document.getElementById('players-container') || document.body;
    let stage = document.getElementById('buff-anim-layer');
    if (!stage || !stage.parentNode || stage.parentNode !== host) {
      if (stage && stage.parentNode) stage.parentNode.removeChild(stage);
      stage = document.createElement('div');
      stage.className = 'buff-anim-stage';
      stage.id = 'buff-anim-layer';
      Object.assign(stage.style, { position:'absolute', left:'0', top:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:500, overflow:'visible', display:'block' });
      if (getComputedStyle(host).position === 'static') host.style.position='relative';
      host.appendChild(stage);
    }
    return stage;
  }
  function createVisual(folder){
    const host = document.createElement('div');
    host.className = 'buff-anim-waapi buff-'+folder;
    Object.assign(host.style, { position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', width:'340px', maxWidth:'28vw', aspectRatio:'1 / 1', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', filter:'drop-shadow(0 0 26px rgba(255,255,255,0.6))', zIndex:20, overflow:'visible' });
    const img = document.createElement('img');
    img.className = 'buff-burst';
    img.src = `app://assets/powers/${folder}/burst.png`;
    Object.assign(img.style, { width:'100%', height:'100%', objectFit:'contain', willChange:'transform,opacity,filter' });
    host.appendChild(img);
    const particleLayer = document.createElement('div');
    Object.assign(particleLayer.style, { position:'absolute', inset:0, overflow:'visible', pointerEvents:'none' });
    host.appendChild(particleLayer);
    const makeSpark = (x,y,scale,delay)=>{ const s=document.createElement('div'); Object.assign(s.style,{ position:'absolute', left:(x*100)+'%', top:(y*100)+'%', width:Math.round(12*scale)+'px', height:Math.round(12*scale)+'px', borderRadius:'50%', background:'radial-gradient(circle,#fff,#ffd47a 55%,rgba(255,140,0,0) 70%)', filter:'brightness(1.2)', opacity:0, transform:'translate(-50%,-50%) scale(.2)', willChange:'transform,opacity' }); particleLayer.appendChild(s); const driftX=(Math.random()*120-60); const driftY=(Math.random()*120-60); s.animate([{ opacity:0, transform:'translate(-50%,-50%) scale(.2)' }, { opacity:1, transform:'translate(-50%,-50%) scale(1) translate(0,0)', offset:0.25 }, { opacity:.6, transform:`translate(-50%,-50%) scale(.9) translate(${driftX/2}px,${driftY/2}px)` , offset:0.55 }, { opacity:0, transform:`translate(-50%,-50%) scale(.4) translate(${driftX}px,${driftY}px)` }], { duration:DURATION_MS, easing:'ease-in-out', delay:delay }); };
    for (let i=0;i<10;i++) makeSpark(Math.random(),Math.random(),.6+Math.random()*0.9, Math.random()*260);
    return { host, img };
  }
  const AUDIO_CACHE = {};
  function playAnimationInternal(buffId){
    const def = REGISTRY[buffId]; if (!def) return;
    const stage = ensureStage();
    const active = stage.querySelectorAll('.buff-anim-waapi');
    if (active.length >= MAX_ACTIVE && stage.firstChild) stage.firstChild.remove();
    const { host, img } = createVisual(def.folder, buffId);
    host.dataset.buff = buffId;
    const runId = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    host.dataset.run = runId;
    stage.appendChild(host);
    setTimeout(() => { const cs = window.getComputedStyle(host); console.log('[BuffAnim] created', { buffId, runId, parent: host.parentNode && host.parentNode.id, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, z: cs.zIndex }); }, 10);
    console.log('[BuffSystem] animStart', { buffId, runId, activeBefore: active.length });
    const anim = img.animate([{ opacity:0, transform:'scale(.25) rotate(-18deg)', filter:'blur(8px)' }, { opacity:1, transform:'scale(1.05) rotate(6deg)', filter:'blur(0)', offset:0.18 }, { opacity:1, transform:'scale(.92) rotate(-4deg)', offset:0.32 }, { opacity:1, transform:'scale(1.04) rotate(2deg)', offset:0.65 }, { opacity:.55, transform:'scale(.78) rotate(10deg)', filter:'blur(4px)', offset:0.92 }, { opacity:0, transform:'scale(.6) rotate(16deg)', filter:'blur(8px)' }], { duration:DURATION_MS, easing:'ease-in-out' });
    anim.onfinish = ()=>{ 
      console.log('[BuffSystem] animFinish', { buffId, runId }); 
      try { img.style.opacity='0'; img.style.filter='blur(6px)'; } catch(_){} 
      setTimeout(()=>{ try { host.remove(); } catch(_){} }, 40); 
      // Signal that this animation is complete
      isPlayingAnimation = false;
      processAnimationQueue();
    };
    setTimeout(()=>{ if (host.isConnected) { console.log('[BuffSystem] animTimeoutCleanup', { buffId, runId }); try { host.remove(); } catch(_){} } }, DURATION_MS + 400);
    if (!AUDIO_CACHE[def.folder]) {
      const src = `app://assets/powers/${def.folder}/burst.mp3`;
      let aud;
      if (window.SackBattle?.utils?.audio) {
        aud = window.SackBattle.utils.audio.createAudio(src, 'sfx', parseFloat(def.volume||0.8));
      } else {
        aud = new Audio(src);
        // Apply categorized volume using AudioMixer if available
        try {
          if (window.__audioMixer) {
            const vol = window.__audioMixer.calculateCategoryVolume('sfx', parseFloat(def.volume||0.8));
            aud.volume = vol;
          } else {
            aud.volume = parseFloat(def.volume||0.8);
          }
        } catch(_) { aud.volume = parseFloat(def.volume||0.8); }
      }
      aud.preload = 'auto';
      AUDIO_CACHE[def.folder] = aud;
      // Register in shared audio state for centralized updates
      try {
        if (window.__audioState) {
          if (!window.__audioState.buffSfx) window.__audioState.buffSfx = {};
          window.__audioState.buffSfx[def.folder] = aud;
        } else if (window.__audioModule && window.__audioModule.state) {
          if (!window.__audioModule.state.buffSfx) window.__audioModule.state.buffSfx = {};
          window.__audioModule.state.buffSfx[def.folder] = aud;
        }
      } catch(_) {}
    }
    try {
      const a = AUDIO_CACHE[def.folder];
      // Ensure current volume matches latest settings before play
      if (!window.SackBattle?.utils?.audio && window.__audioMixer) {
        try { a.volume = window.__audioMixer.calculateCategoryVolume('sfx', parseFloat(a.dataset?.originalVolume)||0.8); } catch(_){}
      }
      a.currentTime = 0;
      a.play().catch(()=>{});
    } catch(_){ }
  }
  
  // Public function that uses the queue
  function playAnimation(buffId){ 
    queueAnimation(buffId);
  }
  window.playBuffAnimation = playAnimation;

  function applyBuff(buffId, source){
    const def = REGISTRY[buffId];
    if (!def) {
      log('applyBuff', 'no def for ' + buffId);
      return false;
    }
    try {
      const gs = window.Game && window.Game.getState ? window.Game.getState() : {};
      const playerActive = gs.players && source && gs.players[source];
      log('applyBuff', { buffId, source, playerActive, matchState: gs.running, before: gs });
      def.effect.apply(null, def.applyArgs||[]);
      // Ensure icon
      try {
        if (typeof window.addBuffIcon === 'function') window.addBuffIcon(buffId, window.Game && window.Game.getState && window.Game.getState()); else ensureBuffIconInternal(buffId);
      } catch(iconErr){ console.warn('[BuffSystem] addBuffIcon failed', iconErr); }
      refreshTimers(); setTimeout(refreshTimers, 80);
      playAnimation(buffId);
      if (def.singleUsePerMatch) state.usedThisMatch.add(buffId);
      setTimeout(()=>{
        try {
          const bar=document.getElementById('buff-bar');
          if (bar){
            const found=bar.querySelector(`.buff-icon[data-key="${buffId}"]`);
            if (!found) console.warn('[BuffSystem] icon missing post-apply', buffId);
            else console.log('[BuffSystem] icon present', buffId);
          }
        } catch(_){ }
      }, 40);
      log('applied', { buffId, source, after: window.Game && window.Game.getState ? window.Game.getState() : undefined });
      announce(buffId, source, true);
      return true;
    } catch(e){
      log('applyBuff_error', { buffId, source, error: String(e && e.message || e) });
      console.warn('[BuffSystem] apply error', buffId, e);
      return false;
    }
  }
  function defer(buffId, player){ if (!state.deferred.includes(buffId)) { state.deferred.push(buffId); if (!state.deferredBy) state.deferredBy = {}; state.deferredBy[buffId] = player; log('deferred', buffId); } }
  function trigger(raw, source='unknown'){
    const id = normalize(raw);
    if(!id) {
      log('trigger_blocked', { reason: 'normalize_failed', raw });
      return false;
    }
    const def = REGISTRY[id];
    if(!def) {
      log('trigger_blocked', { reason: 'no_registry_def', id });
      return false;
    }
    const gs = Game.getState();
    const running = gs.running;
    const prebattle = !!window.__prebattleActive;
    const matchIdx = gs.completedMatches;
    const playerActive = gs.players && source && gs.players[source];
    log('trigger', { id, source, running, prebattle, matchIdx, used: state.usedThisMatch.has(id), deferred: state.deferred.slice(), playerActive });
    if (state.matchIndex === null) state.matchIndex = matchIdx;
    if (!running || prebattle){
      if (def.deferIfNotRunning){
        log('trigger_deferred', { reason: 'not_running_or_prebattle', running, prebattle, id, source });
        defer(id, source);
        announce(id, source, false);
        return true;
      } else {
        log('trigger_blocked', { reason: 'not_running_or_prebattle_no_defer', running, prebattle, id, source });
        return false;
      }
    } else if (def.singleUsePerMatch && state.usedThisMatch.has(id)){
      log('trigger_deferred', { reason: 'single_use_already_used', id, source });
      defer(id, source);
      announce(id, source, false);
      return true;
    }
    return applyBuff(id, source);
  }
  function processDeferred(){ if (!state.deferred.length) { log('processingDeferred', 'none'); return; } const toRun = state.deferred.slice(); state.deferred.length = 0; log('processingDeferred', toRun); toRun.forEach(id=>{ if (REGISTRY[id] && (!REGISTRY[id].singleUsePerMatch || !state.usedThisMatch.has(id))) { const player = state.deferredBy && state.deferredBy[id] ? state.deferredBy[id] : 'Unknown Player'; applyBuff(id, player); } if (state.deferredBy) delete state.deferredBy[id]; }); if (typeof window.updateBuffIconTimers === 'function') setTimeout(window.updateBuffIconTimers, 60); }
  function handleMatchBoundary(){ log('handleMatchBoundary', { usedThisMatch: [...state.usedThisMatch], deferred: [...state.deferred] }); state.usedThisMatch.clear(); try { const stage = document.getElementById('buff-anim-layer'); if (stage) stage.querySelectorAll('.buff-anim-waapi').forEach(n=>n.remove()); } catch(e){ console.warn('Failed to clear old buff-anim-waapi nodes', e); } setTimeout(()=>{ processDeferred(); refreshTimers(); }, 80); }
  function refreshTimers(){ if (typeof window.updateBuffIconTimers === 'function') window.updateBuffIconTimers(); }
  const INTERNAL_ICON_META = { massheal: { cls:'heal' }, reviveall: { cls:'revive' }, powerfulattack: { cls:'power' }, attackup: { cls:'attackup' } };
  function ensureBuffIconInternal(key){ const meta = INTERNAL_ICON_META[key]; if (!meta) return; const bar = document.getElementById('buff-bar'); if (!bar) return; let icon = bar.querySelector(`.buff-icon[data-key="${key}"]`); if (!icon){ icon = document.createElement('div'); icon.className = 'buff-icon '+meta.cls; icon.dataset.key = key; const img = document.createElement('img'); const def = REGISTRY[key]; const folder = def ? def.iconFolder : 'crown'; img.src = `app://assets/powers/${folder}/burst.png`; img.alt = key; const timer = document.createElement('div'); timer.className='buff-timer'; icon.appendChild(img); icon.appendChild(timer); bar.appendChild(icon); } return icon; }
  function announce(buffId, source, applied){
    const def = REGISTRY[buffId];
    if (!def) return;
    const name = def.announceName || def.label || buffId.toUpperCase();
    let player = source;
    if (source === 'deferred' && state.deferredBy && state.deferredBy[buffId]) player = state.deferredBy[buffId];
    if (!player || player === 'deferred') player = 'Unknown Player';
    const styledName = `★ ${name} ★`;
    const msg = applied ? `${player} used ${styledName}` : `${player} redeemed ${styledName} (will trigger next match)`;
    if (electronAPI.sendChatMessage) electronAPI.sendChatMessage({ text: msg });
    else console.log('[BuffAnnounce]', msg);
  }
// ...existing code...
  function log(evt, data){ console.log('[BuffSystem]', evt, data||''); }
  if (Game && Game.onUpdate){ Game.onUpdate(st => { const running = st.running; const matchIdx = st.completedMatches; if (!state.lastRunning && running){ state.matchIndex = matchIdx; handleMatchBoundary(); } else if (state.matchIndex !== null && matchIdx !== state.matchIndex){ state.matchIndex = matchIdx; if (running) handleMatchBoundary(); } state.lastRunning = running; refreshTimers(); try { Object.entries(st.players||{}).forEach(([n,p])=>{ const el = document.querySelector(`.player-card[data-name="${n}"]`); if (el){ if (p.invincibleTurns>0) el.classList.add('player-invincible'); else el.classList.remove('player-invincible'); } }); } catch(_){ } }); }
  function initDefaults(){ register({ id:'powerfulattack', aliases:['powerattack','powerful'], folder:'snowwhite', iconFolder:'snowwhite', announceName:'SEVEN DWARVES', effect: ()=> Game.applyPowerfulAttack && Game.applyPowerfulAttack() }); register({ id:'massheal', folder:'rapunzel', iconFolder:'rapunzel', announceName:'GARDEN OF SHANGRI LA', effect: ()=> Game.applyMassHeal && Game.applyMassHeal() }); register({ id:'reviveall', folder:'rapunzel', iconFolder:'rapunzel', announceName:'GARDEN OF SHANGRI LA', effect: ()=> Game.applyReviveAll && Game.applyReviveAll() }); register({ id:'attackup', aliases:['atkup','attackboost'], folder:'crown', iconFolder:'crown', announceName:'LIGHT OF THE KINGDOM', effect: ()=> Game.applyAttackUp && Game.applyAttackUp(5), timerProvider: ()=> Game.getState().attackUpTurns }); }
  initDefaults();
  if (electronAPI.onTrigger){ electronAPI.onTrigger(payload => { const key = (payload && payload.key)||''; trigger(key, payload.user||payload.username||'Viewer'); }); }
  function refreshUI(){ refreshTimers(); }
  function forceMatchBoundary() { handleMatchBoundary(); }
  const api = { register, trigger, list: ()=> Object.keys(REGISTRY), get:(id)=>REGISTRY[id], refreshUI, _state: state, forceMatchBoundary };
  window.BuffSystem = api;
  if (!window.__buffDev) window.__buffDev = {};
  window.__buffDev.trigger = k => trigger(k, 'ExportErrorMusic');
  console.log('[BuffSystem] Initialized');
})(window);
