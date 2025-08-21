// src/renderer/triggers.js
(function(){
  const EFFECT_OPTIONS = [
    { key:'massheal', label:'Mass Heal + Invuln' },
    { key:'powerfulattack', label:'Powerful Attack' },
    { key:'attackup', label:'Attack Up (x5 dmg 5 turns)' },
    { key:'reviveall', label:'Revive All' },
    { key:'chooseavatar', label:'Choose Avatar' }
  ];
  function persist() { 
    if (window.__persistenceHelper) {
      window.__persistenceHelper.persist('triggers');
    } else if (window.__schedulePersist) {
      window.__schedulePersist();
    }
  }
  function makeEffectSelect(value){
    const sel=document.createElement('select');
    EFFECT_OPTIONS.forEach(opt=>{ const o=document.createElement('option'); o.value=opt.key; o.textContent=opt.label; sel.appendChild(o); });
    if (value) sel.value=value; sel.style.minWidth='130px'; sel.dataset.field='key'; return sel;
  }
  function renderRewardTriggers(){
    const rewardsListEl=document.getElementById('rewards-list'); if (!rewardsListEl) return;
    const Game=window.Game; if (!Game||!Game.getState) return;
    const list=(Game.getState().settings.channelPointTriggers)||[];
    rewardsListEl.innerHTML='';
    list.forEach((tr,idx)=>{
      const row=document.createElement('div'); row.className='trigger-row';
      const rewardInput=document.createElement('input'); rewardInput.type='text'; rewardInput.placeholder='Reward title fragment'; rewardInput.value=tr.match||''; rewardInput.dataset.field='match'; rewardInput.style.flex='1';
      const effectSel = makeEffectSelect(tr.key || '');
      const enableChk = document.createElement('input'); 
      enableChk.type = 'checkbox'; 
      enableChk.checked = !!tr.enabled; 
      enableChk.dataset.field = 'enabled';
      
      const delBtn = document.createElement('button'); 
      delBtn.className = 'del-btn'; 
      delBtn.textContent = '✕';
      
      row.appendChild(rewardInput); 
      row.appendChild(effectSel);
      
      const enableWrap = document.createElement('label'); 
      enableWrap.style.display = 'flex'; 
      enableWrap.style.alignItems = 'center'; 
      enableWrap.style.gap = '4px'; 
      enableWrap.style.fontSize = '0.55rem'; 
      enableWrap.style.opacity = '.7'; 
      enableWrap.textContent = 'On'; 
      enableWrap.appendChild(enableChk); 
      row.appendChild(enableWrap);
      row.appendChild(delBtn);
      rewardsListEl.appendChild(row);
      
      delBtn.onclick = () => { 
        const arr = [...list]; 
        arr.splice(idx, 1); 
        window.Game.setSettings({ ...Game.getState().settings, channelPointTriggers: arr }); 
        renderRewardTriggers(); 
        persist(); 
      };
      
      const schedulePersist = (() => { 
        let t; 
        return () => { 
          clearTimeout(t); 
          t = setTimeout(() => { 
            try {
              const current = [...(window.Game.getState().settings.channelPointTriggers || [])];
              current[idx] = { match: rewardInput.value.trim(), key: effectSel.value, enabled: enableChk.checked };
        window.Game.setSettings({ ...window.Game.getState().settings, channelPointTriggers: current });
        persist();
      } catch(_){} }, 220); }; })();
      // Enhanced event handlers with memory management
      const handlers = [
        { element: rewardInput, event: 'input', handler: schedulePersist },
        { element: effectSel, event: 'change', handler: schedulePersist },
        { element: enableChk, event: 'change', handler: schedulePersist }
      ];
      
      handlers.forEach(({ element, event, handler }, index) => {
        global.__domUtils.addEventHandler(element, event, handler, `triggers-reward-${idx}-${index}`);
      });
    });
  }
  function renderBitsThresholds(){
    const listEl=document.getElementById('bits-thresholds-list'); if (!listEl) return;
    const Game=window.Game; if (!Game||!Game.getState) return;
    const list=(Game.getState().settings.bitsThresholds)||[];
    listEl.innerHTML='';
    list.forEach((tr,idx)=>{
      const row=document.createElement('div'); row.className='trigger-row';
      const bitsInput=document.createElement('input'); bitsInput.type='number'; bitsInput.min='1'; bitsInput.value=tr.minBits||1; bitsInput.dataset.field='minBits'; bitsInput.style.width='80px';
      const effectSel=makeEffectSelect(tr.key||'');
      const enableChk=document.createElement('input'); enableChk.type='checkbox'; enableChk.checked=!!tr.enabled; enableChk.dataset.field='enabled';
      const delBtn=document.createElement('button'); delBtn.className='del-btn'; delBtn.textContent='✕';
      row.appendChild(bitsInput); row.appendChild(effectSel);
      const enWrap=document.createElement('label'); enWrap.style.display='flex'; enWrap.style.alignItems='center'; enWrap.style.gap='4px'; enWrap.style.fontSize='0.55rem'; enWrap.style.opacity='.7'; enWrap.textContent='On'; enWrap.appendChild(enableChk); row.appendChild(enWrap);
      row.appendChild(delBtn);
      listEl.appendChild(row);
      delBtn.onclick=()=>{ const arr=[...list]; arr.splice(idx,1); window.Game.setSettings({ ...window.Game.getState().settings, bitsThresholds: arr }); renderBitsThresholds(); persist(); };
      const schedulePersist = (()=>{ let t; return ()=>{ clearTimeout(t); t=setTimeout(()=>{ try {
        const current=[...(window.Game.getState().settings.bitsThresholds||[])];
        const minBits=parseInt(bitsInput.value,10)||1;
        current[idx]={ minBits, key:effectSel.value, enabled:enableChk.checked };
        window.Game.setSettings({ ...window.Game.getState().settings, bitsThresholds: current.sort((a,b)=>a.minBits-b.minBits) });
        persist();
      } catch(_){} }, 220); }; })();
      // Enhanced bits threshold event handlers  
      const handlers = [
        { element: bitsInput, event: 'input', handler: schedulePersist },
        { element: effectSel, event: 'change', handler: schedulePersist },
        { element: enableChk, event: 'change', handler: schedulePersist }
      ];
      
      handlers.forEach(({ element, event, handler }, index) => {
        global.__domUtils.addEventHandler(element, event, handler, `triggers-bits-${idx}-${index}`);
      });
    });
  }
  function addTriggerButtons(){
    // Rewards
    const addRewardBtn=document.getElementById('btn-add-reward');
    if (addRewardBtn && !addRewardBtn._wired){ 
      addRewardBtn._wired=true; 
      // Enhanced add reward button handler
      global.__domUtils.addEventHandler(addRewardBtn, 'click', () => {
        try { 
          const matchInput = document.getElementById('new-reward-match');
          const effectSelect = document.getElementById('new-reward-effect');
          const match = matchInput.value.trim();
          const key = effectSelect.value;
          
          if (!match) {
            matchInput.focus();
            return;
          }
          
          const gs=window.Game.getState(); 
          const arr=[...(gs.settings.channelPointTriggers||[])]; 
          arr.push({ match, key, enabled:true }); 
          window.Game.setSettings({ ...gs.settings, channelPointTriggers: arr }); 
          renderRewardTriggers(); 
          persist(); 
          
          // Clear inputs
          matchInput.value = '';
          effectSelect.selectedIndex = 0;
        } catch(e){ console.warn('[Triggers] add reward failed', e); } 
      }, 'triggers-add-reward'); 
    }
    
    // Bits
    const addBitsBtn=document.getElementById('btn-add-bits-threshold');
    if (addBitsBtn && !addBitsBtn._wired){ 
      addBitsBtn._wired=true; 
      // Enhanced add bits button handler
      global.__domUtils.addEventHandler(addBitsBtn, 'click', () => {
        try { 
          const amountInput = document.getElementById('new-bits-amount');
          const effectSelect = document.getElementById('new-bits-effect');
          const minBits = parseInt(amountInput.value, 10);
          const key = effectSelect.value;
          
          if (!minBits || minBits < 1) {
            amountInput.focus();
            return;
          }
          
          const gs=window.Game.getState(); 
          const arr=[...(gs.settings.bitsThresholds||[])]; 
          arr.push({ minBits, key, enabled:true }); 
          window.Game.setSettings({ ...gs.settings, bitsThresholds: arr }); 
          renderBitsThresholds(); 
          persist(); 
          
          // Clear inputs
          amountInput.value = '';
          effectSelect.selectedIndex = 0;
        } catch(e){ console.warn('[Triggers] add bits failed', e); } 
      }, 'triggers-add-bits'); 
    }
    
    // SuperChats
    const addSuperchatBtn=document.getElementById('btn-add-superchat');
    if (addSuperchatBtn && !addSuperchatBtn._wired){ 
      addSuperchatBtn._wired=true; 
      // Enhanced add superchat button handler
      global.__domUtils.addEventHandler(addSuperchatBtn, 'click', () => {
        try { 
          const amountInput = document.getElementById('new-superchat-amount');
          const effectSelect = document.getElementById('new-superchat-effect');
          const minAmount = parseFloat(amountInput.value);
          const key = effectSelect.value;
          
          if (!minAmount || minAmount < 0.01) {
            amountInput.focus();
            return;
          }
          
          const gs=window.Game.getState(); 
          const arr=[...(gs.settings.superchatThresholds||[])]; 
          arr.push({ minAmount, key, enabled:true }); 
          window.Game.setSettings({ ...gs.settings, superchatThresholds: arr }); 
          renderSuperchatThresholds(); 
          persist(); 
          
          // Clear inputs
          amountInput.value = '';
          effectSelect.selectedIndex = 0;
        } catch(e){ console.warn('[Triggers] add superchat failed', e); } 
      }, 'triggers-add-superchat'); 
    }
  }
  function renderSuperchatThresholds(){
    const listEl=document.getElementById('superchats-list'); if (!listEl) return;
    const Game=window.Game; if (!Game||!Game.getState) return;
    const list=(Game.getState().settings.superchatThresholds)||[];
    listEl.innerHTML='';
    list.forEach((tr,idx)=>{
      const row=document.createElement('div'); row.className='trigger-row';
      const amountInput=document.createElement('input'); amountInput.type='number'; amountInput.min='0.01'; amountInput.step='0.01'; amountInput.value=tr.minAmount||1; amountInput.dataset.field='minAmount'; amountInput.style.width='80px';
      const effectSel=makeEffectSelect(tr.key||'');
      const enableChk=document.createElement('input'); enableChk.type='checkbox'; enableChk.checked=!!tr.enabled; enableChk.dataset.field='enabled';
      const delBtn=document.createElement('button'); delBtn.className='del-btn'; delBtn.textContent='✕';
      row.appendChild(amountInput); row.appendChild(effectSel);
      const enWrap=document.createElement('label'); enWrap.style.display='flex'; enWrap.style.alignItems='center'; enWrap.style.gap='4px'; enWrap.style.fontSize='0.55rem'; enWrap.style.opacity='.7'; enWrap.textContent='On'; enWrap.appendChild(enableChk); row.appendChild(enWrap);
      row.appendChild(delBtn);
      listEl.appendChild(row);
      delBtn.onclick=()=>{ const arr=[...list]; arr.splice(idx,1); window.Game.setSettings({ ...window.Game.getState().settings, superchatThresholds: arr }); renderSuperchatThresholds(); persist(); };
      const schedulePersist = (()=>{ let t; return ()=>{ clearTimeout(t); t=setTimeout(()=>{ try {
        const current=[...(window.Game.getState().settings.superchatThresholds||[])];
        const minAmount=parseFloat(amountInput.value)||0.01;
        current[idx]={ minAmount, key:effectSel.value, enabled:enableChk.checked };
        window.Game.setSettings({ ...window.Game.getState().settings, superchatThresholds: current.sort((a,b)=>a.minAmount-b.minAmount) });
        persist();
      } catch(_){} }, 220); }; })();
      // Enhanced superchat event handlers
      const handlers = [
        { element: amountInput, event: 'input', handler: schedulePersist },
        { element: effectSel, event: 'change', handler: schedulePersist },
        { element: enableChk, event: 'change', handler: schedulePersist }
      ];
      
      handlers.forEach(({ element, event, handler }, index) => {
        global.__domUtils.addEventHandler(element, event, handler, `triggers-superchat-${idx}-${index}`);
      });
    });
  }
  function initTriggers(){ renderRewardTriggers(); renderBitsThresholds(); renderSuperchatThresholds(); addTriggerButtons(); }
  window.renderRewardTriggers = renderRewardTriggers;
  window.renderBitsThresholds = renderBitsThresholds;
  window.renderSuperchatThresholds = renderSuperchatThresholds;
  // Enhanced DOMContentLoaded with memory management
  global.__domUtils.wireOnceEnhanced(document, 'DOMContentLoaded', initTriggers, 'triggers-init');
})();

// Simulate a bits event for testing bits triggers without spending real bits
window.simulateBits = function(amount = 100, username = 'TestUser') {
  const eventPayload = {
    user_name: username,
    bits: amount,
    bits_used: amount,
    total_bits_used: amount,
  };
  // Try to find a handler for bits events
  if (window.handleBitsEvent) {
    window.handleBitsEvent(eventPayload);
  } else if (window.Game && window.Game.handleBitsEvent) {
    window.Game.handleBitsEvent(eventPayload);
  } else if (window.__eventBus && typeof window.__eventBus.emit === 'function') {
    window.__eventBus.emit('bits', eventPayload);
  } else {
    console.warn('[simulateBits] No handler found for bits event.');
  }
  console.log('[simulateBits] Simulated bits event:', eventPayload);
};
