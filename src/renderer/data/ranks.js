// src/renderer/ranks.js
(function(){
  function persist() { 
    if (window.__persistenceHelper) {
      window.__persistenceHelper.persist('ranks');
    } else if (window.__schedulePersist) {
      window.__schedulePersist();
    }
  }
  function populateRanksTab() {
    console.log('[Ranks] populateRanksTab called');
    const rankListEl = document.getElementById('rank-list');
    if (!rankListEl) {
      console.warn('[Ranks] rank-list element not found');
      return;
    }
    const Game = window.Game; 
    if (!Game || !Game.getState) {
      console.warn('[Ranks] Game not available');
      return;
    }
    rankListEl.innerHTML = '';
    try {
      const settings = Game.getState().settings || {};
      const ranks = Array.isArray(settings.rankDefinitions) ? [...settings.rankDefinitions] : [];
      console.log('[Ranks] Loading rank definitions:', ranks);
      
      ranks.forEach((rank, index) => {
        const row = document.createElement('div');
        row.style.padding = '12px';
        row.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '12px';
        const nameInput = document.createElement('input');
        nameInput.type = 'text'; nameInput.value = rank.name; nameInput.placeholder = 'Rank name';
        nameInput.style.flex='1'; nameInput.style.minWidth='100px';
        nameInput.classList.add('rank-name-input');
        const winsInput = document.createElement('input');
        winsInput.type = 'number'; winsInput.value = rank.wins; winsInput.min='0'; winsInput.style.width='80px';
        winsInput.classList.add('rank-wins-input');
        const label = document.createElement('span'); label.textContent='wins'; label.style.color='#8e9af7'; label.style.fontSize='0.65rem';
        const delBtn = document.createElement('button'); delBtn.textContent='✕'; delBtn.style.background='#a33'; delBtn.style.color='#fff'; delBtn.style.border='none'; delBtn.style.borderRadius='6px'; delBtn.style.padding='4px 8px'; delBtn.style.cursor='pointer';
        row.appendChild(nameInput); row.appendChild(winsInput); row.appendChild(label); row.appendChild(delBtn);
        delBtn.onclick = ()=>{ ranks.splice(index,1); Game.setSettings({ ...Game.getState().settings, rankDefinitions: ranks }); window.__settings && window.__settings.persist(Game); populateRanksTab(); };
        rankListEl.appendChild(row);
      });
      const addBtn=document.createElement('button'); addBtn.textContent='+ Add Rank'; addBtn.style.marginTop='12px'; addBtn.style.width='100%'; addBtn.style.padding='10px'; addBtn.style.border='none'; addBtn.style.borderRadius='8px'; addBtn.style.background='#5165e7'; addBtn.style.color='#dbe1ff'; addBtn.style.fontWeight='700'; addBtn.style.cursor='pointer';
      addBtn.onclick=()=>{ ranks.push({ name:'New Rank', wins:(ranks[ranks.length-1]?.wins||0)+1 }); Game.setSettings({ ...Game.getState().settings, rankDefinitions: ranks }); window.__settings && window.__settings.persist(Game); populateRanksTab(); };
      rankListEl.appendChild(addBtn);
      // No scroll bar, let the ranks tab expand vertically
      rankListEl.style.maxHeight = '';
      rankListEl.style.overflow = 'visible';
      console.log('[Ranks] Successfully populated ranks tab with', ranks.length, 'ranks');
    } catch(e){ console.warn('[Ranks] populate failed', e); }
  }
  window.populateRanksTab = populateRanksTab;
  document.addEventListener('DOMContentLoaded', ()=>{ populateRanksTab(); });
})();
