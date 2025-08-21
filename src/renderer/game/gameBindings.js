// src/renderer/gameBindings.js
// Extracted victory/defeat overlay + scoreboard + round/match header logic.
// Lightweight DOM lookups each call (low frequency compared to per-player rendering).
(function(global){
  if (global.__gameBindings) return; // guard
  function qs(id){ return document.getElementById(id); }
  function updateRoundMatchHeader(state){
    try {
      const roundDisplay = qs('round-display');
      const maxRoundsDisplay = qs('max-rounds');
      const matchDisplay = qs('match-display');
      if (roundDisplay) roundDisplay.textContent = state.round;
      if (maxRoundsDisplay) maxRoundsDisplay.textContent = state.totalRounds;
      if (matchDisplay) matchDisplay.textContent = state.completedMatches;
    } catch(e){ console.warn('[gameBindings] header update failed', e); }
  }
  function renderScoreboardIfNeeded(force){
    const Game = global.Game; if (!Game || !Game.getState) return;
    const st = Game.getState();
    if (!st.victoryState) return;
    const playersContainer = qs('players-container'); if (!playersContainer) return;
    const playerCount = Object.keys(st.players||{}).length;
    const dmgCount = st.lastMatchDamage ? Object.keys(st.lastMatchDamage).length : 0;
    const key = st.completedMatches + ':' + (st.victoryState||'none') + ':' + playerCount + ':' + dmgCount;
    if (!force && renderScoreboardIfNeeded._key === key) return;
    renderScoreboardIfNeeded._key = key;
    playersContainer.classList.add('scoreboard-active');
    playersContainer.classList.remove('hidden-waiting');
    
    // Remove any existing scoreboard elements
    playersContainer.querySelectorAll('.scoreboard-head, .scoreboard-list').forEach(el => el.remove());
    
    // DON'T remove player cards - let CSS hide them to preserve DOM structure for respawning
    // BUT also force hide them with inline styles as backup
    playersContainer.querySelectorAll('.player-card').forEach(card => {
      card.style.display = 'none';
      card.style.visibility = 'hidden';
      card.style.opacity = '0';
      card.style.position = 'absolute';
      card.style.left = '-9999px';
      card.style.top = '-9999px';
      card.style.pointerEvents = 'none';
      card.style.zIndex = '-1000';
    });
    
    playersContainer.style.overflowY='auto';
    playersContainer.style.overflowX='hidden';
    try { playersContainer.scrollTop = 0; } catch(_){ }
    
    const list = document.createElement('div'); list.className='scoreboard-list'; playersContainer.appendChild(list);
    
    // Add header inside the grid container so it can span both columns
    const head=document.createElement('div'); head.className='scoreboard-head'; head.textContent='MATCH DAMAGE SCOREBOARD'; list.appendChild(head);
    
    let entries=[];
    if (st.lastMatchDamage && Object.keys(st.lastMatchDamage).length) entries = Object.entries(st.lastMatchDamage).sort((a,b)=>b[1]-a[1]);
    const existing = new Set(entries.map(e=>e[0]));
    Object.keys(st.players||{}).forEach(n=>{ if(!existing.has(n)) entries.push([n,0]); });
    entries.sort((a,b)=> (b[1]-a[1]) || a[0].localeCompare(b[0]));
    global.__fullScoreboardEntries = entries.slice();
    entries.forEach(([user,dmg], idx)=>{
      const cell=document.createElement('div'); cell.className='scoreboard-cell';
      if (idx===0) cell.classList.add('top1'); else if (idx===1) cell.classList.add('top2'); else if (idx===2) cell.classList.add('top3'); else if (idx===3) cell.classList.add('top4');
      let avatarFile = (st.players[user] && st.players[user].avatar) || (global.__lockedAvatars && global.__lockedAvatars[user]) || '';
      if (avatarFile && avatarFile.startsWith('assets/avatars/')) avatarFile = avatarFile.slice('assets/avatars/'.length);
      const avatarSrc = avatarFile ? `app://assets/avatars/${avatarFile}` : '';
      cell.innerHTML = `<div class="sc-rank">#${idx+1}</div>${avatarSrc?`<div class="sc-avatar"><img src="${avatarSrc}" alt="${user}"></div>`:'<div class="sc-avatar placeholder"></div>'}<div class="sc-name">${user}</div><div class="sc-dmg" data-label="DMG">${dmg}</div>`;
      if (idx >= 4) {
        const t = (idx - 4)/Math.max(1,(entries.length-5));
        const v = Math.round(255 - t*70);
        const color = `rgb(${v},${v},${v})`;
        cell.classList.add('tail-rank');
        ['.sc-name','.sc-rank','.sc-dmg'].forEach(sel=>{ const el=cell.querySelector(sel); if(el) el.style.color=color; });
        cell.style.setProperty('--tail-ratio', t.toFixed(3));
      }
      list.appendChild(cell);
    });
    global.__scoreboardActive = true;
  }
  function applyVictoryDefeatOverlay(){
    const Game = global.Game; if (!Game || !Game.getState) return;
    const st = Game.getState();
    const bossWrapper = qs('boss-image-wrapper'); if (!bossWrapper) return;
    let overlay = bossWrapper.querySelector('.game-overlay');
    // Debug trace
    try {
      if (!applyVictoryDefeatOverlay._dbgOnce) { console.log('[OverlayDebug] Handler active'); applyVictoryDefeatOverlay._dbgOnce = true; }
      if (st.victoryState && !applyVictoryDefeatOverlay._dbgLastStateLogged) { console.log('[OverlayDebug] Victory state detected', st.victoryState, { running: st.running, completedMatches: st.completedMatches }); applyVictoryDefeatOverlay._dbgLastStateLogged = st.victoryState; }
    } catch(_){ }
    if (st.victoryState) {
      const desiredKind = st.victoryState === 'victory' ? 'victory' : 'defeat';
      if (applyVictoryDefeatOverlay._activeKind !== st.victoryState) {
        if (global.stopOverlayMusic) global.stopOverlayMusic('prebattle');
        const bossAudio = (global.__audioModule && global.__audioModule.state && global.__audioModule.state.bossAudio) || {};
        if (bossAudio.music) { try { bossAudio.music.pause(); } catch(_){} }
      }
      if (!overlay){
        overlay=document.createElement('div'); overlay.className='game-overlay'; bossWrapper.appendChild(overlay);
        try { console.log('[OverlayDebug] Created new overlay element'); } catch(_){ }
      } else {
        try { console.log('[OverlayDebug] Reusing existing overlay element classes=', overlay.className); } catch(_){ }
      }
      const bossName = st.boss.name || 'Boss';
      const outcomeClass = st.victoryState==='victory' ? 'victory' : 'defeat';
      bossWrapper.classList.add('boss-outcome-'+outcomeClass);
      if (st.victoryState==='victory') {
        overlay.innerHTML = `<div class="outcome-text outcome-victory"><h1 class="outcome-main">VICTORY</h1><h2 class="outcome-sub">${bossName} DEFEATED</h2></div>`;
      } else {
        let sub = 'ALL PLAYERS DOWN'; if (st.victoryState==='defeat-timeout') sub = 'TIME EXPIRED';
        overlay.innerHTML = `<div class="outcome-text outcome-defeat"><h1 class="outcome-main">DEFEAT</h1><h2 class="outcome-sub">${sub}</h2><div class="outcome-hint">Type in chat to respawn</div></div>`;
      }
      overlay.classList.add('shown');
      overlay.classList.toggle('victory', st.victoryState==='victory');
      overlay.classList.toggle('defeat', st.victoryState!=='victory');
      if (!applyVictoryDefeatOverlay._played) {
        if (st.victoryState==='victory' && global.playBossSfx) global.playBossSfx('victory');
        else if (global.playBossSfx) global.playBossSfx('defeat');
        applyVictoryDefeatOverlay._played = true;
        try { console.log('[OverlayDebug] Played outcome SFX and marked overlay as played'); } catch(_){ }
      }
      if (applyVictoryDefeatOverlay._musicApplied !== desiredKind && global.playOverlayMusic) {
        global.playOverlayMusic(desiredKind); applyVictoryDefeatOverlay._musicApplied = desiredKind;
        try { console.log('[OverlayDebug] Started overlay music', desiredKind); } catch(_){ }
      }
      applyVictoryDefeatOverlay._activeKind = st.victoryState;
    } else {
      if (overlay) overlay.classList.remove('shown');
      applyVictoryDefeatOverlay._played = false;
      applyVictoryDefeatOverlay._musicApplied = null;
      applyVictoryDefeatOverlay._activeKind = null;
      try { if (applyVictoryDefeatOverlay._dbgLastStateLogged){ console.log('[OverlayDebug] Cleared state'); applyVictoryDefeatOverlay._dbgLastStateLogged=null; } } catch(_){ }
    }
    try { renderScoreboardIfNeeded(); } catch(_){ }
  }
  global.__gameBindings = { updateRoundMatchHeader, renderScoreboardIfNeeded, applyVictoryDefeatOverlay };
  // Provide global alias expected by gameLoop debug invocation
  if (!global.applyVictoryDefeatOverlay) global.applyVictoryDefeatOverlay = applyVictoryDefeatOverlay;
})(typeof window !== 'undefined' ? window : globalThis);
