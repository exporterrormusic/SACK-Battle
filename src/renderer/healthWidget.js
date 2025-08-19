// src/renderer/healthWidget.js
// Health status polling; emits on global event bus (no require needed)
(function(global){
  function initHealthWidget(electronAPI){
    async function refresh(){
      if (!electronAPI || !electronAPI.getTwitchHealth) return;
      try { const h = await electronAPI.getTwitchHealth(); global.__eventBus && global.__eventBus.emit('health:update', h); } catch(_){ }
    }
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }
  global.__initHealthWidget = initHealthWidget;
  if (typeof module !== 'undefined' && module.exports) module.exports = { initHealthWidget };
})(typeof window !== 'undefined' ? window : globalThis);
