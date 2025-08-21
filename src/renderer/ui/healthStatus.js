// src/renderer/healthStatus.js
(function(){
  async function refreshHealth(){
    const electronAPI=window.electronAPI;
    const healthChatEl=document.getElementById('health-chat');
    const healthEventSubEl=document.getElementById('health-eventsub');
    const healthTokenEl=document.getElementById('health-token');
    try {
      if (!electronAPI || !electronAPI.getTwitchHealth) return;
      const h=await electronAPI.getTwitchHealth();
      if (healthChatEl) healthChatEl.textContent = h && h.chat || '?';
      if (healthEventSubEl) healthEventSubEl.textContent = h && h.eventSub || '?';
      if (healthTokenEl) {
        if (h && h.expiresAt) {
          const msLeft = h.expiresAt - Date.now();
            const hrs = Math.max(0, Math.floor(msLeft/3600000));
            healthTokenEl.textContent = hrs + 'h';
            if (msLeft < 3600000) healthTokenEl.style.color = '#ff6666';
            else if (msLeft < 6*3600000) healthTokenEl.style.color = '#ffc966';
            else healthTokenEl.style.color = '#b7ff8a';
        } else { healthTokenEl.textContent='?'; healthTokenEl.style.color=''; }
      }
    } catch(e){ if (healthTokenEl) healthTokenEl.title='Health fetch failed: '+e.message; }
  }
  function scheduleHealth(){
    refreshHealth();
    setInterval(()=> refreshHealth(), 60000);
    setTimeout(()=> refreshHealth(), 2500);
    setTimeout(()=> refreshHealth(), 8000);
  }
  document.addEventListener('DOMContentLoaded', scheduleHealth);
  window.refreshTwitchHealth = refreshHealth;
})();
