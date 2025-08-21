// src/renderer/eventBus.js
// Tiny pub/sub bus to decouple renderer modules (UMD-ish: works with or without CommonJS bundler).
(function(global){
  if (global.__eventBus) return; // singleton guard
  const listeners = {};
  function on(evt, cb){ (listeners[evt] ||= new Set()).add(cb); return () => { try { listeners[evt].delete(cb); } catch(_){} }; }
  function emit(evt, payload){ if (!listeners[evt]) return; [...listeners[evt]].forEach(cb=>{ try { cb(payload); } catch(e){ console.warn('[eventBus]', evt, 'handler error', e); } }); }
  function once(evt, cb){ const off = on(evt, (p)=>{ off(); cb(p); }); return off; }
  const api = { on, emit, once };
  global.__eventBus = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
