let twitchAuth = null;
let isConnected = false;
let currentPlayerName = null;
let gameStatePoller = null;

// Update status display
function updateStatus(message, isError = false) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ff6666' : 'white';
}

// Update burst button based on player state
function updateBurstButton(burstGauge = 0) {
  const burstBtn = document.querySelector('.burst-btn');
  if (!burstBtn) return;
  
  const isReady = burstGauge >= 5;
  
  if (isReady) {
    burstBtn.classList.add('burst-ready');
    burstBtn.title = 'Burst Ready! (5/5)';
  } else {
    burstBtn.classList.remove('burst-ready');
    burstBtn.title = `Burst Charging (${burstGauge}/5)`;
  }
}

// Poll game state for burst info
function startGameStatePolling() {
  if (gameStatePoller) {
    clearInterval(gameStatePoller);
  }
  
  // Poll every 2 seconds to check burst status
  gameStatePoller = setInterval(async () => {
    try {
      if (!twitchAuth || !twitchAuth.userId) return;
      
      // Fetch player burst state only
      const response = await fetch(`${EXTENSION_CONFIG.BACKEND_URL}/player-state-by-twitch-id/${twitchAuth.userId}`);
      
      if (response.ok) {
        const playerState = await response.json();
        updateBurstButton(playerState.burstGauge || 0);
        
        // Update current player name for display
        if (playerState.playerName) {
          currentPlayerName = playerState.playerName;
          updateStatus(`Ready to battle! (${currentPlayerName})`);
        }
      } else if (response.status === 404) {
        // Player not found in game - reset burst button
        updateBurstButton(0);
        currentPlayerName = null;
        updateStatus("Ready to battle!");
      }
      
    } catch (err) {
      // Silently fail - don't spam console during network issues
    }
  }, 2000);
}

// Stop polling when not needed
function stopGameStatePolling() {
  if (gameStatePoller) {
    clearInterval(gameStatePoller);
    gameStatePoller = null;
  }
}

// Twitch provides an auth token when user loads the extension
window.Twitch.ext.onAuthorized(auth => {
  twitchAuth = auth;
  isConnected = true;
  
  console.log("Twitch Authorized:", {
    userId: auth.userId,
    channelId: auth.channelId,
    hasToken: !!auth.token
  });
  updateStatus("Connected! Join the battle to see your burst meter!");
  
  // Start polling for individual burst state
  startGameStatePolling();
});

// Handle connection errors
window.Twitch.ext.onError(err => {
  console.error("Twitch Extension Error:", err);
  updateStatus("Connection error", true);
  isConnected = false;
  stopGameStatePolling();
});

// Send command to backend
function sendCommand(cmd) {
  if (!twitchAuth || !isConnected) {
    updateStatus("Not connected to Twitch", true);
    return;
  }

  // Check if backend URL is available
  if (!EXTENSION_CONFIG.BACKEND_URL) {
    updateStatus("Backend not available - local testing only", true);
    console.log("Extension is running on Twitch servers but backend is localhost-only");
    return;
  }

  // Debug logging
  console.log("Attempting to send command:", cmd);
  console.log("Backend URL:", EXTENSION_CONFIG.BACKEND_URL);
  console.log("Window location:", window.location.href);

  // Disable all buttons briefly to prevent spam
  const buttons = document.querySelectorAll('button');
  buttons.forEach(btn => btn.disabled = true);
  
  updateStatus(`Sending ${cmd}...`);

  // Use backend URL from config
  const backendUrl = `${EXTENSION_CONFIG.BACKEND_URL}/game`;
  
  fetch(backendUrl, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + twitchAuth.token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ 
      command: cmd,
      timestamp: Date.now()
    })
  })
  .then(response => {
    console.log("Response status:", response.status);
    if (response.ok) {
      updateStatus(`${cmd.toUpperCase()} sent! ⚡`);
    } else if (response.status === 429) {
      updateStatus("⏳ Please wait - too fast!", true);
    } else {
      throw new Error(`Server error: ${response.status}`);
    }
  })
  .catch(err => {
    console.error("Failed to send command:", err);
    updateStatus(`Error: ${err.message}`, true);
  })
  .finally(() => {
    // Re-enable buttons after cooldown period
    setTimeout(() => {
      buttons.forEach(btn => btn.disabled = false);
      if (isConnected) {
        updateStatus("Ready to battle!");
      }
    }, EXTENSION_CONFIG.COOLDOWN_MS);
  });
}

// Add keyboard shortcuts for testing
document.addEventListener('keydown', (e) => {
  if (!isConnected) return;
  
  switch(e.key.toLowerCase()) {
    case 'a': sendCommand('attack'); break;
    case 'h': sendCommand('heal'); break;
    case 'c': sendCommand('cover'); break;
    case 's': sendCommand('strike'); break;
    case 'b': sendCommand('burst'); break;
  }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  updateStatus("Connecting to Twitch...");
  
  // Add event listeners to buttons (CSP-compliant)
  document.querySelectorAll('button[data-command]').forEach(button => {
    button.addEventListener('click', () => {
      const command = button.getAttribute('data-command');
      sendCommand(command);
    });
  });
  
  // Fallback if Twitch doesn't load
  setTimeout(() => {
    if (!isConnected) {
      updateStatus("Twitch connection timeout", true);
    }
  }, 5000);
});
