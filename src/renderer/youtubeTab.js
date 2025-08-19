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
            const statusEl = document.getElementById('youtube-status');
            if (statusEl) statusEl.textContent = 'Connected';
          }
        } catch (error) {
          console.warn('[YouTubeTab] Auto-connect failed:', error);
        }
      }
    } catch (error) {
      console.error('[YouTubeTab] Setup failed:', error);
    }
  }

  // Wire up YouTube tab button functionality
  function wireYouTubeTab() {
    console.log('[YouTubeTab] Wiring YouTube tab buttons...');

    // Validate API Key button
    const validateKeyBtn = document.getElementById('youtube-validate-key');
    if (validateKeyBtn) {
      validateKeyBtn.addEventListener('click', async () => {
        const apiKeyInput = document.getElementById('youtube-api-key');
        const apiKey = apiKeyInput?.value?.trim();
        
        if (!apiKey) {
          alert('Please enter a YouTube API key first.');
          return;
        }

        try {
          validateKeyBtn.disabled = true;
          validateKeyBtn.textContent = 'Validating...';
          
          const isValid = await global.electronAPI.validateYouTubeKey(apiKey);
          if (isValid) {
            validateKeyBtn.textContent = 'Valid ✓';
            validateKeyBtn.style.backgroundColor = '#10b981';
            setTimeout(() => {
              validateKeyBtn.textContent = 'Validate Key';
              validateKeyBtn.style.backgroundColor = '';
              validateKeyBtn.disabled = false;
            }, 2000);
          } else {
            throw new Error('Invalid API key');
          }
        } catch (error) {
          console.error('[YouTubeTab] API key validation failed:', error);
          validateKeyBtn.textContent = 'Invalid ✗';
          validateKeyBtn.style.backgroundColor = '#ef4444';
          setTimeout(() => {
            validateKeyBtn.textContent = 'Validate Key';
            validateKeyBtn.style.backgroundColor = '';
            validateKeyBtn.disabled = false;
          }, 2000);
        }
      });
    }

    // Get Channel Info button
    const getChannelInfoBtn = document.getElementById('youtube-get-channel-info');
    if (getChannelInfoBtn) {
      getChannelInfoBtn.addEventListener('click', async () => {
        const apiKeyInput = document.getElementById('youtube-api-key');
        const channelIdInput = document.getElementById('youtube-channel-id');
        const apiKey = apiKeyInput?.value?.trim();
        const channelId = channelIdInput?.value?.trim();
        
        if (!apiKey || !channelId) {
          alert('Please enter both API key and Channel ID first.');
          return;
        }

        try {
          getChannelInfoBtn.disabled = true;
          getChannelInfoBtn.textContent = 'Getting Info...';
          
          const channelInfo = await global.electronAPI.getYouTubeChannelInfo(channelId, apiKey);
          console.log('[YouTubeTab] Channel info response:', channelInfo);
          
          if (channelInfo && !channelInfo.error) {
            const infoDiv = document.getElementById('youtube-channel-info');
            const detailsDiv = document.getElementById('youtube-channel-details');
            
            if (infoDiv && detailsDiv) {
              // Extract data from YouTube API response structure
              const snippet = channelInfo.snippet || {};
              const statistics = channelInfo.statistics || {};
              
              detailsDiv.innerHTML = `
                <p><strong>Channel:</strong> ${snippet.title || 'Unknown'}</p>
                <p><strong>Subscriber Count:</strong> ${statistics.subscriberCount || 'Hidden'}</p>
                <p><strong>Video Count:</strong> ${statistics.videoCount || 'Unknown'}</p>
                <p><strong>View Count:</strong> ${statistics.viewCount || 'Unknown'}</p>
              `;
              infoDiv.style.display = 'block';
            }
            
            getChannelInfoBtn.textContent = 'Success ✓';
            getChannelInfoBtn.style.backgroundColor = '#10b981';
          }
        } catch (error) {
          console.error('[YouTubeTab] Channel info failed:', error);
          
          // Show specific error message if available
          let errorMessage = 'Failed to get channel information. Please check your API key and Channel ID.';
          if (error.message) {
            errorMessage += '\n\nError: ' + error.message;
          }
          
          alert(errorMessage);
          getChannelInfoBtn.textContent = 'Failed ✗';
          getChannelInfoBtn.style.backgroundColor = '#ef4444';
        }
        
        setTimeout(() => {
          getChannelInfoBtn.textContent = 'Get Channel Info';
          getChannelInfoBtn.style.backgroundColor = '';
          getChannelInfoBtn.disabled = false;
        }, 2000);
      });
    }

    // Connect button
    const connectBtn = document.getElementById('youtube-connect');
    if (connectBtn) {
      connectBtn.addEventListener('click', async () => {
        const apiKeyInput = document.getElementById('youtube-api-key');
        const channelIdInput = document.getElementById('youtube-channel-id');
        const apiKey = apiKeyInput?.value?.trim();
        const channelId = channelIdInput?.value?.trim();
        
        if (!apiKey || !channelId) {
          alert('Please enter both API key and Channel ID first.');
          return;
        }

        try {
          connectBtn.disabled = true;
          connectBtn.textContent = 'Connecting...';
          
          const result = await global.electronAPI.connectYouTube(apiKey, channelId);
          if (result) {
            connectBtn.style.display = 'none';
            const disconnectBtn = document.getElementById('youtube-disconnect');
            if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
            
            const statusEl = document.getElementById('youtube-status');
            if (statusEl) statusEl.textContent = 'Connected';
            
            console.log('[YouTubeTab] Connected successfully');
          }
        } catch (error) {
          console.error('[YouTubeTab] Connection failed:', error);
          alert('Failed to connect to YouTube. Please check your credentials.');
          connectBtn.textContent = 'Connect to YouTube';
          connectBtn.disabled = false;
        }
      });
    }

    // Disconnect button  
    const disconnectBtn = document.getElementById('youtube-disconnect');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', async () => {
        try {
          await global.electronAPI.disconnectYouTube();
          
          disconnectBtn.style.display = 'none';
          connectBtn.style.display = 'inline-block';
          connectBtn.disabled = false;
          
          const statusEl = document.getElementById('youtube-status');
          if (statusEl) statusEl.textContent = 'Disconnected';
          
          console.log('[YouTubeTab] Disconnected successfully');
        } catch (error) {
          console.error('[YouTubeTab] Disconnect failed:', error);
        }
      });
    }

    // Enable/disable connect button based on input
    const apiKeyInput = document.getElementById('youtube-api-key');
    const channelIdInput = document.getElementById('youtube-channel-id');
    
    function updateConnectButton() {
      if (connectBtn) {
        const hasApiKey = apiKeyInput?.value?.trim();
        const hasChannelId = channelIdInput?.value?.trim();
        connectBtn.disabled = !(hasApiKey && hasChannelId);
      }
    }
    
    if (apiKeyInput) apiKeyInput.addEventListener('input', updateConnectButton);
    if (channelIdInput) channelIdInput.addEventListener('input', updateConnectButton);
    
    // Initial check
    updateConnectButton();
    
    console.log('[YouTubeTab] YouTube tab buttons wired successfully');
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
