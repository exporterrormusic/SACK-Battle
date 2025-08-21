// src/renderer/bossUI.js
// Boss UI & battlefield presentation module
(function(global){
  const api = {};

  function updateBattlefield(selected){
    try {
      const img = document.getElementById('battlefield-bg');
      if (!img) return;
      if (!selected) return; // nothing to set yet
      // Support both raw filename and full app:// path
      img.src = selected.startsWith('app://') ? selected : `app://assets/battlefield/${selected}`;
    } catch(e){ console.warn('[bossUI] updateBattlefield failed', e); }
  }

  function updateBossUI(bossState){
    if (!bossState) return;
    const Game = global.Game;
    const bossImageEl = document.getElementById('boss-image');
    const bossNameEl = document.getElementById('boss-name');
    const legacySub = document.getElementById('boss-sub-name'); if (legacySub && legacySub.parentNode) legacySub.parentNode.removeChild(legacySub);
    const bossHpEl = document.getElementById('boss-hp');
    const bossStatusEl = document.getElementById('boss-status-text');
    const bossLastMoveValueEl = document.getElementById('boss-last-move-value');
    const bossHpFill = document.getElementById('boss-hp-bar-fill');
    const bossWrapper = document.getElementById('boss-image-wrapper');
    if (bossImageEl && bossState.imageSrc && bossImageEl.src !== bossState.imageSrc) bossImageEl.src = bossState.imageSrc;
    if (bossNameEl){
      const base = bossState.name || '';
      const sub = global.__currentBossSubName || '';
      const esc = (t)=> (t||'').replace(/[&<>"']| /g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;',' ':' ' }[c]));
      if (sub) bossNameEl.innerHTML = `<span class="boss-base-line">${esc(base)}</span><br><span class="boss-sub-line">${esc(sub)}</span>`; else bossNameEl.innerHTML = `<span class="boss-base-line">${esc(base)}</span>`;
    }
    if (bossHpEl) bossHpEl.textContent = bossState.hp;
    if (bossStatusEl) bossStatusEl.textContent = '';
    if (bossWrapper){
      bossWrapper.classList.remove('boss-state-charging','boss-state-cooldown','boss-state-exhausted','boss-state-covered');
      let warnEl = bossWrapper.querySelector('.boss-warning-banner');
      let exEl = bossWrapper.querySelector('.boss-exhausted-banner');
      if (bossState.visualState === 'charging'){
        bossWrapper.classList.add('boss-state-charging');
        if (!warnEl){ warnEl = document.createElement('div'); warnEl.className='boss-warning-banner'; warnEl.innerHTML='<span style="display:block;font-size:0.9rem;letter-spacing:0.35em;">WARNING:</span><span style="display:block;margin-top:8px;font-size:1.05rem;letter-spacing:0.18em;">ENERGY BUILD UP</span>'; bossWrapper.appendChild(warnEl);} else warnEl.style.display='block';
        if (bossWrapper.dataset.prevVS !== 'charging') { try { global.playBossSfx && global.playBossSfx('charge'); } catch(_){ } }
        if (exEl) exEl.style.display='none';
      } else if (bossState.visualState === 'cooldown'){
        bossWrapper.classList.add('boss-state-cooldown'); if (warnEl) warnEl.style.display='none'; if (exEl) exEl.style.display='none';
      } else if (bossState.visualState === 'exhausted'){
        bossWrapper.classList.add('boss-state-exhausted');
        if (!exEl){ exEl = document.createElement('div'); exEl.className='boss-exhausted-banner'; exEl.innerHTML='<span style="display:block;font-size:1.1rem;letter-spacing:0.30em;">EXHAUSTED</span>'; bossWrapper.appendChild(exEl);} else exEl.style.display='block';
        if (warnEl) warnEl.style.display='none';
      } else if (bossState.visualState === 'covered'){
        bossWrapper.classList.add('boss-state-covered');
        if (warnEl) warnEl.style.display='none'; if (exEl) exEl.style.display='none';
      } else {
        if (warnEl) warnEl.style.display='none'; if (exEl) exEl.style.display='none';
      }
      try { bossWrapper.dataset.prevVS = bossState.visualState || ''; } catch(_){ }
    }
    if (bossLastMoveValueEl) bossLastMoveValueEl.textContent = bossState.lastMove || '-';
    if (bossHpFill){
      const maxHp = (Game && Game.getState && Game.getState().settings && Game.getState().settings.bossHp) || 100;
      const pct = Math.max(0, Math.min(100, (bossState.hp / maxHp) * 100));
      bossHpFill.style.width = pct + '%'; bossHpFill.textContent = `${bossState.hp}`;
      bossHpFill.classList.remove('hp-high','hp-mid','hp-low');
      if (pct > 66) bossHpFill.classList.add('hp-high'); else if (pct > 33) bossHpFill.classList.add('hp-mid'); else bossHpFill.classList.add('hp-low');
    }
    // Countdown timer updated in gameLoop via dependency; keep overlay outcome applied separately
    if (global.applyVictoryDefeatOverlay) global.applyVictoryDefeatOverlay();
  }

  api.updateBattlefield = updateBattlefield;
  api.updateBossUI = updateBossUI;

  global.__bossUI = api;
  // Legacy globals for transitional phase
  global.updateBattlefield = function(){ updateBattlefield(global.selectedBattlefield); };
  global.updateBossUI = updateBossUI;

})(typeof window !== 'undefined' ? window : globalThis);
