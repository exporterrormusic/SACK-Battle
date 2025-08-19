// src/renderer/utils.js
// Small shared DOM helpers extracted from the legacy renderer.
(function(){
  function createOption(value, text){
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = typeof text === 'string' ? text : value;
    return opt;
  }
  function populateSelect(selectEl, values){
    if (!selectEl || !Array.isArray(values)) return;
    selectEl.innerHTML = '';
    values.forEach(v=>{
      const label = (v||'').replace(/\.[^.]+$/, '');
      selectEl.appendChild(createOption(v, label));
    });
  }
  window.createOption = createOption;
  window.populateSelect = populateSelect;
})();
