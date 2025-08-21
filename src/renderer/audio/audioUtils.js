// audioUtils.js
// Extracted small audio helper from renderer.js for incremental modularization.
// Provides stopAllAudio(sharedState, reason) used by other modules.

export function stopAllAudio(shared, reason){
  try {
    const { overlayMusic, bossAudio, setWaiting } = shared;
    if (overlayMusic && overlayMusic.audio){ try { overlayMusic.audio.pause(); } catch(_){} }
    if (bossAudio && bossAudio.music){ try { bossAudio.music.pause(); } catch(_){} }
    if (setWaiting && setWaiting._waitingAudio){ try { setWaiting._waitingAudio.pause(); } catch(_){} }
    console.log('[AudioStopAll]', reason||'');
  } catch(e){ console.warn('[AudioStopAll] error', e); }
}
