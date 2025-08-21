// src/renderer/extensionTab.js - Twitch Extension Configuration
console.log('[ExtensionTab] Extension tab file loaded');

(function() {
  function wireExtensionTab() {
    console.log('[ExtensionTab] Wiring extension tab functionality');
    
    // Get extension form elements
    const extensionClientId = document.getElementById('extension-client-id');
    const extensionSecret = document.getElementById('extension-secret');
    const extensionClientSecret = document.getElementById('extension-client-secret');
    const extensionBackendUrl = document.getElementById('extension-backend-url');
    
    // Get status elements
    const backendStatus = document.getElementById('backend-status');
    const credentialsStatus = document.getElementById('credentials-status');
    
    // Get action buttons
    const testBtn = document.getElementById('btn-test-extension');
    const saveBtn = document.getElementById('btn-save-extension');
    const deployBtn = document.getElementById('btn-deploy-extension');
    
    // Update status display
    function updateStatusDisplay() {
      // Check backend URL
      const hasBackendUrl = extensionBackendUrl && extensionBackendUrl.value.trim();
      if (backendStatus) {
        backendStatus.textContent = hasBackendUrl ? 'Configured' : 'Not configured';
        backendStatus.style.color = hasBackendUrl ? '#68d391' : '#fc8181';
      }
      
      // Check credentials
      const hasClientId = extensionClientId && extensionClientId.value.trim();
      const hasSecret = extensionSecret && extensionSecret.value.trim();
      const hasClientSecret = extensionClientSecret && extensionClientSecret.value.trim();
      const credentialCount = [hasClientId, hasSecret, hasClientSecret].filter(Boolean).length;
      
      if (credentialsStatus) {
        if (credentialCount === 3) {
          credentialsStatus.textContent = 'Complete';
          credentialsStatus.style.color = '#68d391';
        } else if (credentialCount > 0) {
          credentialsStatus.textContent = `${credentialCount}/3 fields`;
          credentialsStatus.style.color = '#f6e05e';
        } else {
          credentialsStatus.textContent = 'Incomplete';
          credentialsStatus.style.color = '#fc8181';
        }
      }
    }
    
    // Load saved settings
    function loadExtensionSettings() {
      try {
        const saved = localStorage.getItem('twitchExtensionSettings');
        if (saved) {
          const settings = JSON.parse(saved);
          if (extensionClientId) extensionClientId.value = settings.clientId || '';
          if (extensionSecret) extensionSecret.value = settings.secret || '';
          if (extensionClientSecret) extensionClientSecret.value = settings.clientSecret || '';
          if (extensionBackendUrl) extensionBackendUrl.value = settings.backendUrl || '';
          console.log('[ExtensionTab] Loaded saved extension settings');
          updateStatusDisplay();
        }
      } catch (error) {
        console.warn('[ExtensionTab] Error loading extension settings:', error);
      }
    }
    
    // Save extension settings
    function saveExtensionSettings() {
      const settings = {
        clientId: extensionClientId ? extensionClientId.value : '',
        secret: extensionSecret ? extensionSecret.value : '',
        clientSecret: extensionClientSecret ? extensionClientSecret.value : '',
        backendUrl: extensionBackendUrl ? extensionBackendUrl.value : ''
      };
      
      try {
        localStorage.setItem('twitchExtensionSettings', JSON.stringify(settings));
        showNotification('Extension settings saved successfully!', 'success');
        console.log('[ExtensionTab] Extension settings saved');
        updateStatusDisplay();
        
        // Update the config.js file if possible
        updateConfigFile(settings.backendUrl);
        
      } catch (error) {
        console.error('[ExtensionTab] Error saving extension settings:', error);
        showNotification('Error saving extension settings: ' + error.message, 'error');
      }
    }
    
    // Test extension connection
    async function testExtensionConnection() {
      const backendUrl = extensionBackendUrl ? extensionBackendUrl.value.trim() : '';
      
      if (!backendUrl) {
        showNotification('Please enter a backend URL first', 'error');
        return;
      }
      
      showNotification('Testing connection...', 'info');
      
      try {
        const response = await fetch(`${backendUrl}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          showNotification(`✅ Backend connected! Status: ${data.status}`, 'success');
          if (backendStatus) {
            backendStatus.textContent = 'Connected ✅';
            backendStatus.style.color = '#68d391';
          }
        } else {
          showNotification(`❌ Backend responded with error: ${response.status}`, 'error');
          if (backendStatus) {
            backendStatus.textContent = 'Connection failed ❌';
            backendStatus.style.color = '#fc8181';
          }
        }
      } catch (error) {
        console.error('[ExtensionTab] Connection test failed:', error);
        showNotification(`❌ Connection failed: ${error.message}`, 'error');
        if (backendStatus) {
          backendStatus.textContent = 'Connection failed ❌';
          backendStatus.style.color = '#fc8181';
        }
      }
    }
    
    // Update config.js file with new backend URL
    function updateConfigFile(backendUrl) {
      if (!backendUrl) return;
      
      // Notify user that they need to update the config.js file manually
      showNotification('📝 Remember to update your frontend/config.js file with this backend URL!', 'info');
      
      // Log the exact line they need to update
      console.log('[ExtensionTab] Update this line in twitch-extension/frontend/config.js:');
      console.log(`BACKEND_URL: "${backendUrl}",`);
    }
    
    // Deploy backend (placeholder - would normally trigger actual deployment)
    async function deployBackend() {
      showNotification('🚀 Opening deployment guide...', 'info');
      
      const clientId = extensionClientId ? extensionClientId.value.trim() : '';
      const secret = extensionSecret ? extensionSecret.value.trim() : '';
      const clientSecret = extensionClientSecret ? extensionClientSecret.value.trim() : '';
      
      if (!clientId || !secret || !clientSecret) {
        showNotification('❌ Please fill in all extension credentials before deploying', 'error');
        return;
      }
      
      // Show deployment instructions
      const instructions = `
🚀 DEPLOYMENT STEPS:

1. Go to https://vercel.com and create new project
2. Connect your GitHub repo 
3. Set these environment variables:
   - TWITCH_EXT_SECRET: ${secret}
   - TWITCH_EXTENSION_CLIENT_ID: ${clientId}
   - TWITCH_EXTENSION_SECRET: ${clientSecret}
4. Deploy from backend/ folder
5. Copy the deployment URL back here

Check the console for detailed instructions.
      `;
      
      showNotification('📋 Deployment instructions logged to console', 'info');
      console.log('[ExtensionTab] DEPLOYMENT INSTRUCTIONS:', instructions);
      
      // Open Vercel in a new tab
      setTimeout(() => {
        window.open('https://vercel.com/new', '_blank');
      }, 2000);
    }
    
    // Show notification using the existing settings status system
    function showNotification(message, type = 'info') {
      // Try to use the settings modal status system if available
      if (window.showFeedback && typeof window.showFeedback === 'function') {
        window.showFeedback(message, type === 'error');
      } else {
        // Fallback to console
        console.log(`[ExtensionTab] ${type.toUpperCase()}: ${message}`);
      }
    }
    
    // Wire up event listeners using enhanced event management
    const buttonHandlers = global.__addEventHandlers([
      { element: testBtn, event: 'click', handler: testExtensionConnection },
      { element: saveBtn, event: 'click', handler: saveExtensionSettings },
      { element: deployBtn, event: 'click', handler: deployBackend }
    ].filter(config => config.element));
    
    // Update status when inputs change
    const inputElements = [extensionClientId, extensionSecret, extensionClientSecret, extensionBackendUrl].filter(Boolean);
    const inputHandlers = global.__addEventHandlers(
      inputElements.map(input => ({ element: input, event: 'input', handler: updateStatusDisplay }))
    );
    
    // Store handler keys for cleanup
    if (global.__memoryManager) {
      global.__memoryManager.addCleanupCallback(() => {
        [...buttonHandlers, ...inputHandlers].forEach(key => global.__removeEventHandler(key));
      });
    }
    
    // Load settings when tab is opened
    loadExtensionSettings();
    
    console.log('[ExtensionTab] Extension tab wired successfully');
  }
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', wireExtensionTab);
  
  // Also initialize if DOM is already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireExtensionTab);
  } else {
    wireExtensionTab();
  }
  
  // Export for external use
  window.wireExtensionTab = wireExtensionTab;
})();
