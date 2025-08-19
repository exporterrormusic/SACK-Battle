// src/renderer/playerRender.js
(function(){
  function createPlayerElement(username, playerState, avatarsList, Game){
    const card=document.createElement('div');
    card.classList.add('player-card');
    card.dataset.name=username;
    if (playerState.dying) card.classList.add('dying');
    
    // Clear all glow classes first, then add the correct one
    card.classList.remove('glow-yellow', 'glow-red');
    if (playerState.hp === 2) card.classList.add('glow-yellow');
    if (playerState.hp === 1) card.classList.add('glow-red');
    
    // Always add action class for visuals
    const actionClass = (playerState.lastAction||'').toLowerCase();
    if(['attack','cover','heal','aggressive','burst'].includes(actionClass)) {
      card.classList.add('action-'+actionClass);
    } else {
      card.classList.remove('action-attack','action-cover','action-heal','action-aggressive','action-burst');
    }
    const maxHp=3;
    const heartsContainer=document.createElement('div'); heartsContainer.className='hearts-container';
    for (let i=0;i<maxHp;i++){
      const heart=document.createElement('div'); heart.className='heart';
      if (i >= playerState.hp) heart.classList.add('heart-empty');
      const prev=window.__prevPlayersState && window.__prevPlayersState[username];
      if (prev && typeof prev.hp==='number' && prev.hp!==playerState.hp){
        if (playerState.hp < prev.hp && i>=playerState.hp && i<prev.hp) heart.classList.add('hit');
        else if (playerState.hp > prev.hp && i<playerState.hp && i>=prev.hp) heart.classList.add('heal');
      }
      heartsContainer.appendChild(heart);
    }
    if (playerState.hasReviveItem){
      const reviveIcon=document.createElement('div'); reviveIcon.className='revive-item-badge';
      const core=document.createElement('div'); core.className='revive-core'; reviveIcon.appendChild(core);
      reviveIcon.title='Revive item'; card.appendChild(reviveIcon);
    }
    
    // Enhanced Burst gauge display with integrated design - 5 individual pips with dividing lines
    if (typeof playerState.burstGauge === 'number') {
      const burstContainer = document.createElement('div');
      burstContainer.className = 'burst-gauge-container';
      burstContainer.title = `Burst Gauge: ${playerState.burstGauge}/5`;
      
      // Create 5 individual pips to clearly show progress out of 5
      for (let i = 0; i < 5; i++) {
        const burstPip = document.createElement('div');
        burstPip.className = 'burst-pip';
        
        // Fill the pip if the burst gauge is high enough
        if (playerState.burstGauge > i) {
          burstPip.classList.add('burst-pip-filled');
          // For partial fills on the current pip
          if (i === Math.floor(playerState.burstGauge) && playerState.burstGauge % 1 !== 0) {
            const partialFill = (playerState.burstGauge % 1) * 100;
            burstPip.style.setProperty('--fill-width', `${partialFill}%`);
          } else {
            burstPip.style.setProperty('--fill-width', '100%');
          }
        } else {
          burstPip.style.setProperty('--fill-width', '0%');
        }
        
        burstContainer.appendChild(burstPip);
      }
      
      // Only add burst-ready class if burst gauge is actually 5 or higher
      if (playerState.burstGauge >= 5) {
        burstContainer.classList.add('burst-ready');
      } else {
        burstContainer.classList.remove('burst-ready');
      }
      
      card.appendChild(burstContainer);
    }
    
    if (playerState.invincibleTurns && playerState.invincibleTurns>0){ card.classList.add('player-invincible'); }
    const avatar=document.createElement('img');
  avatar.className='player-avatar';
  avatar.src = playerState.avatar ? `app://assets/avatars/${playerState.avatar}` : (avatarsList[0] ? `app://assets/avatars/${avatarsList[0]}` : '');
    if(['attack','cover','heal','aggressive','burst'].includes(actionClass)) {
      avatar.classList.add('action-'+actionClass);
    } else {
      avatar.classList.remove('action-attack','action-cover','action-heal','action-aggressive','action-burst');
    }
    console.log('[PlayerRender][DEBUG] Avatar src for', username, ':', avatar.src);
    const header=document.createElement('div'); header.className='player-header';
    let rankTitle='';
    try { const rankDefs=(Game.getState().settings||{}).rankDefinitions||[]; const score=playerState.score||0; let current=rankDefs[0]; rankDefs.forEach(r=>{ if (score>=r.wins) current=r; }); rankTitle=current?current.name:'Rookie'; } catch(_){ rankTitle='Rookie'; }
    header.innerHTML=`<div class="player-name">${username}</div><div class="player-rank">${rankTitle}</div>`;
    const lastAction=document.createElement('div'); lastAction.className='player-last-action';
    const la=(playerState.lastAction||'').toLowerCase();
    if(['attack','cover','heal','aggressive','burst'].includes(la)){ 
      // Display "strike" instead of "aggressive" for user interface
      const displayAction = la === 'aggressive' ? 'strike' : la;
      lastAction.textContent=displayAction; 
      lastAction.classList.add('action-'+la); 
      if (la === 'aggressive') {
        card.classList.add('aggressive-glow');
        setTimeout(() => card.classList.remove('aggressive-glow'), 1500);
      }
    } else { 
      lastAction.textContent='waiting'; 
      lastAction.classList.add('waiting'); 
    }
    card.appendChild(heartsContainer); card.appendChild(avatar); card.appendChild(header); card.appendChild(lastAction);
    return card;
  }
  function renderPlayers(players){
    const Game=window.Game;
    const gameState = Game && Game.getState ? Game.getState() : {};
    const container=document.getElementById('players-container'); 
    if (!container) return;
    
    // Check if scoreboard is active - if so, don't render player avatars
    const scoreboardActive = !!(container && container.classList.contains('scoreboard-active')) || 
                             !!(container && container.querySelector('.scoreboard-head')) ||
                             window.__scoreboardActive ||
                             gameState.victoryState;
    
    // If scoreboard is active, don't interfere with it
    if (scoreboardActive) {
      console.log('[PlayerRender][DEBUG] Skipping player render - scoreboard active');
      return;
    }
    
    const preserve=new Set(['buff-anim-layer']);
    Array.from(container.children).forEach(ch=>{
      if (ch.classList && ch.classList.contains('scoreboard-head')) return;
      if (ch.id && preserve.has(ch.id)) return;
      if (ch.classList && ch.classList.contains('player-card')) ch.remove();
      else if (!ch.classList || (!ch.classList.contains('scoreboard-grid') && !ch.classList.contains('scoreboard-head'))){
        if (ch.nodeType===1 && !preserve.has(ch.id)) ch.remove();
      }
    });
    // Patch: Remove all previous player-card elements before rendering new ones
    Array.from(container.querySelectorAll('.player-card')).forEach(el => el.remove());
    const avatarsList = window.__avatarsList || [];
    Object.entries(players).forEach(([username, ps])=>{
      // Only skip rendering if player is currently dying/dead AND visibleGone is true
      // Allow respawned players (hp > 0) to render even if visibleGone was previously true
      if (ps.visibleGone && (ps.hp <= 0 || ps.dying)) return;
      // Always create a new avatar <img> element
      const el=createPlayerElement(username, ps, avatarsList, Game);
      if (ps.dying){ el.addEventListener('animationend', ev=>{ if (ev.animationName==='playerDie') el.remove(); }); }
      container.appendChild(el);
      // Extra debug: log avatar src and DOM
      const avatarImg = el.querySelector('.player-avatar');
      if (avatarImg) {
        console.log('[PlayerRender][DEBUG] Avatar img src for', username, ':', avatarImg.src);
      }
    });
    const gs=Game.getState();
    Object.entries(players).forEach(([username,p])=>{
      if (p.pendingRespawn && gs.settings.respawnMode==='cooldown'){
        const card=Array.from(container.children).find(el=>el.querySelector('.player-name')?.textContent===username);
        if (card && !card.querySelector('.respawn-badge')){
          const badge=document.createElement('div'); badge.className='respawn-badge'; badge.textContent=p.respawnCooldown||0; card.appendChild(badge);
        } else if (card){ const badge=card.querySelector('.respawn-badge'); if (badge) badge.textContent=p.respawnCooldown||0; }
      }
    });
  }
  window.renderPlayers = renderPlayers;
})();
