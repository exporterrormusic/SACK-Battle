// src/renderer/playlist.js
// Boss playlist management module (exposes globals; no bundler)
(function(global){
  function getBossPlaylist(settings){ return Array.isArray(settings?.bossPlaylist) ? [...settings.bossPlaylist] : []; }
  function saveBossPlaylist(list){
    try {
      const Game = global.Game; if (!Game || !Game.getState) return;
      const s = Game.getState().settings || {};
      const { bossName, ...rest } = s; // drop legacy bossName
      const newSettings = { ...rest, bossPlaylist: list };
      if (Game.setSettings) Game.setSettings(newSettings);
      if (global.persistSettings) try { global.persistSettings(); } catch(_){ }
      renderBossPlaylist();
      if (Game._rawState) {
        // Find the current boss in the new playlist
        const currentBossName = Game._rawState.boss && Game._rawState.boss.name ? Game._rawState.boss.name : null;
        const manifest = global.bossManifest || [];
        let idx = 0;
        if (currentBossName) {
          // Try to find the boss by name (case-insensitive, ignore spaces/underscores)
          idx = list.findIndex(entry => {
            const meta = manifest.find(b => b.id === entry.id);
            if (!meta) return false;
            const entryName = (meta.name || entry.id || '').replace(/[-_ ]/g, '').toLowerCase();
            const bossNameNorm = currentBossName.replace(/[-_ ]/g, '').toLowerCase();
            return entryName === bossNameNorm;
          });
          if (idx === -1) idx = 0; // fallback to top if not found
        }
        Game._rawState.bossPlaylistIndex = idx;
      }
    } catch(e){ console.warn('[Playlist] save failed', e); }
  }
  function renderBossPlaylist(){
    try {
      const Game = global.Game; if (!Game || !Game.getState) return;
      const s = Game.getState().settings || {};
      const list = getBossPlaylist(s);
      const wrap = document.getElementById('boss-playlist'); if (!wrap) return;
      wrap.innerHTML='';
      if (!list.length){
        wrap.innerHTML = '<div class="pl-empty" style="opacity:.55;font-size:0.55rem;padding:4px 2px;">Playlist empty. Pick a boss above, set HP & optional sub title, then click Add.</div>';
        return;
      }
      const manifest = global.bossManifest || [];
      list.forEach((entry, idx) => {
        const meta = manifest.find(b=>b.id===entry.id) || {};
        const row = document.createElement('div');
        row.className='boss-pl-row'; row.setAttribute('draggable','true'); row.dataset.index = idx;
        row.style.cssText = 'display:flex;align-items:center;gap:6px;background:#2d3458;padding:4px 6px;border-radius:6px;';
        row.innerHTML = `\n        <div class="drag-handle" style="cursor:grab;font-size:0.8rem;opacity:.6;">☰</div>\n        ${meta.portrait ? `<img src="${meta.portrait}" style="width:34px;height:34px;object-fit:cover;border-radius:4px;" />` : '<div style="width:34px;height:34px;background:#444;border-radius:4px;"></div>'}\n        <div style="flex:1;min-width:120px;font-size:0.65rem;font-weight:600;">${meta.name || entry.id}</div>\n        <input type="text" class="pl-sub" value="${entry.subName||''}" placeholder="sub" style="width:110px;font-size:0.6rem;padding:3px 4px;border-radius:4px;border:1px solid #45507a;background:#1d2340;color:#d8e1ff;" />\n        <input type="number" class="pl-hp" value="${entry.hp||100}" min="1" style="width:70px;font-size:0.6rem;padding:3px 4px;border-radius:4px;border:1px solid #45507a;background:#1d2340;color:#d8e1ff;" />\n  <button type="button" class="pl-del" title="Remove" style="background:#733c3c;color:#fff;border:none;border-radius:4px;padding:4px 6px;font-size:0.55rem;cursor:pointer;">✕</button>`;
        wrap.appendChild(row);
      });
      wrap.querySelectorAll('.pl-del').forEach(btn => { btn.onclick = () => { const i = parseInt(btn.closest('.boss-pl-row').dataset.index); const list2 = getBossPlaylist(Game.getState().settings); list2.splice(i,1); saveBossPlaylist(list2); }; });
      wrap.querySelectorAll('.pl-hp').forEach(inp => inp.onchange = () => { const i = parseInt(inp.closest('.boss-pl-row').dataset.index); const list2 = getBossPlaylist(Game.getState().settings); list2[i].hp = parseInt(inp.value)||1; saveBossPlaylist(list2); });
      wrap.querySelectorAll('.pl-sub').forEach(inp => inp.onchange = () => { const i = parseInt(inp.closest('.boss-pl-row').dataset.index); const list2 = getBossPlaylist(Game.getState().settings); list2[i].subName = inp.value.slice(0,60); saveBossPlaylist(list2); });
      let dragIndex=null;
      wrap.querySelectorAll('.boss-pl-row').forEach(row => {
        row.addEventListener('dragstart', e => { dragIndex = parseInt(row.dataset.index); e.dataTransfer.effectAllowed='move'; row.classList.add('dragging'); });
        row.addEventListener('dragover', e => e.preventDefault());
        row.addEventListener('drop', e => { e.preventDefault(); const targetIdx = parseInt(row.dataset.index); if (dragIndex===null || targetIdx===dragIndex) return; const list2 = getBossPlaylist(Game.getState().settings); const [m]=list2.splice(dragIndex,1); list2.splice(targetIdx,0,m); saveBossPlaylist(list2); });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
      });
      const first = wrap.querySelector('.boss-pl-row'); if (first) first.classList.add('next-boss');
    } catch(e){ console.warn('[Playlist] render failed', e); }
  }
  function decorateBossSelect(){
    const sel = document.getElementById('boss-manifest-select'); if (!sel) return;
    const manifest = global.bossManifest || [];
    let meta = manifest.find(b=>b.id===sel.value);
    if (!meta && manifest.length){ sel.value = manifest[0].id; meta = manifest[0]; }
    sel.style.backgroundImage = meta && meta.portrait ? `url(${meta.portrait})` : 'none';
  }
  function hookBossPlaylistControls(){
    const addBtn = document.getElementById('btn-add-boss'); if (addBtn && !addBtn._bound){ addBtn._bound = true; addBtn.onclick = () => {
        const Game = global.Game; if (!Game || !Game.getState) return;
        const sel = document.getElementById('boss-manifest-select'); if (!sel || !sel.value) return;
        const hpInput = document.getElementById('boss-add-hp'); const subInput = document.getElementById('boss-add-sub');
        const hpVal = parseInt(hpInput.value)||100; const subVal = subInput.value.trim();
        const list = getBossPlaylist(Game.getState().settings); list.push({ id: sel.value, hp: hpVal, subName: subVal }); hpInput.value=''; subInput.value=''; saveBossPlaylist(list); decorateBossSelect();
      }; }
  }
  function applyNextBossFromPlaylist(forceApply = false, skipIntroSfx = false){
    try {
      // Check if welcome screen is active - don't apply boss if it is (unless forced)
      if (!forceApply) {
        const welcomeScreen = document.getElementById('welcome-screen');
        const isWelcomeActive = welcomeScreen && welcomeScreen.classList.contains('active');
        if (isWelcomeActive) {
          console.log('[Playlist] Skipping boss application - welcome screen is active');
          return;
        }
      }
      
      const Game = global.Game; if (!Game || !Game.getState) return;
      const manifest = global.bossManifest || [];
      const s = Game.getState().settings || {};
      let list = getBossPlaylist(s);
      if (!Array.isArray(list)) list = [];
      // Fallback: if playlist empty but manifest available, synthesize a temporary entry (not persisted)
      if (!list.length && manifest.length){
        console.log('[Playlist] Empty playlist; using manifest[0] fallback');
        list = [{ id: manifest[0].id, hp: s.bossHp || 100, subName: '' }];
      }
      if (!list.length) { console.warn('[Playlist] No boss to apply (manifest len='+manifest.length+')'); return; }
      if (!manifest.length) console.log('[Playlist] Manifest empty at apply time; will retry later if hooked');
      global.stopAllMusic && global.stopAllMusic('applyNextBossFromPlaylist');
      // Use bossPlaylistIndex to select the boss
      const GameState = Game && Game._rawState ? Game._rawState : {};
      let bossIdx = GameState.bossPlaylistIndex || 0;
      if (bossIdx >= list.length) bossIdx = 0;
      const next = list[bossIdx];
      const meta = manifest.find(b=>b.id===next.id);
      if (!meta){ console.warn('[Playlist] Missing meta for boss id', next.id, 'manifest ids:', manifest.map(m=>m.id)); return; }
      console.log('[Playlist] Applying boss', { id: meta.id, hp: next.hp, portrait: meta.portrait, hasAudio: !!(meta.audio && meta.audio.music) });
      const hpVal = next.hp || (s.bossHp||100);
      const currentSettings = Game.getState().settings || {};
      if (currentSettings.bossHp !== hpVal && Game.setSettings) Game.setSettings({ ...currentSettings, bossHp: hpVal });
      const baseName = (next.id || meta.id || '').replace(/[-_]/g,' ').toUpperCase();
      global.__currentBossSubName = next.subName || '';
      if (Game.setBoss) Game.setBoss({ hp: hpVal, name: baseName, image: meta.portrait || '' });
      try { if (global.updateBossUI) global.updateBossUI(Game.getState().boss); } catch(_){ }
      // Rotate only if original playlist had entries
      // DISABLED: Do not rotate playlist on game start/reset
      // if (s.bossPlaylist && s.bossPlaylist.length){
      //   const rotated = [...list.slice(1), list[0]]; saveBossPlaylist(rotated);
      // }
      const bossImageEl = document.getElementById('boss-image'); if (bossImageEl && meta.portrait) bossImageEl.src = meta.portrait.startsWith('app://') ? meta.portrait : `app://${meta.portrait}`;
      if (global.initBossAudio) { global.initBossAudio(meta, { skipIntroSfx }); }
      global.__bossAppliedAt = Date.now();
  // Do not hide boss-overlay here; startController will manage visibility. Hiding caused boss UI to disappear after Next Game.
    } catch(e){ console.warn('[Playlist] apply next failed', e); }
  }
  function ensureBossSelected(retries){
    retries = retries || 0;
    
    // Check if welcome screen is active - don't ensure boss if it is
    const welcomeScreen = document.getElementById('welcome-screen');
    const isWelcomeActive = welcomeScreen && welcomeScreen.classList.contains('active');
    if (isWelcomeActive) {
      console.log('[Playlist] Deferring boss selection - welcome screen is active');
      // Retry after welcome screen might be dismissed
      if (retries < 40) {
        setTimeout(() => ensureBossSelected(retries + 1), 500);
      }
      return;
    }
    
    const Game = global.Game; if (!Game || !Game.getState) return;
    const st = Game.getState();
    const manifest = global.bossManifest || [];
    if (st && st.boss && st.boss.name){ return; }
    if (!manifest.length){
      if (retries < 40){ setTimeout(()=>ensureBossSelected(retries+1), 250); }
      if (retries===0) console.log('[Playlist] ensureBossSelected waiting for manifest...');
      return;
    }
    console.log('[Playlist] ensureBossSelected applying boss (retries='+retries+')');
    applyNextBossFromPlaylist();
    if ((!st.boss || !st.boss.name) && retries < 40){ setTimeout(()=>ensureBossSelected(retries+1), 300); }
  }
  function onManifestLoaded(){
    const sel = document.getElementById('boss-manifest-select'); if (sel){
      sel.innerHTML='';
      (global.bossManifest||[]).forEach(b=>{ const opt=document.createElement('option'); opt.value=b.id; opt.textContent=b.name; sel.appendChild(opt); });
      decorateBossSelect();
    }
    hookBossPlaylistControls();
    renderBossPlaylist();
    // On first manifest load, ensure bossPlaylistIndex is 0 and first boss is selected
    const Game = global.Game;
    if (Game && Game._rawState) {
      Game._rawState.bossPlaylistIndex = 0;
    }
    if (global.__playlist?.applyNextBossFromPlaylist) {
      global.__playlist.applyNextBossFromPlaylist();
    }
  }
  const api = { getBossPlaylist, saveBossPlaylist, renderBossPlaylist, decorateBossSelect, hookBossPlaylistControls, applyNextBossFromPlaylist, onManifestLoaded };
  global.__playlist = api;
  global.__playlist.ensureBossSelected = ensureBossSelected;
  // Ensure controls wired after DOM ready even if manifest loads later
  document.addEventListener('DOMContentLoaded', hookBossPlaylistControls);
})(typeof window !== 'undefined' ? window : globalThis);
