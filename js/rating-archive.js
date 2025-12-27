// rating-archive.js
// Local snapshots of ratings every 7 days; optional Supabase insert
(function(){
  const ARCHIVE_KEY = 'cs_ratings_archive';
  const LAST_WEEK_KEY = 'cs_ratings_last_week'; // store week id like YYYY-Www
  const WEEK_MS = 7*24*60*60*1000;

  function readArchive(){
    try{
      const raw = localStorage.getItem(ARCHIVE_KEY) || '[]';
      return JSON.parse(raw);
    }catch(e){ console.warn('Failed read ratings archive', e); return []; }
  }
  function writeArchive(arr){
    try{ localStorage.setItem(ARCHIVE_KEY, JSON.stringify(arr)); }catch(e){ console.warn('Failed write ratings archive', e); }
  }

  // helper: return ISO week id like 2025-W52 (Monday-based week)
  function getWeekIdForDate(d){
    // using UTC to avoid timezone surprises
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Thursday in current week decides the year.
    date.setUTCDate(date.getUTCDate() + 3 - (date.getUTCDay() + 6) % 7);
    const week1 = new Date(Date.UTC(date.getUTCFullYear(),0,4));
    const weekNo = 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getUTCDay() + 6) % 7) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`;
  }

  async function maybeCreateSnapshot(teams){
    try{
      const now = new Date();
      const currentWeekId = getWeekIdForDate(now);
      const lastWeekId = localStorage.getItem(LAST_WEEK_KEY);
      if (lastWeekId === currentWeekId) return null; // already created for this calendar week

      const snapshot = {
        date: now.toISOString(),
        weekId: currentWeekId,
        teams: (teams||[]).map(t=>({ name: t.name, rating: t.rating||0, country: t.country||'', region: t.region||'' }))
      };

      const arr = readArchive();
      arr.unshift(snapshot); // newest first
      // trim to reasonable length (keep 52 weeks)
      if (arr.length > 52) arr.splice(52);
      writeArchive(arr);
      localStorage.setItem(LAST_WEEK_KEY, currentWeekId);

      // Try to save to Supabase if available
      if (window.csApi && csApi.client) {
        try{
          await csApi.client.from('ratings_archive').insert([{ snapshot_date: snapshot.date, week_id: snapshot.weekId, entries: snapshot.teams }]);
        }catch(e){ console.warn('Supabase archive insert failed', e); }
      }

      return snapshot;
    }catch(e){ console.warn('maybeCreateSnapshot error', e); return null; }
  }

  function getArchive(){ return readArchive(); }

  // Render modal UI
  function renderArchiveModal(){
    // create modal if not exists
    let modal = document.getElementById('ratingArchiveModal');
    if (!modal){
      modal = document.createElement('div');
      modal.id = 'ratingArchiveModal';
      modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 hidden';
      modal.innerHTML = `
        <div class="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 p-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold">Ratings Archive</h2>
            <div>
              <button id="archiveCloseBtn" class="px-3 py-1 bg-gray-700 rounded">Close</button>
            </div>
          </div>
          <div id="archiveList"></div>
          <div id="archiveDetail" class="mt-4"></div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('archiveCloseBtn').addEventListener('click', ()=> modal.classList.add('hidden'));
    }

    const list = document.getElementById('archiveList');
    const detail = document.getElementById('archiveDetail');
    list.innerHTML = '';
    detail.innerHTML = '';

    const arr = readArchive();
    if (!arr || arr.length === 0){ list.innerHTML = '<div class="p-4 text-gray-400">No snapshots yet</div>'; modal.classList.remove('hidden'); return; }

    const ul = document.createElement('div');
    ul.className = 'space-y-2';
    arr.forEach((s, idx)=>{
      const d = new Date(s.date);
      const el = document.createElement('div');
      el.className = 'flex items-center justify-between p-3 bg-gray-700 rounded';
      el.innerHTML = `<div><div class="font-medium">${d.toLocaleString()}</div><div class="text-sm text-gray-400">${s.teams.length} teams</div></div><div class="flex gap-2"><button data-idx="${idx}" class="view-snap-btn px-3 py-1 bg-blue-600 rounded">View</button><button data-idx="${idx}" class="del-snap-btn px-3 py-1 bg-red-600 rounded">Delete</button></div>`;
      ul.appendChild(el);
    });
    list.appendChild(ul);

    // handlers
    list.querySelectorAll('.view-snap-btn').forEach(btn=> btn.addEventListener('click', (e)=>{
      const idx = parseInt(e.currentTarget.dataset.idx,10);
      showSnapshotDetail(arr[idx]);
    }));
    list.querySelectorAll('.del-snap-btn').forEach(btn=> btn.addEventListener('click', (e)=>{
      const idx = parseInt(e.currentTarget.dataset.idx,10);
      if (!confirm('Delete this snapshot?')) return;
      arr.splice(idx,1);
      writeArchive(arr);
      renderArchiveModal();
    }));

    function showSnapshotDetail(snap){
      if (!snap) return;
      // Use same style/renderers as main ratings page when available
      const teams = (snap.teams || []).slice().sort((a,b)=> (b.rating||0) - (a.rating||0));
      detail.innerHTML = `<h3 class="font-bold mb-2">Snapshot: ${new Date(snap.date).toLocaleString()} ${snap.weekId?('('+snap.weekId+')'):''}</h3><div id="archiveSnapshotContainer" class="w-full"></div>`;
      const containerEl = detail.querySelector('#archiveSnapshotContainer');
      try {
        if (typeof renderTable === 'function' && typeof renderCards === 'function') {
          // Reuse current view mode and renderer
          if (window.currentViewMode === 'table') {
            renderTable(teams, containerEl, {});
          } else {
            renderCards(teams, containerEl, {});
          }
        } else {
          // Fallback to simple table if renderers not available
          const rows = teams.map(t=>`<tr><td>${t.name}</td><td>${t.country||'-'}</td><td>${t.region||'-'}</td><td>${t.rating}</td></tr>`).join('');
          containerEl.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr><th>Team</th><th>Country</th><th>Region</th><th>Rating</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }
      } catch (e) {
        console.warn('Render snapshot failed', e);
        containerEl.innerHTML = '<div class="text-red-400 p-4">Failed to render snapshot.</div>';
      }
    }

    modal.classList.remove('hidden');
  }

  // Expose API
  window.ratingArchive = { maybeCreateSnapshot, getArchive, renderArchiveModal };

  // Attach open button if present
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('openArchiveBtn');
    if (btn) btn.addEventListener('click', ()=> {
      // Open standalone archive page in new tab for full styles
      const url = 'ratings-archive.html';
      try { window.open(url, '_blank'); } catch(e){ window.location.href = url; }
    });
  });
})();
