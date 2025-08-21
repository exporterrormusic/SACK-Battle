// src/renderer/waitingRoom.js
// Waiting room & pre-battle overlay module (converted back to regular script)

console.log('[WaitingRoom] Script loading started');

(function() {
'use strict';

console.log('[WaitingRoom] IIFE started');
const global = typeof window !== 'undefined' ? window : globalThis;
const audio = global.__audioModule;
const overlayMusic = audio ? audio.state.overlayMusic : { type:null, audio:null };
const bossAudio = audio ? audio.state.bossAudio : { music:null };

  // State
let waitingEl = null;
let waitingActive = false; // exported via global.waitingActive for legacy code
  function ensureWaitingEl(){
    if (!waitingEl) waitingEl = document.getElementById('welcome-screen');
    return waitingEl;
  }

  function rebuildWaitingRoom(){
    try {
      const Game = global.Game;
      const gs = Game && Game.getState ? Game.getState() : null;
      const settings = gs && gs.settings ? gs.settings : {};
      console.log('[WaitingRoom] rebuildWaitingRoom called');
    } catch(e){ console.warn('[WaitingRoom] rebuild failed', e); }
  }

  function initWaitingAssets(){
    const bgEl = document.querySelector('.waiting-bg');
    const logoMain = document.querySelector('.waiting-logo.main');
    const logoSec = document.querySelector('.waiting-logo.secondary');
    if (bgEl) bgEl.style.backgroundImage = 'url("app://assets/ui/menu-bkg.jpg")';
    if (logoMain) logoMain.style.backgroundImage = 'url("app://assets/ui/main-logo.png")';
    if (logoSec) logoSec.style.backgroundImage = 'url("app://assets/ui/secondary-logo.png")';
  }

  function setWaiting(active){
    waitingActive = !!active; global.waitingActive = waitingActive; // preserve legacy global var
    ensureWaitingEl();
    if (!waitingEl) return;
    const playersContainer = document.getElementById('players-container');
    const bossContainer = document.getElementById('boss-container');
    if (active){
      document.getElementById('app')?.classList.add('waiting-active');
      waitingEl.classList.add('active');
      waitingEl.classList.remove('waiting-hidden');
      playersContainer?.classList.add('hidden-waiting');
      bossContainer?.classList.add('hidden-waiting');
      global.__prebattleActive = true;
      if (typeof wireWaitingDismiss !== 'undefined') wireWaitingDismiss._pbShown = false;
      try { const Game = global.Game; if (Game && Game.pause && Game.getState().running) Game.pause(); } catch(_){ }
      setWaiting._prevMusic = { overlay: (overlayMusic && overlayMusic.type) || null, boss: (bossAudio.music ? bossAudio.music : null) };
      // Stop previous music BEFORE creating and playing waiting.mp3
      try {
        if (overlayMusic && overlayMusic.audio){ try { overlayMusic.audio.pause(); } catch(_){} }
        if (bossAudio && bossAudio.music){ try { bossAudio.music.pause(); } catch(_){} }
        console.log('[AudioStopAll] waitingRoom:setWaiting(true)');
      } catch(e){ console.warn('[AudioStopAll] error', e); }
      // Delay creation and playback to avoid race with other music stops
      setTimeout(() => {
          if (!setWaiting._waitingAudio) {
            const w = (window.SackBattle && window.SackBattle.utils && window.SackBattle.utils.audio && window.SackBattle.utils.audio.createAudio)
              ? window.SackBattle.utils.audio.createAudio('app://assets/ui/waiting.mp3', 'music', 1.0)
              : new Audio('app://assets/ui/waiting.mp3');
            w.loop = true;
            try {
              if (window.SackBattle?.utils?.audio && !w.volumeSet) {
                const vol = window.SackBattle.utils.audio.getVolumeForCategory('music');
                if (typeof vol === 'number') { w.volume = vol; w.volumeSet = true; }
              } else if (!w.volumeSet && window.__audioMixer) { 
                w.volume = window.__audioMixer.getEffectiveVolume('music'); w.volumeSet = true; 
              }
            } catch(e){ console.warn('[WaitingAudio] Volume setup failed', e); }
            w.addEventListener('canplaythrough', () => {
              try { if (!w.paused) return; w.play().catch(err => console.warn('[WaitingMusic] play failed:', err)); } catch(e){ console.warn('[WaitingMusic] canplaythrough handler failed', e); }
            }, { once: true });
            setWaiting._waitingAudio = w;
          }
          // Only play if not already playing
          if (setWaiting._waitingAudio.paused) {
            try { setWaiting._waitingAudio.play().catch(err => console.warn('[WaitingMusic] play after creation failed:', err)); } catch(e){ console.warn('[WaitingMusic] play exception', e); }
          }
      }, 300);
    } else {
      document.getElementById('app')?.classList.remove('waiting-active');
      waitingEl.classList.remove('active');
      waitingEl.classList.add('waiting-hidden');
      playersContainer?.classList.remove('hidden-waiting');
      bossContainer?.classList.remove('hidden-waiting');
      if (setWaiting._waitingAudio) { try { setWaiting._waitingAudio.pause(); } catch(_){ } }
      // Do NOT resume previous overlay music if coming from reset; prebattle overlay/music will handle it
      setWaiting._prevMusic = null;
      try { const Game = global.Game; if (Game && Game.getState().running && Game.resume) Game.resume(); } catch(_){ }
      if (audio && audio.onWaitingDismissed) audio.onWaitingDismissed();
    }
      setTimeout(()=>{
        if (!global.__suppressPrebattle && global.__prebattleActive && !document.querySelector('#boss-image-wrapper .game-overlay.prebattle')){
          if (typeof global.showInitialPrebattle === 'function') global.showInitialPrebattle();
        }
      }, 35);
  }

  function adjustPrebattleLines(){
    const battleEl = document.querySelector('.game-overlay.prebattle .battle-word');
    const commEl = document.querySelector('.game-overlay.prebattle .commencing-word');
    if (!battleEl || !commEl) return;
    battleEl.style.display='block';
    commEl.style.display='block';
    battleEl.style.fontSize='';
    commEl.style.fontSize='';
    const parent = battleEl.parentElement; if (parent) parent.style.textAlign='center';
    const maxViewportWidth = window.innerWidth * 0.92;
    const minPx = 12;
    let battleSize = parseFloat(getComputedStyle(battleEl).fontSize)||64;
    let commSize = parseFloat(getComputedStyle(commEl).fontSize)||48;
    const ratio = commSize / battleSize;
    let loops = 240;
    function widest(){
      const bW = battleEl.getBoundingClientRect().width;
      const cW = commEl.getBoundingClientRect().width;
      return Math.max(bW,cW);
    }
    while (loops-- > 0 && widest() > maxViewportWidth) {
      if (battleSize <= minPx) break;
      battleSize -= 1;
      commSize = Math.max(minPx, battleSize * ratio);
      battleEl.style.fontSize = battleSize + 'px';
      commEl.style.fontSize = commSize + 'px';
    }
    const bW = battleEl.getBoundingClientRect().width;
    let cW = commEl.getBoundingClientRect().width;
    if (cW > bW * 1.08) {
      loops = 120;
      while (loops-- > 0 && cW > bW * 1.08 && commSize > minPx) {
        commSize -= 1;
        commEl.style.fontSize = commSize + 'px';
        cW = commEl.getBoundingClientRect().width;
      }
    }
    let stillLoops = 80;
    while (widest() > maxViewportWidth && stillLoops-- > 0) {
      const cs = parseFloat(getComputedStyle(commEl).letterSpacing)||0;
      const bs = parseFloat(getComputedStyle(battleEl).letterSpacing)||0;
      if (cs <= 0.5 && bs <= 0.5) break;
      commEl.style.letterSpacing = Math.max(0, cs - 0.25) + 'px';
      battleEl.style.letterSpacing = Math.max(0, bs - 0.2) + 'px';
    }
  }

  function showInitialPrebattle(){
    if (global.__suppressPrebattle) { console.log('[Prebattle] Suppressed (flag)'); return; }
    if (waitingActive) { console.log('[Prebattle] Blocked: welcome screen still active'); return; }
    const wrap = document.getElementById('boss-image-wrapper');
    if (!wrap) return;
    wrap.classList.add('prebattle');
    let overlay = wrap.querySelector('.game-overlay.prebattle');
    if (!overlay){
      overlay = document.createElement('div');
      overlay.className='game-overlay prebattle shown';
      overlay.innerHTML = `<div class="outcome-text"><h1 class="outcome-main"><span class="battle-word">BATTLE</span><span class="commencing-word">COMMENCING</span></h1><div class="outcome-hint">TYPE IN CHAT TO SPAWN</div></div>`;
      wrap.appendChild(overlay);
      console.log('[Prebattle] Overlay created');
    } else {
      overlay.classList.add('shown');
      console.log('[Prebattle] Overlay reused');
    }
    wrap.classList.add('has-prebattle-overlay');
    setTimeout(adjustPrebattleLines, 30);
    if (overlay) overlay.style.backdropFilter = 'blur(14px) brightness(0.9) saturate(1.35)';
    const bossOverlaySection = document.getElementById('boss-overlay'); if (bossOverlaySection) bossOverlaySection.style.display='none';
    const img = document.getElementById('boss-image'); if (img && !img._prebattleSet){ img.src = 'app://assets/ui/default-start.png'; img._prebattleSet = true; }
    if (typeof waitingActive === 'undefined' || !waitingActive) {
      global.playOverlayMusic && global.playOverlayMusic('prebattle');
    } else {
      console.log('[Prebattle] Deferring prebattle music until waiting dismissed');
      if (overlayMusic && overlayMusic.type !== 'prebattle') { /* nothing */ }
      else if (!overlayMusic.audio) { global.playOverlayMusic && global.playOverlayMusic('prebattle'); if (overlayMusic.audio) { overlayMusic._deferPlay = true; try { overlayMusic.audio.pause(); } catch(_){ } } }
    }
    global.showInitialPrebattle = showInitialPrebattle; // legacy alias
  }

  function wireWaitingDismiss(){
    if (wireWaitingDismiss._wired) return;
    wireWaitingDismiss._wired = true;
    function launchPrebattleOnce(){ if (wireWaitingDismiss._pbShown) return; wireWaitingDismiss._pbShown = true; showInitialPrebattle(); }
    function dismissWaiting(e){
      if (!waitingActive) return;
      if ((e.target.closest && (e.target.closest('#dev-bar') || e.target.closest('#settings-modal')))) return;
      console.log('[Welcome] Dismiss via click');
      setWaiting(false);
      const prevSuppress = global.__suppressPrebattle;
      global.__suppressPrebattle = false;
      launchPrebattleOnce();
      global.__suppressPrebattle = prevSuppress; // restore
      global.__domUtils.removeEventHandler('waiting-room-document-click');
      global.__domUtils.removeEventHandler('waiting-room-element-click');
      wireWaitingDismiss._wired = false; // Allow re-wiring after reset
    }
    const waitingEl = document.getElementById('welcome-screen');
    if (waitingEl && global.__domUtils) {
      global.__domUtils.addEventHandler(waitingEl, 'click', dismissWaiting, 'waiting-room-element-click');
      global.__domUtils.addEventHandler(document, 'click', dismissWaiting, 'waiting-room-document-click');
    }
  }

  function initialShow(){
    console.log('[WaitingRoom] initialShow called, checking if already done:', !!initialShow._done);
    if (initialShow._done) return; initialShow._done = true;
    console.log('[WaitingRoom] Executing initialShow - waitingActive:', waitingActive);
    console.log('[WaitingRoom] Waiting audio state:', setWaiting._waitingAudio ? 'exists' : 'none', setWaiting._waitingAudio?.paused ? 'paused' : 'playing');
    // Only call setWaiting(true) once if not already active and music not playing
    if (!waitingActive && (!setWaiting._waitingAudio || setWaiting._waitingAudio.paused)) {
      console.log('[WaitingRoom] Calling setWaiting(true) and rebuildWaitingRoom');
      try { setWaiting(true); rebuildWaitingRoom(); } catch(e){ console.error('[WaitingRoom] Error in setWaiting/rebuild:', e); }
    } else {
      console.log('[WaitingRoom] Skipping setWaiting - already active or music playing');
    }
    // Remove redundant timeouts
    wireWaitingDismiss();
  }

// Global exports
global.__waitingRoom = { rebuildWaitingRoom, setWaiting, initWaitingAssets, showInitialPrebattle, adjustPrebattleLines, isActive:()=>waitingActive, wireWaitingDismiss, initialShow };
global.setWaiting = setWaiting;
global.rebuildWaitingRoom = rebuildWaitingRoom;
global.showInitialPrebattle = showInitialPrebattle;
global.initWaitingAssets = initWaitingAssets;
global.wireWaitingDismiss = wireWaitingDismiss;

// Ensure domUtils is available before wiring
function initializeWaitingRoom() {
  console.log('[WaitingRoom] Initializing waiting room');
  initWaitingAssets();
  const checkForWaiting = () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen && !waitingActive) {
      initialShow();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForWaiting);
  } else {
    checkForWaiting();
  }
}

// Initialize immediately or wait for domUtils
console.log('[WaitingRoom] Module initialized, domUtils available:', !!global.__domUtils);
if (global.__domUtils) {
  console.log('[WaitingRoom] domUtils available, calling initializeWaitingRoom immediately');
  initializeWaitingRoom();
} else {
  // Wait a bit for domUtils to load
  console.log('[WaitingRoom] domUtils not available, waiting 100ms');
  setTimeout(() => {
    if (global.__domUtils) {
      console.log('[WaitingRoom] domUtils now available, calling initializeWaitingRoom');
      initializeWaitingRoom();
    } else {
      console.warn('[WaitingRoom] domUtils still not available after 100ms, initializing anyway');
      initializeWaitingRoom();
    }
  }, 100);
}

})(); // End IIFE

console.log('[WaitingRoom] Module loading complete');
