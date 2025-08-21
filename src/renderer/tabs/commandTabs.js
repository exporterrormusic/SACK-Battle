// src/renderer/commandTabs.js
(function(){
  function initCommandTabs() {
    // Handle Basic Commands Sub-tabs
    const commandSubTabs = document.querySelectorAll('.command-sub-tab');
    const commandContents = document.querySelectorAll('.command-platform-content');
    
    commandSubTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const platform = this.dataset.platform;
        
        // Update tab states
        commandSubTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Update content visibility
        commandContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `${platform}-commands`) {
            content.classList.add('active');
          }
        });
      });
    });
    
    // Handle Trigger Events Sub-tabs
    const triggerSubTabs = document.querySelectorAll('.trigger-sub-tab');
    const triggerContents = document.querySelectorAll('.trigger-content');
    
    triggerSubTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const triggerType = this.dataset.trigger;
        
        // Update tab states
        triggerSubTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Update content visibility
        triggerContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `${triggerType}-triggers`) {
            content.classList.add('active');
          }
        });
      });
    });

    // Handle Twitch Sub-tabs
    const twitchSubTabs = document.querySelectorAll('.twitch-sub-tab');
    const twitchContents = document.querySelectorAll('.twitch-tab-content');
    
    twitchSubTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const twitchTab = this.dataset.twitchTab;
        
        // Update tab states
        twitchSubTabs.forEach(t => {
          t.classList.remove('active');
          t.style.background = 'transparent';
          t.style.color = '#a0aec0';
        });
        this.classList.add('active');
        this.style.background = '#4299e1';
        this.style.color = 'white';
        
        // Update content visibility
        twitchContents.forEach(content => {
          content.classList.remove('active');
          content.style.display = 'none';
          if (content.id === `twitch-${twitchTab}-content`) {
            content.classList.add('active');
            content.style.display = 'block';
          }
        });
      });
    });
  }
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', initCommandTabs);
  
  // Also initialize if DOM is already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommandTabs);
  } else {
    initCommandTabs();
  }
})();
