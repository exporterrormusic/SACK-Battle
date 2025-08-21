// src/renderer/discordTab.js
// Discord integration tab functionality

console.log('DISCORD TAB SCRIPT STARTED LOADING');

(function(global) {
  console.log('[DiscordTab] ========== DISCORD TAB FILE LOADED ==========');
  window.discordTabLoaded = true;
  
  // Debug: Check if Discord elements are in DOM
  setTimeout(() => {
    const discordTab = document.getElementById('settings-discord');
    const discordButton = document.querySelector('[data-tab="discord"]');
    console.log('[DiscordTab] DEBUG - Discord tab element:', discordTab ? 'FOUND' : 'NOT FOUND');
    console.log('[DiscordTab] DEBUG - Discord button element:', discordButton ? 'FOUND' : 'NOT FOUND');
    if (discordTab) {
      console.log('[DiscordTab] DEBUG - Discord tab visibility:', getComputedStyle(discordTab).display);
    }
  }, 1000);

  console.log('[DiscordTab] Loading Discord tab functionality...');

  async function loadAndSetupAutoConnect() {
    try {
      if (!global.electronAPI || !global.electronAPI.loadSettings) {
        console.warn('[DiscordTab] electronAPI.loadSettings not available');
        return;
      }

      const settings = await global.electronAPI.loadSettings();
      console.log('[DiscordTab] Loaded settings:', settings);

      if (settings && settings.discordBotToken && settings.discordChannelId) {
        console.log('[DiscordTab] Auto-connecting with saved credentials...');
        
        // Auto-populate form fields
        const tokenInput = document.getElementById('discord-bot-token');
        const channelIdInput = document.getElementById('discord-channel-id');
        
        if (tokenInput) tokenInput.value = settings.discordBotToken;
        if (channelIdInput) channelIdInput.value = settings.discordChannelId;

        // Auto-connect if both fields are present
        try {
          const result = await global.electronAPI.connectDiscord(settings.discordBotToken, settings.discordChannelId);
          if (result) {
            console.log('[DiscordTab] Auto-connect successful');
            updateConnectionStatus('connected');
          } else {
            console.log('[DiscordTab] Auto-connect failed');
            updateConnectionStatus('disconnected');
          }
        } catch (error) {
          console.error('[DiscordTab] Auto-connect error:', error);
          updateConnectionStatus('error', error.message);
        }
      } else {
        console.log('[DiscordTab] Missing credentials for auto-connect');
        updateConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('[DiscordTab] Error in loadAndSetupAutoConnect:', error);
    }
  }

  function updateConnectionStatus(status, message = '') {
    const statusElement = document.getElementById('discord-status');
    const connectBtn = document.getElementById('discord-connect-btn');
    const disconnectBtn = document.getElementById('discord-disconnect-btn');
    
    if (statusElement) {
      switch (status) {
        case 'connected':
          statusElement.textContent = '✅ Connected to Discord';
          statusElement.className = 'status-connected';
          break;
        case 'connecting':
          statusElement.textContent = '🔄 Connecting to Discord...';
          statusElement.className = 'status-connecting';
          break;
        case 'disconnected':
          statusElement.textContent = '❌ Disconnected';
          statusElement.className = 'status-disconnected';
          break;
        case 'error':
          statusElement.textContent = `❌ Error: ${message}`;
          statusElement.className = 'status-error';
          break;
      }
    }
    
    if (connectBtn) {
      connectBtn.style.display = (status === 'connected') ? 'none' : 'inline-block';
    }
    if (disconnectBtn) {
      disconnectBtn.style.display = (status === 'connected') ? 'inline-block' : 'none';
    }
  }

  function setupEventListeners() {
    console.log('[DiscordTab] Setting up event listeners...');

    // Enhanced event management - collect handler keys for cleanup
    const handlerKeys = [];
    const addManagedHandler = (elementId, event, handler) => {
      const element = global.__getElement(elementId);
      if (element) {
        const key = global.__addEventHandler(element, event, handler);
        if (key) handlerKeys.push(key);
        return element;
      }
      return null;
    };

    // Connect button
    const connectBtn = addManagedHandler('discord-connect-btn', 'click', async () => {
      console.log('[DiscordTab] Connect button clicked');
      
      const tokenInput = global.__getElement('discord-bot-token');
      const channelIdInput = global.__getElement('discord-channel-id');
      
      if (!tokenInput || !channelIdInput) {
        console.error('[DiscordTab] Required input elements not found');
        return;
      }
        
        const token = tokenInput.value.trim();
        const channelId = channelIdInput.value.trim();
        
        if (!token || !channelId) {
          alert('Please enter both Bot Token and Channel ID');
          return;
        }
        
        updateConnectionStatus('connecting');
        
        try {
          const result = await global.electronAPI.connectDiscord(token, channelId);
          if (result) {
            console.log('[DiscordTab] Connection successful');
            updateConnectionStatus('connected');
          } else {
            console.log('[DiscordTab] Connection failed');
            updateConnectionStatus('error', 'Connection failed');
          }
        } catch (error) {
          console.error('[DiscordTab] Connection error:', error);
          updateConnectionStatus('error', error.message || 'Connection failed');
        }
      });

    // Disconnect button
    const disconnectBtn = document.getElementById('discord-disconnect-btn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', async () => {
        console.log('[DiscordTab] Disconnect button clicked');
        
        try {
          await global.electronAPI.disconnectDiscord();
          updateConnectionStatus('disconnected');
        } catch (error) {
          console.error('[DiscordTab] Disconnect error:', error);
        }
      });
    }

    // Validate token button
    const validateBtn = document.getElementById('discord-validate-btn');
    if (validateBtn) {
      validateBtn.addEventListener('click', async () => {
        console.log('[DiscordTab] Validate token button clicked');
        
        const tokenInput = document.getElementById('discord-bot-token');
        if (!tokenInput) {
          console.error('[DiscordTab] Token input not found');
          return;
        }
        
        const token = tokenInput.value.trim();
        if (!token) {
          alert('Please enter a bot token');
          return;
        }
        
        const resultElement = document.getElementById('discord-validation-result');
        if (resultElement) {
          resultElement.textContent = 'Validating...';
          resultElement.className = 'validating';
        }
        
        try {
          const result = await global.electronAPI.validateDiscordToken(token);
          
          if (resultElement) {
            if (result && !result.error) {
              resultElement.textContent = `✅ Valid! Bot: ${result.username}#${result.discriminator}`;
              resultElement.className = 'valid';
            } else {
              resultElement.textContent = `❌ Invalid: ${result.error || 'Unknown error'}`;
              resultElement.className = 'invalid';
            }
          }
        } catch (error) {
          console.error('[DiscordTab] Token validation error:', error);
          if (resultElement) {
            resultElement.textContent = `❌ Error: ${error.message}`;
            resultElement.className = 'invalid';
          }
        }
      });
    }

    // Get channel info button
    const channelInfoBtn = document.getElementById('discord-channel-info-btn');
    if (channelInfoBtn) {
      channelInfoBtn.addEventListener('click', async () => {
        console.log('[DiscordTab] Get channel info button clicked');
        
        const tokenInput = document.getElementById('discord-bot-token');
        const channelIdInput = document.getElementById('discord-channel-id');
        
        if (!tokenInput || !channelIdInput) {
          console.error('[DiscordTab] Required inputs not found');
          return;
        }
        
        const token = tokenInput.value.trim();
        const channelId = channelIdInput.value.trim();
        
        if (!token || !channelId) {
          alert('Please enter both Bot Token and Channel ID');
          return;
        }
        
        const resultElement = document.getElementById('discord-channel-result');
        if (resultElement) {
          resultElement.textContent = 'Getting channel info...';
          resultElement.className = 'loading';
        }
        
        try {
          const result = await global.electronAPI.getDiscordChannelInfo(channelId, token);
          
          if (resultElement) {
            if (result && !result.error) {
              resultElement.innerHTML = `
                <div class="channel-info">
                  <strong>✅ Channel Found!</strong><br>
                  <span class="channel-detail">Name: #${result.name}</span><br>
                  <span class="channel-detail">ID: ${result.id}</span><br>
                  <span class="channel-detail">Type: ${result.type === 0 ? 'Text Channel' : 'Other'}</span>
                </div>
              `;
              resultElement.className = 'valid';
            } else {
              resultElement.textContent = `❌ Error: ${result.error || 'Channel not found'}`;
              resultElement.className = 'invalid';
            }
          }
        } catch (error) {
          console.error('[DiscordTab] Channel info error:', error);
          if (resultElement) {
            resultElement.textContent = `❌ Error: ${error.message}`;
            resultElement.className = 'invalid';
          }
        }
      });
    }

    // Test message button
    const testMsgBtn = document.getElementById('discord-test-message-btn');
    if (testMsgBtn) {
      testMsgBtn.addEventListener('click', async () => {
        console.log('[DiscordTab] Test message button clicked');
        
        try {
          const result = await global.electronAPI.sendDiscordMessage('🎮 SACK BATTLE Discord integration is working! Commands like !attack, !defend, !heal are now active.');
          
          if (result && result.success) {
            alert('✅ Test message sent successfully!');
          } else {
            alert(`❌ Failed to send message: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('[DiscordTab] Test message error:', error);
          alert(`❌ Error: ${error.message}`);
        }
      });
    }

    // Reveal buttons for password-style inputs
    const revealTokenBtn = document.getElementById('discord-reveal-token-btn');
    const tokenInput = document.getElementById('discord-bot-token');
    
    if (revealTokenBtn && tokenInput) {
      revealTokenBtn.addEventListener('click', () => {
        if (tokenInput.type === 'password') {
          tokenInput.type = 'text';
          revealTokenBtn.textContent = '🙈 Hide';
        } else {
          tokenInput.type = 'password';
          revealTokenBtn.textContent = '👁️ Show';
        }
      });
    }

    // Register cleanup for all managed handlers
    if (global.__memoryManager && handlerKeys.length > 0) {
      global.__memoryManager.addCleanupCallback(() => {
        handlerKeys.forEach(key => global.__removeEventHandler(key));
        console.log('[DiscordTab] Cleaned up', handlerKeys.length, 'event handlers');
      });
    }
  }

  // Listen for Discord status updates from main process
  function setupStatusListener() {
    if (global.electronAPI && global.electronAPI.onDiscordStatus) {
      global.electronAPI.onDiscordStatus((status) => {
        console.log('[DiscordTab] Status update received:', status);
        
        if (status.status === 'connected') {
          updateConnectionStatus('connected');
        } else if (status.status === 'disconnected') {
          updateConnectionStatus('disconnected', status.reason);
        } else if (status.status === 'connecting') {
          updateConnectionStatus('connecting');
        }
      });
    }
  }

  // Initialize when DOM is ready
  function initialize() {
    console.log('[DiscordTab] Initializing Discord tab...');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        setupStatusListener();
        // Small delay to ensure settings are loaded
        setTimeout(loadAndSetupAutoConnect, 100);
      });
    } else {
      setupEventListeners();
      setupStatusListener();
      setTimeout(loadAndSetupAutoConnect, 100);
    }
  }

  // Export for global access
  global.DiscordTab = {
    initialize,
    setupEventListeners,
    updateConnectionStatus,
    loadAndSetupAutoConnect
  };

  // Auto-initialize
  initialize();

})(window);
