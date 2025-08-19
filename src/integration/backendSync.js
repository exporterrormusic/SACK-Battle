// backendSync.js - Bridge between Twitch Extension Backend and Game
// This script polls the Vercel backend for pending commands and executes them in the game

(function(global) {
  'use strict';

  try {
    console.log('[BackendSync] Starting initialization...');

    // Configuration
    const BACKEND_URL = 'https://sack-battle-backend-h7nc8e6ks-exporterrormusics-projects.vercel.app'; // Use correct Vercel backend
    const POLL_INTERVAL = 2000; // 2 seconds
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000; // 5 seconds

    let isPolling = false;
    let pollInterval = null;
    let retryCount = 0;

    // User mapping for unified identity across chat and extension
    const userMapping = new Map(); // twitchUserId -> gameUsername
    const usernameToId = new Map(); // chatUsername -> twitchUserId

    // Utility function to check if we're in browser environment
    const isBrowser = typeof window !== 'undefined';
    const Game = isBrowser ? global.Game : null;

    console.log('[BackendSync] Environment check passed - isBrowser:', isBrowser);

  // User mapping functions
  function registerChatUser(userInfo) {
    const { username, userId, displayName, mod, badges } = userInfo;
    
    if (!userId) {
      console.warn('[BackendSync] No user ID provided for chat user:', username);
      return username; // Fallback to username
    }

    // Check if we already have a mapping
    if (userMapping.has(userId)) {
      const existingUsername = userMapping.get(userId);
      console.log(`[BackendSync] User ${username} (${userId}) already mapped to: ${existingUsername}`);
      usernameToId.set(username, userId);
      return existingUsername;
    }

    // Create consistent username following extension backend logic
    let gameUsername;
    
    // Check if user is broadcaster (has broadcaster badge)
    if (badges && badges.includes('broadcaster')) {
      gameUsername = `Streamer_${userId.slice(-4)}`;
    } else if (mod) {
      gameUsername = `Mod_${userId.slice(-4)}`;
    } else {
      // For regular users, use display name if available, otherwise sequential
      if (displayName && displayName !== username) {
        gameUsername = displayName;
      } else {
        // Use sequential player numbers like extension backend
        const playerNumber = userMapping.size + 1;
        gameUsername = `Player${playerNumber}`;
      }
    }

    // Store the mapping
    userMapping.set(userId, gameUsername);
    usernameToId.set(username, userId);
    
    console.log(`[BackendSync] Registered chat user: ${username} (${userId}) -> ${gameUsername}`);
    
    // Send mapping to backend for consistency
    sendUserMapping(userId, gameUsername, username);
    
    return gameUsername;
  }

  function getGameUsername(userInfo) {
    const { username, userId } = userInfo;
    
    if (userId && userMapping.has(userId)) {
      return userMapping.get(userId);
    }
    
    if (usernameToId.has(username)) {
      const mappedUserId = usernameToId.get(username);
      if (userMapping.has(mappedUserId)) {
        return userMapping.get(mappedUserId);
      }
    }
    
    // If no mapping exists, register the user
    return registerChatUser(userInfo);
  }

  // Send user mapping to backend
  async function sendUserMapping(twitchUserId, gameUsername, chatUsername) {
    try {
      const response = await fetch(`${BACKEND_URL}/map-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          twitchUserId,
          gameUsername,
          chatUsername
        })
      });

      if (response.ok) {
        console.log(`[BackendSync] User mapping sent to backend: ${chatUsername} -> ${gameUsername}`);
      } else {
        console.warn('[BackendSync] Failed to send user mapping to backend:', response.status);
      }
    } catch (error) {
      console.error('[BackendSync] Error sending user mapping:', error);
    }
  }

  // Handle chat commands through the same pipeline as extension commands
  function handleChatCommand(userInfo, action) {
    if (!userInfo || !action) return;

    console.log('[BackendSync] Processing chat command:', { userInfo, action });

    // Create a command object similar to extension commands
    const command = {
      userId: userInfo.userId || userInfo.id, // Support both field names
      username: userInfo.displayName || userInfo.username,
      command: action,
      timestamp: Date.now(),
      source: 'chat'
    };

    // Process through the same pipeline as extension commands
    processCommand(command);
  }

  // Main polling function
  async function pollBackendCommands() {
    if (!Game) {
      console.warn('[BackendSync] Game not available, skipping poll');
      return;
    }

    try {
      console.log('[BackendSync] Polling for commands...');
      
      // Fetch pending commands from backend
      const response = await fetch(`${BACKEND_URL}/commands`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[BackendSync] Poll response:', data);

      // Reset retry count on successful request
      retryCount = 0;

      // Process each command
      if (data.commands && Array.isArray(data.commands) && data.commands.length > 0) {
        console.log(`[BackendSync] Processing ${data.commands.length} commands`);
        
        for (const command of data.commands) {
          await processCommand(command);
        }

        // Send updated game state back to backend
        await sendGameStateUpdate();
      }

    } catch (error) {
      console.error('[BackendSync] Poll error:', error);
      retryCount++;
      
      if (retryCount >= MAX_RETRIES) {
        console.error('[BackendSync] Max retries reached, stopping polling temporarily');
        stopPolling();
        
        // Restart polling after delay
        setTimeout(() => {
          console.log('[BackendSync] Restarting polling after error recovery');
          retryCount = 0;
          startPolling();
        }, RETRY_DELAY);
      }
    }
  }

  // Process individual command from extension
  async function processCommand(command) {
    try {
      console.log('[BackendSync] Processing command:', command);

      const { userId, username, command: action, timestamp, source } = command;
      
      // Use unified username system for both extension and chat commands
      let playerName;
      
      if (userId) {
        // Check if we already have a mapping for this user ID
        if (userMapping.has(userId)) {
          playerName = userMapping.get(userId);
          console.log(`[BackendSync] Using existing mapping for ${userId}: ${playerName}`);
        } else {
          // Prefer the username provided by the backend if available and meaningful
          if (username && username !== 'undefined' && !username.startsWith('TwitchUser_') && !username.startsWith('Player')) {
            // Use the real username from the backend
            playerName = username;
            console.log(`[BackendSync] Using real username from backend: ${playerName}`);
          } else {
            // Create new mapping based on user role (broadcaster/mod/viewer)
            // For extension commands, we need to determine role from userId
            if (userId === '1155814399') { // Your broadcaster ID
              playerName = `Streamer_${userId.slice(-4)}`;
            } else {
              // For other users, generate sequential player names
              const playerNumber = userMapping.size + 1;
              playerName = `Player${playerNumber}`;
            }
            console.log(`[BackendSync] Generated fallback username: ${playerName}`);
          }
          
          // Store the mapping
          userMapping.set(userId, playerName);
          console.log(`[BackendSync] Created new mapping for ${userId}: ${playerName} (source: ${source || 'extension'})`);
          
          // Send mapping to backend for consistency
          sendUserMapping(userId, playerName, username);
        }
      } else {
        // Fallback if no userId available
        playerName = username || `UnknownUser_${Date.now()}`;
        console.warn(`[BackendSync] No userId available, using fallback: ${playerName}`);
      }
      
      console.log(`[BackendSync] Spawning player: ${playerName} with action: ${action} (source: ${source || 'extension'})`);

      // Check for existing players with the same user ID but different names (prevent duplicates)
      const currentPlayers = Game.getState().players || {};
      let existingPlayerName = null;
      
      // Look for existing player with same user ID
      if (userId) {
        for (const [name, player] of Object.entries(currentPlayers)) {
          if (player.twitchUserId === userId) {
            existingPlayerName = name;
            break;
          }
        }
      }
      
      if (existingPlayerName && existingPlayerName !== playerName) {
        console.log(`[BackendSync] Found existing player ${existingPlayerName} for userId ${userId}, updating mapping`);
        // Update our mapping to use the existing player name to prevent duplicates
        userMapping.set(userId, existingPlayerName);
        playerName = existingPlayerName;
      }

      // Add player to game if not exists (ensure Game.addPlayer creates the player)
      if (!currentPlayers[playerName]) {
        console.log(`[BackendSync] Adding new player: ${playerName}`);
        const addResult = Game.addPlayer(playerName, {
          isBot: false,
          behavior: 'random',
          twitchUserId: userId // Store the user ID to prevent future duplicates
        });
        console.log(`[BackendSync] Add player result:`, addResult);
        
        // Verify player was added
        const updatedPlayers = Game.getState().players || {};
        if (updatedPlayers[playerName]) {
          console.log(`[BackendSync] Player ${playerName} successfully added to game`);
        } else {
          console.error(`[BackendSync] Failed to add player ${playerName} to game`);
          return;
        }
      } else {
        console.log(`[BackendSync] Player ${playerName} already exists in game`);
      }

      // Normalize action names for compatibility
      let normalizedAction = action.toLowerCase();
      if (normalizedAction === 'strike') {
        normalizedAction = 'aggressive'; // Backend uses 'strike', game uses 'aggressive'
      }

      // Set player action
      const actionResult = Game.setPlayerAction(playerName, normalizedAction);
      
      if (actionResult) {
        console.log(`[BackendSync] Successfully set action ${normalizedAction} for ${playerName}`);
        
        // Show prebattle screen if game is not running and we have actions
        const gameState = Game.getState();
        if (!gameState.running && global.showInitialPrebattle) {
          console.log('[BackendSync] Game not running, showing prebattle screen');
          global.showInitialPrebattle();
        }
      } else {
        console.warn(`[BackendSync] Failed to set action ${normalizedAction} for ${playerName}. Player HP:`, 
          currentPlayers[playerName]?.hp, 'Game Running:', Game.getState().running);
      }

      // Track the command processing
      console.log(`[BackendSync] Command processed: ${playerName} -> ${normalizedAction}`);

    } catch (error) {
      console.error('[BackendSync] Error processing command:', error, command);
    }
  }

  // Send current game state back to backend
  async function sendGameStateUpdate() {
    try {
      const gameState = Game.getState();
      const players = gameState.players || {};
      
      // Prepare player states for batch update
      const playerUpdates = Object.entries(players).map(([name, player]) => ({
        playerName: name,
        burstGauge: player.burstGauge || 0,
        lastAction: player.lastAction || null,
        hp: player.hp || 0,
        score: player.score || 0,
        // Try to map back to Twitch user ID if possible
        twitchUserId: name.startsWith('TwitchUser_') ? 
          `temp_${name.slice(-8)}` : null
      }));

      if (playerUpdates.length > 0) {
        console.log('[BackendSync] Sending game state update:', playerUpdates.length, 'players');
        
        const response = await fetch(`${BACKEND_URL}/update-all-players`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            players: playerUpdates
          })
        });

        if (response.ok) {
          console.log('[BackendSync] Game state synchronized successfully');
        } else {
          console.warn('[BackendSync] Failed to sync game state:', response.status);
        }
      }

    } catch (error) {
      console.error('[BackendSync] Error syncing game state:', error);
    }
  }

  // Start polling
  function startPolling() {
    if (isPolling) {
      console.log('[BackendSync] Already polling');
      return;
    }

    if (!Game) {
      console.warn('[BackendSync] Cannot start polling - Game not available');
      return;
    }

    console.log('[BackendSync] Starting backend polling...');
    isPolling = true;
    retryCount = 0;
    
    // Initial poll
    pollBackendCommands();
    
    // Set up interval
    pollInterval = setInterval(pollBackendCommands, POLL_INTERVAL);
  }

  // Stop polling
  function stopPolling() {
    if (!isPolling) return;
    
    console.log('[BackendSync] Stopping backend polling');
    isPolling = false;
    
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  // Manual sync function for testing
  function manualSync() {
    console.log('[BackendSync] Manual sync triggered');
    pollBackendCommands();
  }

  // Health check function
  async function checkBackendHealth() {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      const data = await response.json();
      console.log('[BackendSync] Backend health:', data);
      return data;
    } catch (error) {
      console.error('[BackendSync] Backend health check failed:', error);
      return null;
    }
  }

  // Initialize when Game is available
  function initialize() {
    if (!isBrowser) {
      console.log('[BackendSync] Not in browser environment, skipping initialization');
      return;
    }

    if (!Game || !Game.getState || typeof Game.addPlayer !== 'function') {
      console.log('[BackendSync] Game not ready, waiting... Available Game methods:', 
        Game ? Object.keys(Game) : 'Game not available');
      setTimeout(initialize, 1000);
      return;
    }

    console.log('[BackendSync] Game detected, checking backend connection');
    
    // Initial health check
    checkBackendHealth().then(health => {
      if (health) {
        console.log('[BackendSync] Backend is healthy, starting polling');
        console.log('[BackendSync] Configuration:', {
          BACKEND_URL,
          POLL_INTERVAL: POLL_INTERVAL + 'ms',
          MAX_RETRIES
        });
        startPolling();
      } else {
        console.warn('[BackendSync] Backend health check failed, retrying in 5 seconds');
        setTimeout(initialize, 5000);
      }
    });

    // Listen for game state changes to potentially trigger sync
    if (Game.onUpdate) {
      Game.onUpdate((state) => {
        // Log significant state changes for debugging
        const playerCount = Object.keys(state.players || {}).length;
        const gameRunning = state.running;
        
        // Only log when there are meaningful changes
        if (playerCount > 0 || gameRunning) {
          console.log('[BackendSync] Game state change detected:', {
            players: playerCount,
            running: gameRunning,
            round: state.round
          });
        }
      });
    }
  }

  // Expose functions globally for debugging
  if (isBrowser) {
    global.__backendSync = {
      start: startPolling,
      stop: stopPolling,
      manual: manualSync,
      health: checkBackendHealth,
      isPolling: () => isPolling,
      handleChatCommand: handleChatCommand,
      registerChatUser: registerChatUser,
      getGameUsername: getGameUsername,
      config: {
        BACKEND_URL,
        POLL_INTERVAL,
        MAX_RETRIES
      }
    };

    // Expose the chat command handler that chat.js expects
    global.backendSyncHandleChatCommand = function(action, userInfo) {
      console.log('[BackendSync] Chat command handler called:', { action, userInfo });
      handleChatCommand(userInfo, action);
    };
  }

  // Auto-initialize when script loads
  if (isBrowser) {
    // Wait for DOM and Game to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      initialize();
    }
  }

  console.log('[BackendSync] Backend sync module loaded');

  } catch (error) {
    console.error('[BackendSync] Critical error during initialization:', error);
  }

})(typeof window !== 'undefined' ? window : global);