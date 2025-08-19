// settingsTabs.js - tab switching logic for settings modal (extracted)
(function(){
  function activateTab(name){
    document.querySelectorAll('#settings-tabs .tab-btn').forEach(btn=>{
      const active = btn.getAttribute('data-tab') === name;
      btn.classList.toggle('active', active);
    });
    document.querySelectorAll('#settings-modal .settings-tab').forEach(panel=>{
      const id = panel.id.replace('settings-','');
      panel.classList.toggle('active', id === name);
    });
  }
  function wireTabs(){
    const container = document.getElementById('settings-tabs');
    if(!container || container._wiredTabs) return;
    container._wiredTabs = true;
    container.addEventListener('click', (e)=>{
      const btn = e.target.closest('.tab-btn');
      if(!btn) return;
      const name = btn.getAttribute('data-tab');
      if(!name) return;
      activateTab(name);
    });
  }
  document.addEventListener('DOMContentLoaded', wireTabs);
  window.__activateSettingsTab = activateTab;
})();
