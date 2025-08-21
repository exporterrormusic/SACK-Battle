// src/renderer/persistence.js
// Central debounced persistence queue
(function(){
  const DEBOUNCE_MS = 300;
  let timer = null;
  let pending = false;
  function emit(name, detail){ try { window.dispatchEvent(new CustomEvent(name,{ detail })); } catch(_){} }
  function flush(){
    timer = null;
    try {
      const Game = window.Game; if (Game && window.__settings) { window.__settings.persist(Game); }
    } finally {
      pending = false;
      emit('settings:saved', { ts: Date.now() });
    }
  }
  function schedulePersist(){
    pending = true;
    emit('settings:dirty', { ts: Date.now() });
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  }
  // Optional immediate flush on visibility hide
  document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'hidden' && pending) { if (timer) clearTimeout(timer); flush(); } });
  window.__schedulePersist = schedulePersist;
  // Final safeguard on unload (quit) to flush settings synchronously
  window.addEventListener('beforeunload', ()=>{
    try {
      if (pending) {
        if (timer) clearTimeout(timer);
        flush();
      } else if (window.Game && window.__settings) {
        window.__settings.persist(window.Game);
      }
    } catch(_){ }
  });
})();
