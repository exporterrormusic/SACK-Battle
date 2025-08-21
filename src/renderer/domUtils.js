// src/renderer/domUtils.js
// Common DOM utility functions to reduce code duplication

(function(global) {
  'use strict';
  
  if (global.__domUtils) return; // Singleton guard
  
  /**
   * Create a styled button with common properties
   * @param {string} text - Button text
   * @param {string} className - CSS class name
   * @param {Function} onclick - Click handler
   * @param {Object} styles - Additional styles
   * @returns {HTMLButtonElement}
   */
  function createButton(text, className = '', onclick = null, styles = {}) {
    const btn = document.createElement('button');
    btn.textContent = text;
    if (className) btn.className = className;
    if (onclick) btn.onclick = onclick;
    
    // Apply styles
    Object.entries(styles).forEach(([key, value]) => {
      btn.style[key] = value;
    });
    
    return btn;
  }
  
  /**
   * Create a styled input with common properties
   * @param {string} type - Input type
   * @param {Object} attributes - Input attributes
   * @param {Object} styles - Styles to apply
   * @returns {HTMLInputElement}
   */
  function createInput(type = 'text', attributes = {}, styles = {}) {
    const input = document.createElement('input');
    input.type = type;
    
    // Apply attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          input.dataset[dataKey] = dataValue;
        });
      } else {
        input[key] = value;
      }
    });
    
    // Apply styles
    Object.entries(styles).forEach(([key, value]) => {
      input.style[key] = value;
    });
    
    return input;
  }
  
  /**
   * Create a styled label wrapper
   * @param {string} text - Label text
   * @param {HTMLElement} element - Element to wrap
   * @param {Object} styles - Styles to apply
   * @returns {HTMLLabelElement}
   */
  function createLabelWrapper(text, element, styles = {}) {
    const label = document.createElement('label');
    label.textContent = text;
    
    // Default styles for consistency
    const defaultStyles = {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '0.55rem',
      opacity: '.7'
    };
    
    // Apply styles
    Object.entries({ ...defaultStyles, ...styles }).forEach(([key, value]) => {
      label.style[key] = value;
    });
    
    if (element) label.appendChild(element);
    return label;
  }
  
  /**
   * Create an option element
   * @param {string} value - Option value
   * @param {string} text - Option text
   * @param {boolean} selected - Whether option is selected
   * @returns {HTMLOptionElement}
   */
  function createOption(value, text = null, selected = false) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text || value;
    option.selected = selected;
    return option;
  }
  
  /**
   * Populate a select element with options
   * @param {HTMLSelectElement} selectEl - Select element
   * @param {Array} options - Array of {value, text, selected} objects or strings
   */
  function populateSelect(selectEl, options = []) {
    if (!selectEl || !Array.isArray(options)) return;
    
    selectEl.innerHTML = '';
    options.forEach(opt => {
      if (typeof opt === 'string') {
        selectEl.appendChild(createOption(opt));
      } else {
        selectEl.appendChild(createOption(opt.value, opt.text, opt.selected));
      }
    });
  }
  
  /**
   * Wire an element with click handler only once
   * @param {HTMLElement} element - Element to wire
   * @param {Function} handler - Click handler
   * @param {string} context - Context for debugging
   */
  function wireOnce(element, handler, context = '') {
    if (!element || element._wired) return;
    element._wired = true;
    element.onclick = handler;
    
    if (context && global.console && global.console.log) {
      global.console.log(`[DomUtils] Wired ${context}`);
    }
  }

  /**
   * Safe getElementById with optional console warning
   * @param {string} id - Element ID
   * @param {boolean} warn - Whether to warn if not found
   * @returns {HTMLElement|null}
   */
  function getElement(id, warn = false) {
    const el = document.getElementById(id);
    if (!el && warn && global.console) {
      global.console.warn(`[DomUtils] Element not found: ${id}`);
    }
    return el;
  }

  /**
   * Create a styled div with common patterns
   * @param {Object} options - Configuration object
   * @param {string} options.className - CSS class
   * @param {Object} options.styles - Inline styles
   * @param {Object} options.dataset - Data attributes
   * @param {string} options.textContent - Text content
   * @param {string} options.innerHTML - HTML content
   * @returns {HTMLDivElement}
   */
  function createDiv({ className = '', styles = {}, dataset = {}, textContent = '', innerHTML = '' } = {}) {
    const div = document.createElement('div');
    if (className) div.className = className;
    if (textContent) div.textContent = textContent;
    if (innerHTML) div.innerHTML = innerHTML;
    
    // Apply styles
    Object.entries(styles).forEach(([key, value]) => {
      div.style[key] = value;
    });
    
    // Apply dataset
    Object.entries(dataset).forEach(([key, value]) => {
      div.dataset[key] = value;
    });
    
    return div;
  }

  /**
   * Create an image element with common properties
   * @param {string} src - Image source
   * @param {Object} options - Configuration object
   * @returns {HTMLImageElement}
   */
  function createImage(src, { alt = '', className = '', styles = {}, dataset = {} } = {}) {
    const img = document.createElement('img');
    img.src = src;
    if (alt) img.alt = alt;
    if (className) img.className = className;
    
    // Apply styles
    Object.entries(styles).forEach(([key, value]) => {
      img.style[key] = value;
    });
    
    // Apply dataset
    Object.entries(dataset).forEach(([key, value]) => {
      img.dataset[key] = value;
    });
    
    return img;
  }

  /**
   * Batch getElementById calls for efficiency
   * @param {Array<string>} ids - Array of element IDs
   * @returns {Object} - Object mapping id to element
   */
  function getElements(ids) {
    const elements = {};
    ids.forEach(id => {
      elements[id] = document.getElementById(id);
    });
    return elements;
  }

  /**
   * Apply styles to element with validation
   * @param {HTMLElement} element - Target element
   * @param {Object} styles - Styles to apply
   */
  function applyStyles(element, styles = {}) {
    if (!element || !element.style) return;
    Object.entries(styles).forEach(([key, value]) => {
      try {
        element.style[key] = value;
      } catch (e) {
        if (global.console) {
          global.console.warn(`[DomUtils] Invalid style property: ${key}=${value}`);
        }
      }
    });
  }

  /**
   * Add event handler with optional memory management
   * @param {HTMLElement} element - Element to attach event to
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   * @param {string} key - Optional key for memory management
   * @param {Object|boolean} options - Event listener options
   * @returns {string} - Key for cleanup
   */
  function addEventHandler(element, event, handler, key = '', options = {}) {
    if (!element) return null;

    // Use memory manager if available for better cleanup
    if (global.__memoryManager) {
      return global.__memoryManager.addEventListener(element, event, handler, options);
    }

    // Fallback to direct attachment
    const eventOptions = typeof options === 'boolean' ? options : (options || {});
    element.addEventListener(event, handler, eventOptions);
    return `${element.id || element.tagName}-${event}-${Date.now()}`;
  }

  /**
   * Remove event handler by key
   * @param {string} handlerKey - Key returned from addEventHandler
   */
  function removeEventHandler(handlerKey) {
    if (!handlerKey) return false;
    
    if (global.__memoryManager) {
      return global.__memoryManager.removeEventListener(handlerKey);
    }
    
    // For fallback mode, removal would need additional tracking
    return false;
  }

  /**
   * Batch event handler setup for multiple elements
   * @param {Array} handlerConfigs - Array of {element, event, handler, options} objects
   * @returns {Array} - Array of handler keys
   */
  function addEventHandlers(handlerConfigs) {
    return handlerConfigs.map(config => {
      const { element, event, handler, options = {} } = config;
      return addEventHandler(element, event, handler, options);
    }).filter(Boolean);
  }

  /**
   * Enhanced wireOnce with memory management
   * @param {HTMLElement|string} element - Element or ID to wire
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {string} context - Context for debugging
   * @returns {string} - Handler key for cleanup
   */
  function wireOnceEnhanced(element, event, handler, context = '') {
    if (typeof element === 'string') {
      element = getElement(element, true);
    }
    if (!element || element._wired) return null;
    
    element._wired = true;
    const key = addEventHandler(element, event, handler, `${context}-${event}`);
    
    if (context && global.console && global.console.log) {
      global.console.log(`[DomUtils] Wired ${context} for ${event}`);
    }
    
    return key;
  }
  
  // Export API
  const api = {
    createButton,
    createInput,
    createLabelWrapper,
    createOption,
    populateSelect,
    wireOnce,
    getElement,
    createDiv,
    createImage,
    getElements,
    applyStyles,
    addEventHandler,
    removeEventHandler,
    addEventHandlers,
    wireOnceEnhanced
  };
  
  global.__domUtils = api;
  
  // Also expose individual functions for convenience
  Object.entries(api).forEach(([name, func]) => {
    global[`__${name}`] = func;
  });
  
})(typeof window !== 'undefined' ? window : globalThis);
