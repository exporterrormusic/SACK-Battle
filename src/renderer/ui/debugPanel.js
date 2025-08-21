// debugPanel.js - live debug log viewer
(function(global){ const api=global.electronAPI||{}; function init(){ if(document.getElementById('debug-log-panel')) return; const panel=document.createElement('div'); panel.id='debug-log-panel'; panel.style.cssText='position:fixed;right:6px;bottom:6px;width:340px;max-height:320px;overflow:auto;background:rgba(20,24,40,0.82);backdrop-filter:blur(6px);padding:6px 8px 10px;border:1px solid #33466a;border-radius:10px;font-size:0.6rem;line-height:1.25;z-index:999;'; panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;font-weight:700;letter-spacing:0.06em;color:#9ab4ff;">DEBUG LOG<div style="display:flex;gap:4px;"><button id="debug-log-refresh" style="background:#2f4d7a;color:#d0e2ff;border:none;border-radius:6px;padding:2px 6px;font-size:0.55rem;cursor:pointer;">Refresh</button><button id="debug-log-copy" style="background:#2d6d58;color:#d0ffe9;border:none;border-radius:6px;padding:2px 6px;font-size:0.55rem;cursor:pointer;">Copy</button><button id="debug-log-clear" style="background:#6d2d2d;color:#ffd0d0;border:none;border-radius:6px;padding:2px 6px;font-size:0.55rem;cursor:pointer;">Clear</button></div></div><div id="backend-sync-controls" style="margin-bottom:8px;padding:6px;background:rgba(80,120,160,0.1);border-radius:6px;border:1px solid rgba(80,120,160,0.3);"><div style="font-weight:700;color:#9ab4ff;margin-bottom:4px;font-size:0.58rem;">BACKEND SYNC</div><div style="display:flex;gap:4px;flex-wrap:wrap;"><button id="backend-sync-status" style="background:#444;color:#fff;border:none;border-radius:4px;padding:2px 6px;font-size:0.52rem;cursor:pointer;">Status</button><button id="backend-sync-manual" style="background:#2d6d58;color:#d0ffe9;border:none;border-radius:4px;padding:2px 6px;font-size:0.52rem;cursor:pointer;">Manual Poll</button><button id="backend-sync-health" style="background:#2f4d7a;color:#d0e2ff;border:none;border-radius:4px;padding:2px 6px;font-size:0.52rem;cursor:pointer;">Health</button><button id="backend-sync-toggle" style="background:#6d2d2d;color:#ffd0d0;border:none;border-radius:4px;padding:2px 6px;font-size:0.52rem;cursor:pointer;">Stop</button></div></div><div id="debug-log-entries"></div>'; document.body.appendChild(panel); const entries=panel.querySelector('#debug-log-entries'); function add(e){ const div=document.createElement('div'); const ts=new Date(e.ts).toLocaleTimeString(); div.textContent='['+ts+'] '+e.scope+': '+e.message+(e.error?(' '+e.error):''); div.style.whiteSpace='pre'; entries.appendChild(div); while(entries.children.length>300) entries.removeChild(entries.firstChild); entries.scrollTop=entries.scrollHeight; } api.onDebugLog && api.onDebugLog(add); async function refresh(){ if(!api.getDebugLog) return; const snap=await api.getDebugLog(); entries.innerHTML=''; snap.forEach(add); } panel.querySelector('#debug-log-refresh')?.addEventListener('click',refresh); const copyBtn=panel.querySelector('#debug-log-copy'); copyBtn?.addEventListener('click', async ()=>{ const snap=await api.getDebugLog?.(); if(!snap) return; const text=snap.map(e=>{ const ts=new Date(e.ts).toISOString(); return `${ts}\t${e.scope}\t${e.message}`+(e.error?`\t${e.error}`:''); }).join('\n'); try { await navigator.clipboard.writeText(text); copyBtn.textContent='Copied'; setTimeout(()=>copyBtn.textContent='Copy',1500);} catch(_){ copyBtn.textContent='Fail'; setTimeout(()=>copyBtn.textContent='Copy',1500);} }); panel.querySelector('#debug-log-clear')?.addEventListener('click', async ()=>{ if(api.clearDebugLog) await api.clearDebugLog(); entries.innerHTML=''; }); 

// Backend sync controls
panel.querySelector('#backend-sync-status')?.addEventListener('click', ()=>{
  const bs = global.__backendSync;
  if (bs) {
    console.log('[Debug] Backend sync status:', {
      isPolling: bs.isPolling(),
      config: bs.config
    });
    add({ ts: Date.now(), scope: 'BackendSync', message: `Status: ${bs.isPolling() ? 'Running' : 'Stopped'}, URL: ${bs.config.BACKEND_URL}` });
  } else {
    add({ ts: Date.now(), scope: 'BackendSync', message: 'Backend sync not available' });
  }
});

panel.querySelector('#backend-sync-manual')?.addEventListener('click', ()=>{
  const bs = global.__backendSync;
  if (bs && bs.manual) {
    add({ ts: Date.now(), scope: 'BackendSync', message: 'Manual poll triggered' });
    bs.manual();
  } else {
    add({ ts: Date.now(), scope: 'BackendSync', message: 'Manual poll not available' });
  }
});

panel.querySelector('#backend-sync-health')?.addEventListener('click', async ()=>{
  const bs = global.__backendSync;
  if (bs && bs.health) {
    add({ ts: Date.now(), scope: 'BackendSync', message: 'Checking backend health...' });
    const health = await bs.health();
    add({ ts: Date.now(), scope: 'BackendSync', message: `Health: ${health ? JSON.stringify(health) : 'Failed'}` });
  } else {
    add({ ts: Date.now(), scope: 'BackendSync', message: 'Health check not available' });
  }
});

const toggleBtn = panel.querySelector('#backend-sync-toggle');
toggleBtn?.addEventListener('click', ()=>{
  const bs = global.__backendSync;
  if (bs) {
    if (bs.isPolling()) {
      bs.stop();
      toggleBtn.textContent = 'Start';
      toggleBtn.style.background = '#2d6d58';
      add({ ts: Date.now(), scope: 'BackendSync', message: 'Polling stopped' });
    } else {
      bs.start();
      toggleBtn.textContent = 'Stop';
      toggleBtn.style.background = '#6d2d2d';
      add({ ts: Date.now(), scope: 'BackendSync', message: 'Polling started' });
    }
  } else {
    add({ ts: Date.now(), scope: 'BackendSync', message: 'Backend sync not available' });
  }
});

const toggle=document.createElement('div'); toggle.id='debug-log-toggle'; toggle.style.cssText='position:absolute;top:2px;right:4px;width:14px;height:14px;cursor:pointer;font-size:12px;line-height:14px;text-align:center;background:rgba(255,255,255,0.12);border-radius:4px;user-select:none;'; panel.appendChild(toggle); const stateKey='debugLogCollapsed'; function apply(coll){ if(coll){ panel.dataset.collapsed='1'; panel.style.width='20px'; panel.style.height='20px'; panel.style.padding='2px'; panel.style.overflow='hidden'; panel.querySelectorAll(':scope > div:not(#debug-log-toggle)').forEach(el=>el.style.display='none'); toggle.textContent='◻'; } else { panel.dataset.collapsed='0'; panel.style.width='340px'; panel.style.maxHeight='320px'; panel.style.height=''; panel.style.padding='6px 8px 10px'; panel.querySelectorAll(':scope > div').forEach(el=>{ if(el.id!=='debug-log-toggle') el.style.display=''; }); toggle.textContent='–'; } try { localStorage.setItem(stateKey, coll?'1':'0'); } catch(_){ } } toggle.addEventListener('click',()=>apply(!(panel.dataset.collapsed==='1'))); let stored=null; try { stored=localStorage.getItem(stateKey); } catch(_){ } apply(stored==='1'); refresh(); }
  document.addEventListener('DOMContentLoaded', init);
})(typeof window!=='undefined'?window:globalThis);
