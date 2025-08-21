// src/renderer/youtubeTab.js
// YouTube integration tab functionality

(function(global) {
  console.log('[YouTubeTab] Loading YouTube tab functionality...');

  // Debug helper to log to both console and main process
  function debugLog(message, data = null) {
    console.log(message, data);
    // Also send to main process if available
    if (window.electronAPI && window.electronAPI.logToMain) {
      window.electronAPI.logToMain(`[YouTubeTab] ${message}`, data);
    }
  }

  async function loadAndSetupAutoConnect() {
    try {
      if (!global.electronAPI || !global.electronAPI.loadSettings) {
        console.warn('[YouTubeTab] electronAPI.loadSettings not available');
        return;
      }

      const settings = await global.electronAPI.loadSettings();
      console.log('[YouTubeTab] Loaded settings:', settings);

      if (settings) {
        // Auto-populate all YouTube form fields
        const apiKeyInput = document.getElementById('youtube-api-key');
        const channelIdInput = document.getElementById('youtube-channel-id');
        const oauthClientIdInput = document.getElementById('youtube-oauth-client-id');
        const oauthClientSecretInput = document.getElementById('youtube-oauth-client-secret');
        
        console.log('[YouTubeTab] Found elements:', {
          apiKeyInput: !!apiKeyInput,
          channelIdInput: !!channelIdInput,
          oauthClientIdInput: !!oauthClientIdInput,
          oauthClientSecretInput: !!oauthClientSecretInput
        });
        
        debugLog('[YouTubeTab] Settings values:', {
          youtubeApiKey: !!settings.youtubeApiKey,
          youtubeChannelId: !!settings.youtubeChannelId,
          youtubeOAuthClientId: !!settings.youtubeOAuthClientId,
          youtubeOAuthClientSecret: !!settings.youtubeOAuthClientSecret
        });
        
        if (apiKeyInput && settings.youtubeApiKey) {
          apiKeyInput.value = settings.youtubeApiKey;
          debugLog('[YouTubeTab] Populated API key');
        }
        if (channelIdInput && settings.youtubeChannelId) {
          channelIdInput.value = settings.youtubeChannelId;
          debugLog('[YouTubeTab] Populated channel ID');
        }
        if (oauthClientIdInput && settings.youtubeOAuthClientId) {
          oauthClientIdInput.value = settings.youtubeOAuthClientId;
          debugLog('[YouTubeTab] Populated OAuth client ID');
        } else {
          debugLog('[YouTubeTab] OAuth client ID not populated:', {
            hasElement: !!oauthClientIdInput,
            hasValue: !!settings.youtubeOAuthClientId,
            value: settings.youtubeOAuthClientId
          });
        }
        if (oauthClientSecretInput && settings.youtubeOAuthClientSecret) {
          oauthClientSecretInput.value = settings.youtubeOAuthClientSecret;
          debugLog('[YouTubeTab] Populated OAuth client secret');
        } else {
          debugLog('[YouTubeTab] OAuth client secret not populated:', {
            hasElement: !!oauthClientSecretInput,
            hasValue: !!settings.youtubeOAuthClientSecret,
            value: settings.youtubeOAuthClientSecret
          });
        }

        // Check if we should auto-connect
        if (settings.youtubeApiKey && settings.youtubeChannelId) {
          console.log('[YouTubeTab] Auto-connecting with saved credentials...');
          
          // Auto-connect if both fields are present
          try {
            const result = await global.electronAPI.connectYouTube(settings.youtubeApiKey, settings.youtubeChannelId);
            if (result) {
              console.log('[YouTubeTab] Auto-connect successful');
              updateConnectionStatus('connected', 'Auto-connected to YouTube');
            }
          } catch (error) {
            console.warn('[YouTubeTab] Auto-connect failed:', error);
          }
        }
      }
    } catch (error) {
      console.error('[YouTubeTab] Setup failed:', error);
    }
  }

  // Update YouTube connection status and UI
  function updateConnectionStatus(status, message = '') {
    const statusElement = document.getElementById('youtube-status');
    const connectBtn = document.getElementById('yt-connect-btn');
    const disconnectBtn = document.getElementById('yt-disconnect-btn');
    
    if (statusElement) {
      switch (status) {
        case 'connected':
          statusElement.textContent = '✅ Connected to YouTube';
          statusElement.className = 'status-connected';
          break;
        case 'connecting':
          statusElement.textContent = '🔄 Connecting to YouTube...';
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

  // Show error message
  function showError(message) {
    updateConnectionStatus('error', message);
    console.error('[YouTubeTab]', message);
  }

  // Show success message  
  function showSuccess(message) {
    updateConnectionStatus('connected', message);
    console.log('[YouTubeTab]', message);
  }

  // Show status message
  function showStatus(message) {
    updateConnectionStatus('connecting', message);
    console.log('[YouTubeTab]', message);
  }

  // Refresh connect button state
  function refreshConnectButton() {
    const apiKey = document.getElementById('yt-api-key')?.value?.trim();
    const channelId = document.getElementById('yt-channel-id')?.value?.trim();
    const connectBtn = document.getElementById('yt-connect-btn');
    
    if (connectBtn) {
      connectBtn.disabled = !apiKey || !channelId;
    }
  }

  // Update overall UI state
  function updateUI() {
    refreshConnectButton();
    // Add any other UI updates here
  }

  // Check for auto-connect capability
  function checkAutoConnect() {
    // Auto-connect is handled by loadAndSetupAutoConnect
    // This function exists for compatibility
    console.log('[YouTubeTab] checkAutoConnect called - handled by loadAndSetupAutoConnect');
  }

  // Wire up YouTube tab button functionality
  function wireEventHandlers() {
    console.log('[YouTubeTab] wireEventHandlers');
    
    // Enhanced YouTube tab event management
    const addManagedHandler = (elementId, event, handler) => {
      const element = global.__domUtils.getElement(elementId);
      if (element) {
        global.__domUtils.addEventHandler(element, event, handler, `youtube-${elementId}-${event}`);
      }
    };

    // Auto-save OAuth credentials when they change
    const addAutoSaveHandler = (elementId, settingKey) => {
      const element = document.getElementById(elementId);
      debugLog(`[YouTubeTab] Setting up auto-save for ${elementId} -> ${settingKey}, found element:`, !!element);
      
      if (element) {
        // Remove any existing listeners to avoid duplicates
        element.removeEventListener('input', element._autoSaveHandler);
        
        // Create new handler
        element._autoSaveHandler = async (e) => {
          try {
            // Use a small delay to ensure the input value is fully updated
            setTimeout(async () => {
              const value = element.value.trim(); // Get value directly from element instead of event target
              debugLog(`[YouTubeTab] Auto-saving ${settingKey}:`, value ? '[HIDDEN]' : 'empty');
              debugLog(`[YouTubeTab] Element value length: ${value.length}`);
              
              if (value) { // Only save if there's actually a value
                const settings = await window.electronAPI.loadSettings() || {};
                settings[settingKey] = value;
                await window.electronAPI.saveSettings(settings);
                debugLog(`[YouTubeTab] Successfully auto-saved ${settingKey}`);
                
                // Show brief save indicator
                showSaveIndicator(element);
              } else {
                debugLog(`[YouTubeTab] Skipping auto-save for ${settingKey} - empty value`);
              }
            }, 10); // Small delay to ensure input value is captured
          } catch (error) {
            debugLog(`[YouTubeTab] Failed to auto-save ${settingKey}:`, error);
          }
        };
        
        element.addEventListener('input', element._autoSaveHandler);
        debugLog(`[YouTubeTab] Auto-save handler attached for ${elementId}`);
      } else {
        debugLog(`[YouTubeTab] Element ${elementId} not found for auto-save setup`);
      }
    };

    // Show save indicator next to input field
    function showSaveIndicator(element) {
      const existingIndicator = element.parentNode.querySelector('.save-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
      
      const indicator = document.createElement('span');
      indicator.className = 'save-indicator';
      indicator.textContent = '✓ Saved';
      indicator.style.cssText = 'color: green; font-size: 12px; margin-left: 8px; opacity: 1; transition: opacity 0.3s;';
      
      element.parentNode.appendChild(indicator);
      
      // Fade out after 2 seconds
      setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 300);
      }, 2000);
    }

    // Set up auto-save for all YouTube fields
    console.log('[YouTubeTab] Setting up auto-save handlers...');
    
    // Add a small delay to ensure DOM elements are ready
    setTimeout(() => {
      addAutoSaveHandler('youtube-api-key', 'youtubeApiKey');
      addAutoSaveHandler('youtube-channel-id', 'youtubeChannelId');
      addAutoSaveHandler('youtube-oauth-client-id', 'youtubeOAuthClientId');
      addAutoSaveHandler('youtube-oauth-client-secret', 'youtubeOAuthClientSecret');
      console.log('[YouTubeTab] Auto-save handlers setup completed');
    }, 100);

    // Validation handler
    addManagedHandler('youtube-validate-key', 'click', async () => {
      const apiKey = document.getElementById('youtube-api-key').value.trim();
      if (!apiKey) {
        showError('API key is required');
        return;
      }
      
      const btn = document.getElementById('youtube-validate-key');
      try {
        btn.disabled = true;
        btn.textContent = 'Validating...';
        
        const response = await window.electronAPI.validateYouTubeKey(apiKey);
        console.log('[YouTubeTab] validate_response', { success: response.success });
        
        if (response.success) {
          // Show success message in an alert or console (don't change connection status)
          alert('✅ API key is valid!');
          console.log('[YouTubeTab] API key validation successful');
        } else {
          showError(response.error || 'Invalid API key');
        }
      } catch (error) {
        console.error('[YouTubeTab] validate_error', { error: error.message });
        showError(`Validation failed: ${error.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Validate API Key';
      }
    });

    // Channel info handler
    addManagedHandler('youtube-get-channel-info', 'click', async () => {
      const apiKey = document.getElementById('youtube-api-key').value.trim();
      const channelId = document.getElementById('youtube-channel-id').value.trim();
      
      if (!apiKey || !channelId) {
        showError('Both API key and Channel ID are required');
        return;
      }
      
      const btn = document.getElementById('youtube-get-channel-info');
      try {
        btn.disabled = true;
        btn.textContent = 'Fetching...';
        
        const response = await window.electronAPI.getYouTubeChannelInfo(channelId, apiKey);
        console.log('[YouTubeTab] channel_info_response', { success: response.success });
        
        if (response.success) {
          const channelInfo = response.data;
          // YouTube API returns channel data directly
          const snippet = channelInfo.snippet || {};
          const statistics = channelInfo.statistics || {};
          
          let message = `✅ Channel Found!\n\nTitle: ${snippet.title || 'Unknown'}`;
          if (snippet.customUrl) {
            message += `\nCustom URL: ${snippet.customUrl}`;
          }
          if (statistics.subscriberCount) {
            message += `\nSubscribers: ${parseInt(statistics.subscriberCount).toLocaleString()}`;
          }
          if (snippet.description) {
            const shortDesc = snippet.description.substring(0, 100);
            message += `\nDescription: ${shortDesc}${snippet.description.length > 100 ? '...' : ''}`;
          }
          
          // Show channel info in an alert (don't change connection status)
          alert(message);
          console.log('[YouTubeTab] Channel info retrieved:', channelInfo);
        } else {
          showError(response.error || 'Failed to fetch channel info');
        }
      } catch (error) {
        console.error('[YouTubeTab] channel_info_error', { error: error.message });
        showError(`Failed to fetch channel info: ${error.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Get Channel Info';
      }
    });

    // Connect handler  
    addManagedHandler('yt-connect-btn', 'click', async () => {
      const apiKey = document.getElementById('yt-api-key').value.trim();
      const channelId = document.getElementById('yt-channel-id').value.trim();
      
      if (!apiKey || !channelId) {
        showError('Both API key and Channel ID are required');
        return;
      }
      
      const btn = document.getElementById('yt-connect-btn');
      try {
        btn.disabled = true;
        btn.textContent = 'Connecting...';
        
        const response = await window.__ipcRenderer.invoke('ipc-youtube-connect', { apiKey, channelId });
        console.log('[YouTubeTab] connect_response', { success: response.success });
        
        if (response.success) {
          updateConnectionStatus('connected', 'Connected to YouTube successfully!');
          updateUI();
        } else {
          showError(response.error || 'Connection failed');
        }
      } catch (error) {
        console.error('[YouTubeTab] connect_error', { error: error.message });
        showError(`Connection failed: ${error.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Connect';
      }
    });

    // Disconnect handler
    addManagedHandler('yt-disconnect-btn', 'click', async () => {
      const btn = document.getElementById('yt-disconnect-btn');
      try {
        btn.disabled = true;
        btn.textContent = 'Disconnecting...';
        
        const response = await window.__ipcRenderer.invoke('ipc-youtube-disconnect');
        console.log('[YouTubeTab] disconnect_response', { success: response.success });
        
        if (response.success) {
          updateConnectionStatus('disconnected', 'Disconnected from YouTube');
          updateUI();
        } else {
          showError(response.error || 'Disconnect failed');
        }
      } catch (error) {
        console.error('[YouTubeTab] disconnect_error', { error: error.message });
        showError(`Disconnect failed: ${error.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Disconnect';
      }
    });
    
    // Wire OAuth handlers
    wireOAuthHandlers();
    
    checkAutoConnect();
  }

  // Wire YouTube tab functionality for settings modal
  function wireYouTubeTab() {
    debugLog('[YouTubeTab] === WIRING YOUTUBE TAB ===');
    debugLog('[YouTubeTab] Wiring YouTube tab functionality...');
    wireEventHandlers();
    updateUI();
    
    // Load and populate fields after tab is set up
    debugLog('[YouTubeTab] About to call loadAndSetupAutoConnect...');
    loadAndSetupAutoConnect();
  }

  // OAuth-related functions
  async function startOAuthFlow() {
    console.log('[YouTubeTab] Starting OAuth flow...');
    
    const clientIdInput = document.getElementById('youtube-oauth-client-id');
    const clientSecretInput = document.getElementById('youtube-oauth-client-secret');
    
    if (!clientIdInput || !clientSecretInput) {
      showError('OAuth client credentials inputs not found');
      return;
    }
    
    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value.trim();
    
    if (!clientId || !clientSecret) {
      showError('Please enter both OAuth Client ID and Client Secret');
      return;
    }
    
    try {
      showStatus('Starting OAuth authentication...');
      
      const response = await window.electronAPI.startYouTubeOAuth(clientId, clientSecret);
      console.log('[YouTubeTab] OAuth response:', response);
      
      if (response.success) {
        showSuccess('✅ OAuth authentication successful! You can now connect to live chat.');
        updateOAuthStatus(true);
        
        // Save OAuth credentials to settings
        const settings = await window.electronAPI.loadSettings() || {};
        settings.youtubeOAuthClientId = clientId;
        settings.youtubeOAuthClientSecret = clientSecret;
        settings.youtubeOAuthTokens = response.tokens;
        
        console.log('[YouTubeTab] Saving OAuth credentials:', {
          clientId: clientId ? `${clientId.substring(0, 20)}...` : 'EMPTY',
          clientSecret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'EMPTY',
          hasTokens: !!response.tokens
        });
        
        await window.electronAPI.saveSettings(settings);
        console.log('[YouTubeTab] OAuth credentials saved to settings');
        
      } else {
        showError(`❌ OAuth failed: ${response.error}`);
      }
      
    } catch (error) {
      console.error('[YouTubeTab] OAuth error:', error);
      showError(`❌ OAuth failed: ${error.message}`);
    }
  }

  async function connectToLiveChat() {
    console.log('[YouTubeTab] Connecting to live chat...');
    
    const apiKeyInput = document.getElementById('youtube-api-key');
    const channelIdInput = document.getElementById('youtube-channel-id');
    
    const apiKey = apiKeyInput?.value?.trim();
    const channelId = channelIdInput?.value?.trim();
    
    if (!apiKey || !channelId) {
      showError('Please enter both API key and Channel ID');
      return;
    }
    
    try {
      showStatus('Connecting to YouTube live chat...');
      
      const response = await window.electronAPI.connectYouTubeLiveChat(apiKey, channelId);
      console.log('[YouTubeTab] Chat connection response:', response);
      
      if (response.success) {
        showSuccess(`✅ Connected to live chat: ${response.streamTitle}`);
        updateConnectionStatus('connected', response.message);
        updateChatConnectionStatus(true, response);
        
      } else if (response.requiresAuth) {
        showError('❌ Authentication required. Please complete OAuth flow first.');
        
      } else {
        showError(`❌ Connection failed: ${response.error}`);
      }
      
    } catch (error) {
      console.error('[YouTubeTab] Chat connection error:', error);
      showError(`❌ Connection failed: ${error.message}`);
    }
  }

  async function disconnectFromLiveChat() {
    console.log('[YouTubeTab] Disconnecting from live chat...');
    
    try {
      showStatus('Disconnecting from YouTube live chat...');
      
      const response = await window.electronAPI.disconnectYouTubeLiveChat();
      console.log('[YouTubeTab] Disconnect response:', response);
      
      if (response.success) {
        showSuccess('✅ Disconnected from YouTube live chat');
        updateConnectionStatus('disconnected', 'Not connected');
        updateChatConnectionStatus(false);
        
      } else {
        showError(`❌ Disconnect failed: ${response.error}`);
      }
      
    } catch (error) {
      console.error('[YouTubeTab] Disconnect error:', error);
      showError(`❌ Disconnect failed: ${error.message}`);
    }
  }

  function updateOAuthStatus(authenticated) {
    const statusElement = document.getElementById('youtube-oauth-status');
    const connectButton = document.getElementById('youtube-connect-chat-btn');
    
    if (statusElement) {
      statusElement.textContent = authenticated ? 'Authenticated ✅' : 'Not Authenticated ❌';
      statusElement.className = authenticated ? 'status-success' : 'status-error';
    }
    
    if (connectButton) {
      connectButton.disabled = !authenticated;
    }
  }

  function updateChatConnectionStatus(connected, connectionInfo = null) {
    const statusElement = document.getElementById('youtube-chat-status');
    const connectButton = document.getElementById('youtube-connect-chat-btn');
    const disconnectButton = document.getElementById('youtube-disconnect-chat-btn');
    
    if (statusElement) {
      if (connected && connectionInfo) {
        statusElement.textContent = `Connected to: ${connectionInfo.streamTitle}`;
        statusElement.className = 'status-success';
      } else {
        statusElement.textContent = connected ? 'Connected' : 'Not Connected';
        statusElement.className = connected ? 'status-success' : 'status-error';
      }
    }
    
    if (connectButton) {
      connectButton.textContent = connected ? 'Connected' : 'Connect to Live Chat';
      connectButton.disabled = connected;
    }
    
    if (disconnectButton) {
      disconnectButton.disabled = !connected;
    }
  }

  // Add OAuth event handlers to wireEventHandlers
  function wireOAuthHandlers() {
    const oauthButton = document.getElementById('youtube-oauth-btn');
    const connectChatButton = document.getElementById('youtube-connect-chat-btn');
    const disconnectChatButton = document.getElementById('youtube-disconnect-chat-btn');
    
    if (oauthButton) {
      oauthButton.addEventListener('click', startOAuthFlow);
    }
    
    if (connectChatButton) {
      connectChatButton.addEventListener('click', connectToLiveChat);
    }
    
    if (disconnectChatButton) {
      disconnectChatButton.addEventListener('click', disconnectFromLiveChat);
    }
  }

  // Initialize only when explicitly called via wireYouTubeTab
  // The settings modal will call wireYouTubeTab when the tab is ready

  // Export functions for global access
  global.__youtubeTab = {
    loadAndSetupAutoConnect
  };
  
  // Export wireYouTubeTab globally for settings modal
  global.wireYouTubeTab = wireYouTubeTab;

})(window);
