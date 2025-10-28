// team-profile.js - исправленная версия

let allTeams = [];

// Локальная версия readSavedTeams, чтобы не зависеть от script.js на этой странице
function readSavedTeams() {
  try {
    const raw = localStorage.getItem('cs_teams');
    const parsed = JSON.parse(raw || '[]');
    return parsed.map(t => ({
      name: t.name,
      logoUrl: t.logoUrl || '',
      players: Array.isArray(t.players) ? t.players : [],
      rating: typeof t.rating === 'number' ? t.rating : 1500,
      history: Array.isArray(t.history) ? t.history : []
    }));
  } catch (e) {
    console.error('Error reading teams (profile):', e);
    return [];
  }
}

// Загружаем команды из localStorage и нормализуем структуру
async function loadAllTeams() {
  try {
    if (window.csApi) {
      allTeams = await window.csApi.fetchTeams();
    } else {
      const saved = localStorage.getItem('cs_teams');
      allTeams = JSON.parse(saved || '[]');
      allTeams = allTeams.map(t => ({
        name: t.name,
        logoUrl: t.logoUrl || '',
        players: Array.isArray(t.players) ? t.players : [],
        rating: typeof t.rating === 'number' ? t.rating : 1500,
        history: Array.isArray(t.history) ? t.history : []
      }));
    }
    return allTeams;
  } catch (error) {
    console.error('Error loading teams:', error);
    allTeams = [];
    return [];
  }
}

function populateTeamSelect() {
  const select = document.getElementById('teamSelect');
  if (!select) {
    console.error('Team select element not found!');
    return;
  }

  // сохраняем текущее значение чтобы не сбрасывать выбор
  const current = select.value;
  select.innerHTML = '<option value="">Выберите команду</option>';

  if (allTeams.length === 0) {
    console.log('No teams to display');
    return;
  }

  allTeams.forEach(team => {
    const opt = document.createElement('option');
    opt.value = team.name;
    opt.textContent = team.name;
    select.appendChild(opt);
  });

  // если в URL есть команда — выберем её
  const urlParams = new URLSearchParams(window.location.search);
  const teamFromUrl = urlParams.get('team');
  if (teamFromUrl) {
    select.value = teamFromUrl;
  } else if (current) {
    select.value = current;
  }
}

function openTeamProfile(teamName) {
  const select = document.getElementById('teamSelect');
  if (!select) return;
  select.value = teamName;
  showTeamProfile();
}

async function showTeamProfile() {
  // Перезагружаем данные, чтобы была актуальная информация
  await loadAllTeams();

  const select = document.getElementById('teamSelect');
  if (!select) return;
  const teamName = select.value;
  const profileContainer = document.getElementById('profile');

  if (!teamName) {
    if (profileContainer) profileContainer.classList.add('hidden');
    return;
  }

  const team = allTeams.find(t => t.name === teamName);
  if (!team) {
    console.log('Team not found for profile:', teamName);
    if (profileContainer) profileContainer.classList.add('hidden');
    return;
  }

  try {
    // Ранг
    const sorted = [...allTeams].sort((a, b) => b.rating - a.rating);
    const rank = sorted.findIndex(t => t.name === teamName) + 1;

    // История (новые сверху)
    const history = Array.isArray(team.history) ? [...team.history] : [];
    history.sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return db - da;
    });

    const totalMatches = history.length;
    const wins = history.filter(m => m.result === 'Win').length;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
    const last5 = history.slice(0, 5);
    const ratingChange5 = last5.reduce((sum, m) => sum + (m.ratingChange || 0), 0);

    // Обновляем DOM безопасно
    const logoEl = document.getElementById('teamLogo');
    if (logoEl) {
      logoEl.src = team.logoUrl || 'https://via.placeholder.com/64';
      logoEl.onerror = function() { this.src = 'https://via.placeholder.com/64'; };
    }
    const nameEl = document.getElementById('teamName');
    if (nameEl) nameEl.textContent = team.name;
    const rankEl = document.getElementById('teamRank');
    if (rankEl) rankEl.textContent = `#${rank}`;
    const ratingEl = document.getElementById('teamRating');
    if (ratingEl) ratingEl.textContent = team.rating; // без округления
    const placeEl = document.getElementById('teamPlace');
    if (placeEl) placeEl.textContent = `#${rank}`;

    const changeEl = document.getElementById('ratingChange');
    if (changeEl) {
      changeEl.textContent = ratingChange5 >= 0 ? `+${ratingChange5}` : `${ratingChange5}`;
      changeEl.className = ratingChange5 >= 0 ? 'text-green-400' : 'text-red-400';
    }

    const totalEl = document.getElementById('totalMatches');
    if (totalEl) totalEl.textContent = totalMatches;
    const wrEl = document.getElementById('winRate');
    if (wrEl) wrEl.textContent = `${winRate}%`;

    // Состав
    const roster = document.getElementById('roster');
    const banner = document.getElementById('playerBanner');
    if (roster) {
      roster.innerHTML = '';
      if (team.players && team.players.length > 0) {
        if (banner) banner.innerHTML = '';
        team.players.forEach(p => {
          // Элемент состава (крупнее)
          const div = document.createElement('div');
          div.className = 'flex items-center justify-between py-2';
          const pr = !isNaN(parseFloat(p.rating)) ? String(parseFloat(p.rating)) : '0.0';
          const img = p.photoUrl ? `<img src="${p.photoUrl}" alt="${p.name}" class="w-14 h-14 rounded object-cover mr-3" onerror="this.style.display='none'">` : '';
          div.innerHTML = `<div class="flex items-center">${img}<span class="text-lg">${p.name}</span></div><span class="text-gray-400">${pr}</span>`;
          roster.appendChild(div);

          // Элемент баннера (очень крупный, как на HLTV)
          if (banner && p.photoUrl) {
            const b = document.createElement('div');
            b.className = 'flex flex-col items-center';
            b.innerHTML = `<img src="${p.photoUrl}" alt="${p.name}" class="h-36 w-auto object-contain" onerror="this.style.display='none'"><span class="text-sm mt-1">${p.name}</span>`;
            banner.appendChild(b);
          }
        });
      } else {
        roster.innerHTML = '<div class="text-gray-400 text-center py-2">Нет данных о составе</div>';
        if (banner) banner.innerHTML = '';
      }
    }

    // История матчей
    const tbody = document.getElementById('historyBody');
    if (tbody) {
      tbody.innerHTML = '';
      if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-400">Нет матчей</td></tr>';
      } else {
        history.forEach(m => {
          const row = document.createElement('tr');
          row.className = 'border-t border-gray-700 hover:bg-gray-700';
          row.innerHTML = `
            <td class="p-2">${m.date || 'N/A'}</td>
            <td class="p-2">${m.opponent || 'N/A'}</td>
            <td class="p-2 ${m.result === 'Win' ? 'text-green-400' : 'text-red-400'}">${m.result === 'Win' ? 'Win' : (m.result === 'Loss' ? 'Loss' : m.result)}</td>
            <td class="p-2">${m.score || 'N/A'}</td>
            <td class="p-2 ${m.ratingChange >= 0 ? 'text-green-400' : 'text-red-400'}">${m.ratingChange >= 0 ? '+' : ''}${m.ratingChange || 0}</td>
          `;
          tbody.appendChild(row);
        });
      }
    }

    // График отключён — удалён код построения, чтобы не нагружать страницу
  } catch (e) {
    console.error('Error rendering team profile:', e);
  }

  if (profileContainer) profileContainer.classList.remove('hidden');
}

async function refreshProfile() {
  await loadAllTeams();
  populateTeamSelect();

  const currentTeam = document.getElementById('teamSelect').value;
  if (currentTeam) {
    showTeamProfile();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing team profile...');
  await loadAllTeams();
  populateTeamSelect();

  const select = document.getElementById('teamSelect');
  if (select) {
    select.addEventListener('change', showTeamProfile);
  }

  // URL ?team=Name
  const urlParams = new URLSearchParams(window.location.search);
  const teamFromUrl = urlParams.get('team');
  if (teamFromUrl) {
    openTeamProfile(teamFromUrl);
  }

  // Автообновление каждые 3 секунды (если видима)
  // Realtime подписка на изменения профиля
  if (window.csApi?.client) {
    window.csApi.client
      .channel('profile-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        if (document.visibilityState === 'visible') refreshProfile();
      })
      .subscribe();
  } else {
    setInterval(() => {
      if (document.visibilityState === 'visible') refreshProfile();
    }, 3000);
  }
});

// делаем функции глобальными
window.openTeamProfile = openTeamProfile;
window.refreshProfile = refreshProfile;
window.showTeamProfile = showTeamProfile;

// debug helper
function debugTeamData() {
    const savedTeams = readSavedTeams();
    console.log('=== DEBUG TEAM DATA ===');
    savedTeams.forEach(team => {
        console.log(`Team: ${team.name}`);
        console.log(`Rating: ${team.rating}`);
        console.log(`History length: ${team.history ? team.history.length : 0}`);
        console.log(team.history);
        console.log('---');
    });
    console.log('=== END DEBUG ===');
}
window.debugTeamData = debugTeamData;
