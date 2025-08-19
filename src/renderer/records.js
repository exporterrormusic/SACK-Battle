// src/renderer/records.js
// Player records UI management extracted from renderer.js
(function(){
  function renderRecords(){
    const Game=window.Game;
    const tableBody=document.getElementById('records-tbody');
    const userInput=document.getElementById('record-username');
    const scoreInput=document.getElementById('record-score');
    if (!Game || !Game.getPlayerRecords || !tableBody) return;
    const recs=Game.getPlayerRecords();
    const live=Game.getState && Game.getState();
    const filtered=Object.entries(recs).filter(([name])=>{
      if (live && live.players && live.players[name] && live.players[name].isBot) return false;
      if (/^Bot\d+$/i.test(name)) return false;
      return true;
    });
    const sorted=filtered.sort((a,b)=> b[1].score - a[1].score);
    tableBody.innerHTML='';
    sorted.forEach(([name,data])=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td style="padding:4px 6px;">${name}</td>`+
        `<td style=\"padding:4px 6px;text-align:right;\">${data.score}</td>`+
        `<td style=\"padding:4px 6px;text-align:center;\">`+
        `<button data-edit="${name}" class="record-edit" style=\"background:#3b4fa0;border:none;color:#fff;padding:2px 8px;border-radius:6px;cursor:pointer;font-size:0.65rem;\">Edit</button> `+
        `<button data-del="${name}" class="record-del" style=\"background:#a33;border:none;color:#fff;padding:2px 8px;border-radius:6px;cursor:pointer;font-size:0.65rem;\">Del</button>`+
        `</td>`;
      tableBody.appendChild(tr);
    });
    tableBody.querySelectorAll('button[data-edit]').forEach(btn=>{
      btn.onclick=()=>{ const user=btn.getAttribute('data-edit'); const recs2=Game.getPlayerRecords(); if (!recs2[user]) return; if (userInput) userInput.value=user; if (scoreInput) scoreInput.value=recs2[user].score; };
    });
    tableBody.querySelectorAll('button[data-del]').forEach(btn=>{
      btn.onclick = () => { 
        const user = btn.getAttribute('data-del'); 
        if (Game.deletePlayerRecord) Game.deletePlayerRecord(user); 
        if (window.__persistenceHelper) {
          window.__persistenceHelper.persist('records-delete');
        } else if (window.__schedulePersist) {
          window.__schedulePersist();
        }
        renderRecords(); 
      };
    });
  }
  function wireRecordButtons(){
    const Game=window.Game;
    const setBtn=document.getElementById('record-set-btn');
    const delAllBtn=document.getElementById('record-delete-all-btn');
    const userInput=document.getElementById('record-username');
    const scoreInput=document.getElementById('record-score');
    if (setBtn && !setBtn._wired){
      setBtn._wired=true;
      setBtn.onclick=()=>{
  const user=(userInput?.value||'').trim();
  const score=parseInt(scoreInput?.value||'0',10)||0;
  if (!user) return;
  if (Game.setPlayerRecord) Game.setPlayerRecord(user, { score });
  if (Game.setPlayerScore) Game.setPlayerScore(user, score); // Ensure live player state updates
  if (window.__persistenceHelper) {
    window.__persistenceHelper.persist('records-set');
  } else if (window.__schedulePersist) {
    window.__schedulePersist();
  }
  userInput.value='';
  scoreInput.value='';
  renderRecords();
  if (window.renderPlayers && Game.getState) window.renderPlayers(Game.getState().players); // Force player UI refresh
      };
    }
    if (delAllBtn && !delAllBtn._wired) { 
      delAllBtn._wired = true; 
      delAllBtn.onclick = () => { 
        if (Game && Game.clearPlayerRecords) Game.clearPlayerRecords(); 
        if (window.__persistenceHelper) {
          window.__persistenceHelper.persist('records-clear-all');
        } else if (window.__schedulePersist) {
          window.__schedulePersist();
        }
        renderRecords(); 
      }; 
    }
  }
  function initRecords(){ renderRecords(); wireRecordButtons(); }
  document.addEventListener('DOMContentLoaded', initRecords);
  window.renderRecords = renderRecords;
})();
