// uiExtras.js - rules toggle, reveal buttons, scaling
(function(global) {
  function rules() {
    const rulesToggle = global.__domUtils.getElement('rules-toggle');
    const rulesCollapsible = global.__domUtils.getElement('rules-collapsible');
    
    if (rulesToggle && rulesCollapsible && !rulesToggle._wired) {
      rulesToggle._wired = true;
      
      // Enhanced rules toggle with memory management
      global.__domUtils.addEventHandler(rulesToggle, 'click', () => {
        const expanded = rulesToggle.getAttribute('aria-expanded') === 'true';
        if (expanded) {
          rulesToggle.setAttribute('aria-expanded', 'false');
          rulesCollapsible.classList.add('rules-collapsed');
        } else {
          rulesToggle.setAttribute('aria-expanded', 'true');
          rulesCollapsible.classList.remove('rules-collapsed');
        }
      }, 'ui-extras-rules-toggle');
    }
    
    // Enhanced reveal buttons with memory management
    console.log('[UIExtras] Setting up reveal buttons, found:', document.querySelectorAll('.reveal-btn').length);
    document.querySelectorAll('.reveal-btn').forEach((btn, index) => {
      if (btn._wired) return;
      btn._wired = true;
      
      const clickHandler = () => {
        const targetId = btn.getAttribute('data-target');
        console.log('[UIExtras] Reveal button clicked, target:', targetId);
        const input = global.__domUtils ? global.__domUtils.getElement(targetId) : document.getElementById(targetId);
        if (!input) {
          console.warn('[UIExtras] Target input not found:', targetId);
          return;
        }
        
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🙈';
        } else {
          input.type = 'password';
          btn.textContent = '👁';
        }
      };
      
      if (global.__domUtils && global.__domUtils.addEventHandler) {
        global.__domUtils.addEventHandler(btn, 'click', clickHandler, `ui-extras-reveal-btn-${index}`);
      } else {
        btn.addEventListener('click', clickHandler);
      }
    });
  }

  function applyScale() {
    const baseWidth = 1280, baseHeight = 880;
    let scale = Math.min(window.innerWidth / baseWidth * 0.95, window.innerHeight / baseHeight * 1.05);
    scale = Math.max(0.75, Math.min(1.55, scale));
    
    document.documentElement.style.setProperty('--ui-scale', scale.toFixed(3));
    
    const overlay = global.__domUtils.getElement('boss-overlay');
    if (overlay) {
      overlay.style.transform = `scale(${scale})`;
      overlay.style.transformOrigin = 'top center';
      fitOverlay();
    }
  }

  function fitOverlay() {
    const overlay = global.__domUtils.getElement('boss-overlay');
    const parent = global.__domUtils.getElement('boss-container');
    if (!overlay || !parent) return;
    
    const parentRect = parent.getBoundingClientRect();
    let currentScale = 1;
    const scaleMatch = overlay.style.transform.match(/scale\(([^)]+)\)/);
    if (scaleMatch) currentScale = parseFloat(scaleMatch[1]) || 1;
    
    let safetyCounter = 24;
    while (safetyCounter-- > 0) {
      const overlayRect = overlay.getBoundingClientRect();
      if (overlayRect.bottom <= parentRect.bottom - 6 && overlayRect.right <= parentRect.right - 6) {
        break;
      }
      currentScale -= 0.04;
      if (currentScale < 0.6) {
        currentScale = 0.6;
        break;
      }
      overlay.style.transform = `scale(${currentScale.toFixed(3)})`;
    }
  }

  function init() {
    console.log('[UIExtras] Initializing, domUtils available:', !!global.__domUtils);
    rules();
    applyScale();
    // Enhanced window resize with memory management
    if (global.__domUtils && global.__domUtils.addEventHandler) {
      global.__domUtils.addEventHandler(window, 'resize', applyScale, 'ui-extras-resize');
    } else {
      window.addEventListener('resize', applyScale);
    }
  }

  // Enhanced DOMContentLoaded with memory management
  function initializeUIExtras() {
    if (global.__domUtils && global.__domUtils.wireOnceEnhanced) {
      global.__domUtils.wireOnceEnhanced(document, 'DOMContentLoaded', init, 'ui-extras-init');
    } else {
      // Fallback if domUtils isn't ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        // DOM already loaded
        setTimeout(init, 100);
      }
    }
  }

  // Initialize immediately or wait for domUtils
  if (global.__domUtils) {
    initializeUIExtras();
  } else {
    // Wait a bit for domUtils to load
    setTimeout(initializeUIExtras, 100);
  }
  
  // Additional fallback - ensure reveal buttons work even if timing is off
  setTimeout(() => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      console.log('[UIExtras] Fallback initialization check');
      rules(); // Re-run reveal button setup
    }
  }, 500);

})(typeof window !== 'undefined' ? window : globalThis);
