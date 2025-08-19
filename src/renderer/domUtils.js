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
  
  // Export API
  const api = {
    createButton,
    createInput,
    createLabelWrapper,
    createOption,
    populateSelect,
    wireOnce
  };
  
  global.__domUtils = api;
  
  // Also expose individual functions for convenience
  Object.entries(api).forEach(([name, func]) => {
    global[`__${name}`] = func;
  });
  
})(typeof window !== 'undefined' ? window : globalThis);
