// src/renderer/waitingRoom.js
import { stopAllAudio } from './audioUtils.js';
// Waiting room & pre-battle overlay module (ES module refactor)

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
      ensureWaitingEl();
      if (!waitingEl) return;
      const bg = waitingEl.querySelector('.waiting-bg');
      const mainLogo = waitingEl.querySelector('.waiting-logo.main');
      const secLogo = waitingEl.querySelector('.waiting-logo.secondary');
      const bgPath = settings.waitingBackgroundImage || 'app://assets/ui/menu-bkg.jpg';
      if (bg) {
        bg.style.backgroundImage = bgPath ? `url(${bgPath})` : '';
        bg.style.backgroundSize = 'cover';
        bg.style.backgroundPosition = 'center';
      }
      if (mainLogo) {
        const src = settings.waitingMainLogoImage || 'app://assets/ui/main-logo.png';
        mainLogo.style.backgroundImage = src ? `url(${src})` : '';
        mainLogo.style.backgroundSize = 'contain';
        mainLogo.style.backgroundRepeat = 'no-repeat';
        mainLogo.style.backgroundPosition = 'center';
      }
      if (secLogo) {
        const src2 = settings.waitingSecondaryLogoImage || 'app://assets/ui/secondary-logo.png';
        secLogo.style.backgroundImage = src2 ? `url(${src2})` : '';
        secLogo.style.backgroundSize = 'contain';
        secLogo.style.backgroundRepeat = 'no-repeat';
        secLogo.style.backgroundPosition = 'center';
      }
    } catch(e){ console.warn('[WaitingRoom] rebuild failed', e); }
  }

  function initWaitingAssets(){ ensureWaitingEl(); }

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
      stopAllAudio({ overlayMusic, bossAudio, setWaiting }, 'waitingRoom:setWaiting(true)');
      // Delay creation and playback to avoid race with other music stops
      setTimeout(() => {
          if (!setWaiting._waitingAudio) {
            const w = (window.SackBattle && window.SackBattle.utils && window.SackBattle.utils.audio && window.SackBattle.utils.audio.createAudio)
              ? window.SackBattle.utils.audio.createAudio('app://assets/ui/waiting.mp3', 'music', 1.0)
              : new Audio('app://assets/ui/waiting.mp3');
            w.loop = true;
            try {
              if (window.SackBattle?.utils?.audio && !w.volumeSet) {
                window.SackBattle.utils.audio.updateVolume(w, 'music', 1.0);
              } else if (window.__audioMixer) {
                w.volume = window.__audioMixer.calculateCategoryVolume('music');
              } else {
                w.volume = 0.55; // Fallback if AudioMixer not available
              }
            } catch(_) { w.volume = 0.55; }
            setWaiting._waitingAudio = w;
            w.play().catch(e => console.warn('[WaitingMusic] play failed', e));
        } else {
          // Force AudioMixer to refresh settings from current game state before updating volume
          if (window.__audioMixer && window.Game) {
            const currentState = window.Game.getState();
            if (currentState.settings && currentState.settings.audioSettings) {
              window.__audioMixer.updateAudioSettings(currentState.settings);
              console.log('[WaitingRoom] Refreshed AudioMixer settings for existing waiting audio');
            }
          }
          
          // Update the volume of existing waiting audio to current settings
          if (window.__audioMixer) {
            const newVolume = window.__audioMixer.calculateCategoryVolume('music');
              try {
                if (window.SackBattle?.utils?.audio) {
                  window.SackBattle.utils.audio.updateVolume(setWaiting._waitingAudio, 'music', 1.0);
                } else {
                  setWaiting._waitingAudio.volume = newVolume;
                }
              } catch(_) { setWaiting._waitingAudio.volume = newVolume; }
            console.log('[WaitingRoom] Updated existing waiting music volume to:', newVolume);
          }
          
          // Only play if paused
          if (setWaiting._waitingAudio.paused) {
            try { setWaiting._waitingAudio.play().catch(()=>{}); } catch(_){ }
          }
        }
      }, 300);
    } else {
      document.getElementById('app')?.classList.remove('waiting-active');
      waitingEl.classList.remove('active');
      setTimeout(()=>waitingEl.classList.add('waiting-hidden'),400);
      // Remove hidden-waiting immediately when waiting room is dismissed
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
  window.addEventListener('resize', ()=> adjustPrebattleLines());

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
    ensureWaitingEl();
    if (!waitingEl) return;
    if (wireWaitingDismiss._wired) return; wireWaitingDismiss._wired = true;
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
      document.removeEventListener('click', dismissWaiting, true);
      waitingEl.removeEventListener('click', dismissWaiting, true);
      wireWaitingDismiss._wired = false; // Allow re-wiring after reset
    }
    document.addEventListener('click', dismissWaiting, true);
    waitingEl.addEventListener('click', dismissWaiting, true);
  }

  function initialShow(){
    if (initialShow._done) return; initialShow._done = true;
    // Only call setWaiting(true) once if not already active and music not playing
    if (!waitingActive && (!setWaiting._waitingAudio || setWaiting._waitingAudio.paused)) {
      try { setWaiting(true); rebuildWaitingRoom(); } catch(e){ }
    }
    // Remove redundant timeouts
    wireWaitingDismiss();
  }
export { rebuildWaitingRoom, setWaiting, initWaitingAssets, showInitialPrebattle, adjustPrebattleLines, wireWaitingDismiss };
global.__waitingRoom = { rebuildWaitingRoom, setWaiting, initWaitingAssets, showInitialPrebattle, adjustPrebattleLines, isActive:()=>waitingActive, wireWaitingDismiss };
global.setWaiting = setWaiting;
global.rebuildWaitingRoom = rebuildWaitingRoom;
global.showInitialPrebattle = showInitialPrebattle;
global.initWaitingAssets = initWaitingAssets;
global.wireWaitingDismiss = wireWaitingDismiss;
document.addEventListener('DOMContentLoaded', () => {
  initialShow();
});
