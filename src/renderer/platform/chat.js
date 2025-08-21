// chat.js - twitch chat message handling
(function(global){ const api=global.electronAPI||{}; function onChat(msg){ try { const Game=global.Game; if(!Game) return; const text=(msg.message||'').trim(); if(!text) return; const first=text.split(/\s+/)[0].toLowerCase(); const settings=Game.getState().settings||{}; const cmds=settings.chatCommands||{}; 

// Support both old flat structure and new platform-specific structure
const source = msg.source || 'twitch'; // Default to twitch for backward compatibility
const platformCmds = cmds[source] || {};

console.log('[Chat] Processing message:', { source, text: first, flatCmds: cmds, platformCmds, originalMessage: text });

// Traditional command mapping (define this outside conditions so it's always available)
const map={ 
  attack: platformCmds.attack || cmds.attack || '!attack', 
  cover: platformCmds.cover || cmds.cover || '!cover', 
  heal: platformCmds.heal || cmds.heal || '!heal', 
  aggressive: platformCmds.aggressive || cmds.aggressive || '!aggressive', 
  burst: platformCmds.burst || cmds.burst || '!burst' 
}; 

console.log('[Chat] Command map:', map);

// Check if this is a direct action from Discord (already parsed)
let action = null;
if (source === 'discord' && ['attack', 'cover', 'heal', 'aggressive', 'burst'].includes(first)) {
  action = first;
  console.log('[Chat] Direct Discord action detected:', action);
} else {
  // Traditional command matching for other platforms or unparsed commands
  if(first===map.attack) action='attack'; 
  else if(first===map.cover) action='cover'; 
  else if(first===map.heal) action='heal'; 
  else if(first===map.aggressive) action='aggressive';
  else if(first==='!strike') action='aggressive'; // Handle direct !strike commands
  else if(first===map.burst) action='burst'; 
}

console.log('[Chat] Matched action:', action);

// Additional debugging for command matching
console.log('[Chat] Debug info:', { 
  first, 
  expectedAttack: map.attack, 
  matchesAttack: first === map.attack,
  directAttackMatch: first === '!attack'
});

// Fallback command detection if settings-based matching fails
if (!action) {
  if (first === '!attack') action = 'attack';
  else if (first === '!cover' || first === '!defend') action = 'cover';
  else if (first === '!heal') action = 'heal';
  else if (first === '!aggressive' || first === '!strike') action = 'aggressive';
  else if (first === '!burst') action = 'burst';
  
  if (action) {
    console.log('[Chat] Fallback command detection matched:', action);
  }
}

// Enhanced chat handling with backend sync integration
if(!global.__lastRulesSent) global.__lastRulesSent=0; 
if(first==='!rules'){ 
  const now=Date.now(); 
  if(now-global.__lastRulesSent>120000){ 
    global.__lastRulesSent=now; 
    const summary=(settings.rules && settings.rules.length<=140)?settings.rules:`Attack boss, cover blocks damage, heal restores hearts. Commands: ${map.attack} ${map.cover} ${map.heal} ${map.aggressive} ${map.burst}`; 
    api.sendChatMessage && api.sendChatMessage({ text: summary }); 
  }
}

// Check if we have backend sync available for unified user handling
const hasBackendSync = global.backendSyncHandleChatCommand && typeof global.backendSyncHandleChatCommand === 'function';

console.log('[Chat] Backend sync check:', { 
  hasBackendSync, 
  source, 
  action, 
  backendSyncFunction: typeof global.backendSyncHandleChatCommand 
});

// SPAWN CHARACTER FOR ANY CHAT MESSAGE (not just commands)
// This ensures any chatter gets a character in the game
if (source === 'twitch' && msg.userId && msg.username) {
  if (hasBackendSync) {
    // Use backend sync for consistent user identity
    console.log('[Chat] Processing Twitch chat message:', { user: msg.username, userId: msg.userId, hasAction: !!action });
    
    const userInfo = {
      username: msg.username,
      userId: msg.userId,
      displayName: msg.displayName || msg.username,
      mod: msg.mod || false,
      badges: msg.badges || ''
    };
    
    // Use the detected action, or default to 'attack' if just chatting
    const finalAction = action || 'attack';
    console.log('[Chat] Using backend sync with action:', finalAction);
    global.backendSyncHandleChatCommand(finalAction, userInfo);
    
    // IMPORTANT: Skip the duplicate action processing below since we handled it here
    return;
  } else {
    // Fallback: spawn character directly in game
    const players = Game.getState().players || {};
    if (!players[msg.username]) {
      Game.addPlayer(msg.username, {});
      console.log('[Chat] Added new player for any chat:', msg.username);
    }
    
    // If there's an action, set it
    if (action) {
      Game.setPlayerAction(msg.username, action);
    }
    return;
  }
} else if (source === 'discord' && msg.username) {
  // DISCORD: Always spawn character for any Discord message
  console.log('[Chat] Processing Discord chat message:', { user: msg.username, hasAction: !!action });
  
  const players = Game.getState().players || {};
  if (!players[msg.username]) {
    Game.addPlayer(msg.username, {});
    console.log('[Chat] Added new Discord player for any message:', msg.username);
  }
  
  // Use the detected action, or default to 'attack' if just chatting
  const finalAction = action || 'attack';
  console.log('[Chat] Setting Discord player action:', msg.username, finalAction);
  Game.setPlayerAction(msg.username, finalAction);
  
  // IMPORTANT: Skip the duplicate action processing below since we handled it here
  return;
}

// Legacy fallback for non-Twitch sources or when backend sync unavailable
if (action) {
  if (hasBackendSync && source === 'twitch' && msg.userId) {
    // Use backend sync for Twitch chat commands with user ID (for unified identity)
    console.log('[Chat] Using backend sync for Twitch command:', { user: msg.username, action, userId: msg.userId });
    
    // Create userInfo object with all available user data
    const userInfo = {
      username: msg.username,
      userId: msg.userId,
      displayName: msg.displayName || msg.username,
      mod: msg.mod || false,
      badges: msg.badges || ''
    };
    
    // Handle command through backend sync for unified user identity
    global.backendSyncHandleChatCommand(action, userInfo);
  } else {
    // Fallback to original chat handling for non-Twitch, no userId, or when backend sync unavailable
    console.log('[Chat] Using fallback chat handling for:', { user: msg.username, action, source, hasUserId: !!msg.userId });
    
    const players = Game.getState().players || {};
    
    if (!players[msg.username]) {
      Game.addPlayer(msg.username, {});
      console.log('[Chat] Added new player (fallback):', msg.username);
    }
    
    console.log('[Chat] Setting player action (fallback):', msg.username, action);
    Game.setPlayerAction(msg.username, action);
  }
  
  // Show prebattle if needed
  if (global.__prebattleActive && !Game.getState().running) {
    const existing = document.querySelector('#boss-image-wrapper .game-overlay.prebattle');
    if (existing) existing.classList.add('shown');
    else global.showInitialPrebattle && global.showInitialPrebattle();
  }
} } catch(e){ console.warn('[chat] parse error', e); } } api.onChatMessage && api.onChatMessage(onChat); })(typeof window!=='undefined'?window:globalThis);
