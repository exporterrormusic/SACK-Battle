// src/renderer/youtubeTab.js
// YouTube integration tab functionality

(function(global) {
  console.log('[YouTubeTab] Loading YouTube tab functionality...');

  async function loadAndSetupAutoConnect() {
    try {
      if (!global.electronAPI || !global.electronAPI.loadSettings) {
        console.warn('[YouTubeTab] electronAPI.loadSettings not available');
        return;
      }

      const settings = await global.electronAPI.loadSettings();
      console.log('[YouTubeTab] Loaded settings:', settings);

      if (settings && settings.youtubeApiKey && settings.youtubeChannelId) {
        console.log('[YouTubeTab] Auto-connecting with saved credentials...');
        
        // Auto-populate form fields
        const apiKeyInput = document.getElementById('youtube-api-key');
        const channelIdInput = document.getElementById('youtube-channel-id');
        
        if (apiKeyInput) apiKeyInput.value = settings.youtubeApiKey;
        if (channelIdInput) channelIdInput.value = settings.youtubeChannelId;

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
          // YouTube API returns channel data in snippet property
          const snippet = channelInfo.snippet || {};
          let message = `Channel: ${snippet.title || 'Unknown'}`;
          if (snippet.customUrl) {
            message += `\nCustom URL: ${snippet.customUrl}`;
          }
          // Add subscriber count if available
          if (channelInfo.statistics && channelInfo.statistics.subscriberCount) {
            message += `\nSubscribers: ${channelInfo.statistics.subscriberCount}`;
          }
          // Show channel info in an alert (don't change connection status)
          alert('✅ Channel Info:\n\n' + message);
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
    
    checkAutoConnect();
  }

  // Wire YouTube tab functionality for settings modal
  function wireYouTubeTab() {
    console.log('[YouTubeTab] Wiring YouTube tab functionality...');
    wireEventHandlers();
    updateUI();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndSetupAutoConnect);
  } else {
    loadAndSetupAutoConnect();
  }

  // Export functions for global access
  global.__youtubeTab = {
    loadAndSetupAutoConnect
  };
  
  // Export wireYouTubeTab globally for settings modal
  global.wireYouTubeTab = wireYouTubeTab;

})(window);
