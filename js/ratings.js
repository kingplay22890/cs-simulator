// === РЕЙТИНГИ ИЗ SUPABASE + REALTIME ===
let currentViewMode = localStorage.getItem('ratingsViewMode') || 'cards';

async function getTeams() {
  let teams = [];
  if (window.csApi) {
    teams = await window.csApi.fetchTeams();
  } else {
    // Fallback для локального режима
    const raw = localStorage.getItem('cs_teams');
    teams = JSON.parse(raw || '[]');
  }
  return teams.sort((a, b) => b.rating - a.rating);
}

function renderCards(teams, container) {
  container.className = 'ratings-cards-view';
  container.innerHTML = '';
  
  teams.forEach((team, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : 'rank-normal';
    
    const card = document.createElement('a');
    card.href = `team-profile.html?team=${encodeURIComponent(team.name)}`;
    card.className = 'rating-card';
    card.innerHTML = `
      <div class="rating-card-rank ${rankClass}">#${rank}</div>
      <div class="rating-card-logo">
        ${team.logoUrl ? `<img src="${team.logoUrl}" alt="${team.name}" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }">` : ''}
        <div class="rating-card-logo-placeholder" style="${team.logoUrl ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">${team.name.charAt(0).toUpperCase()}</div>
      </div>
      <div class="rating-card-info">
        <div class="rating-card-name">${team.name}</div>
        <div class="rating-card-rating">
          <span class="rating-label">Rating</span>
          <span class="rating-value">${team.rating}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderTable(teams, container) {
  container.className = 'ratings-table-view';
  container.innerHTML = '';
  
  const table = document.createElement('table');
  table.className = 'ratings-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Rank</th>
        <th>Logo</th>
        <th>Team Name</th>
        <th>Rating</th>
      </tr>
    </thead>
    <tbody>
      ${teams.map((team, i) => {
        const rank = i + 1;
        const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : 'rank-normal';
        const profileUrl = `team-profile.html?team=${encodeURIComponent(team.name)}`;
        return `
          <tr class="rating-table-row" data-href="${profileUrl}">
            <td class="rating-table-rank">
              <span class="rank-badge ${rankClass}">#${rank}</span>
            </td>
            <td class="rating-table-logo">
              ${team.logoUrl ? `<img src="${team.logoUrl}" alt="${team.name}" class="rating-table-logo-img" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }">` : ''}
              <div class="rating-table-logo-placeholder" style="${team.logoUrl ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">${team.name.charAt(0).toUpperCase()}</div>
            </td>
            <td class="rating-table-name">
              <span class="rating-table-link">${team.name}</span>
            </td>
            <td class="rating-table-rating">
              <span class="rating-table-value">${team.rating}</span>
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;
  container.appendChild(table);
  
  // Добавляем обработчики клика на строки
  const rows = table.querySelectorAll('.rating-table-row');
  rows.forEach(row => {
    row.addEventListener('click', (e) => {
      // Не переходим, если кликнули на ссылку внутри (если она есть)
      if (e.target.tagName === 'A') return;
      const href = row.getAttribute('data-href');
      if (href) {
        window.location.href = href;
      }
    });
  });
}

async function updateRatingsTable() {
  try {
    const container = document.querySelector('#ratingsContainer');
    if (!container) return;
    
    const teams = await getTeams();
    
    if (currentViewMode === 'cards') {
      renderCards(teams, container);
    } else {
      renderTable(teams, container);
    }
  } catch (e) {
    console.error('Failed to update ratings table:', e);
  }
}

function setViewMode(mode) {
  currentViewMode = mode;
  localStorage.setItem('ratingsViewMode', mode);
  
  const cardsBtn = document.getElementById('viewCardsBtn');
  const tableBtn = document.getElementById('viewTableBtn');
  
  if (cardsBtn && tableBtn) {
    if (mode === 'cards') {
      cardsBtn.classList.add('active');
      tableBtn.classList.remove('active');
    } else {
      tableBtn.classList.add('active');
      cardsBtn.classList.remove('active');
    }
  }
  
  updateRatingsTable();
}

document.addEventListener('DOMContentLoaded', () => {
  // Инициализация режима просмотра
  setViewMode(currentViewMode);
  
  // Обработчики переключения режима
  const cardsBtn = document.getElementById('viewCardsBtn');
  const tableBtn = document.getElementById('viewTableBtn');
  
  if (cardsBtn) {
    cardsBtn.addEventListener('click', () => setViewMode('cards'));
  }
  if (tableBtn) {
    tableBtn.addEventListener('click', () => setViewMode('table'));
  }
  
  // Realtime подписка на любые изменения таблицы teams
  if (window.csApi?.client) {
    const channel = window.csApi.client
      .channel('ratings-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        if (document.visibilityState === 'visible') updateRatingsTable();
      })
      .subscribe();
    // На всякий случай периодическое обновление
    setInterval(() => document.visibilityState === 'visible' && updateRatingsTable(), 5000);
  }
});

window.updateRatingsTable = updateRatingsTable;
