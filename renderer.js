// renderer.js (minimal stub after modular extraction)

window.addEventListener('DOMContentLoaded', () => {
  const Game = window.Game;
  // Force load persisted player records and log
  if (window.__settings && typeof window.__settings.loadPersisted === 'function') {
    window.__settings.loadPersisted(Game).then(() => {
      try {
        const records = Game.getPlayerRecords && Game.getPlayerRecords();
        let changed = false;
        Object.keys(records || {}).forEach(name => {
          if (records[name].reviveItem) {
            records[name].reviveItem = false;
            changed = true;
            console.log('[RendererPatch][DEBUG] Cleared reviveItem for', name);
          }
        });
        if (changed && window.electronAPI && window.electronAPI.saveSettings) {
          window.electronAPI.saveSettings({ playerRecords: records });
          console.log('[RendererPatch][DEBUG] Saved cleared reviveItems to settings');
        }
        console.log('[RendererStartup] loadPersisted called, playerRecords:', JSON.stringify(records));
      } catch(e) {}
    });
  }
  window.__gameLoopDeps = {
    ensureAvatarsAssigned: window.__ensureAvatarsAssigned,
    renderPlayers: window.renderPlayers,
    updateBossUI: (st)=>window.__bossUI?.updateBossUI?.(st),
    updateBattlefield: ()=>window.__bossUI?.updateBattlefield?.(window.selectedBattlefield),
    populateRanksTab: ()=> window.populateRanksTab && window.populateRanksTab(),
    renderRecords: ()=> window.renderRecords && window.renderRecords(),
    updateBuffIconTimers: ()=> window.__buffsModule?.updateBuffIconTimers?.(Game.getState()),
    flashBattlefield: window.flashBattlefield,
    shakeHitPlayers: window.shakeHitPlayers,
    showInitialPrebattle: window.showInitialPrebattle,
    applyVictoryDefeatOverlay: ()=> window.__gameBindings?.applyVictoryDefeatOverlay?.(),
    renderScoreboardIfNeeded: (f)=> window.__gameBindings?.renderScoreboardIfNeeded?.(f),
    updateRoundMatchHeader: (st)=> window.__gameBindings?.updateRoundMatchHeader?.(st),
    initWaitingAssets: window.initWaitingAssets
  };
  window.__prebattleActive = true;
});
// All prior orchestration logic is now in: assets.js, avatars.js, fx.js, chat.js, oauth.js, debugPanel.js, uiExtras.js, startController.js
// (File intentionally minimal.)
