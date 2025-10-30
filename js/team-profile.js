// team-profile.js - исправленная версия
let allTeams = []; // Локальная версия readSavedTeams, чтобы не зависеть от script.js на этой странице
let editMode = false; // глобальный флаг
let currentAwards = []; // глобальный массив для наград в editMode
let originalTeamName = '';

function readSavedTeams() {
  try {
    const raw = localStorage.getItem('cs_teams');
    const parsed = JSON.parse(raw || '[]');
    return parsed.map(t => ({
      name: t.name,
      logoUrl: t.logoUrl || '',
      players: Array.isArray(t.players) ? t.players : [],
      rating: typeof t.rating === 'number' ? t.rating : 1500,
      history: Array.isArray(t.history) ? t.history : [],
      awards: Array.isArray(t.awards) ? t.awards : []
    }));
  } catch (e) {
    console.error('Error reading teams (profile):', e);
    return [];
  }
}

function writeSavedTeams(teams) {
  try {
    localStorage.setItem('cs_teams', JSON.stringify(teams));
  } catch (e) {
    console.error('Error writing teams (profile):', e);
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
        history: Array.isArray(t.history) ? t.history : [],
        awards: Array.isArray(t.awards) ? t.awards : []
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
  select.innerHTML = '';
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

function renderAwards(team) {
  const container = document.getElementById('awardsList');
  if (!container) return;

  container.innerHTML = '';
  container.className = 'flex flex-wrap gap-6 w-full min-h-[80px] py-2';
  if (!Array.isArray(team.awards) || team.awards.length === 0) {
    container.innerHTML = '<span class="text-gray-400">Нет наград</span>';
    return;
  }
  team.awards.forEach(a => {
    const el = document.createElement('div');
    el.className = 'flex flex-col items-center w-20';
    el.innerHTML = `
      <div class="text-4xl">${a.img ? `<img src='${a.img}' alt='${a.name}' class='w-14 h-14 object-contain'>` : '🏆'}</div>
      <div class="text-xs mt-1">${a.name || ''}</div>
    `;
    container.appendChild(el);
  });
}

function initializeProfileEdit() {
  document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
      // Менее заметный стиль
      editBtn.className = 'ml-1 text-base text-gray-400 hover:text-yellow-400 opacity-50 hover:opacity-90 p-0 border-none shadow-none bg-transparent';
      editBtn.style.background = 'none';
      editBtn.style.border = 'none';
      editBtn.style.outline = 'none';
      editBtn.style.padding = '0';
      editBtn.style.opacity = '0.5';
    }
    const addAwardBtn = document.getElementById('addAwardBtn');
    if (addAwardBtn) addAwardBtn.classList.add('hidden');
    let currentTeam = null;

    if (editBtn) {
      editBtn.onclick = () => {
        if (!editMode) {
          editMode = true;
          showTeamProfile();
        }
      };
    }
    if (addAwardBtn) {
      addAwardBtn.onclick = async () => {
        if (!editMode) return;
        const awardName = prompt('Название награды?');
        if (!awardName) return;
        const imgUrl = prompt('URL изображения кубка (оставьте пустым для 🏆)') || '';
        currentAwards.push({ name: awardName, img: imgUrl });
        renderAwards({ ...currentTeam, awards: currentAwards });
      };
    }
    document.body.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'saveProfileBtn') {
        if (!currentTeam) return;
        const nameInput = document.getElementById('teamNameInput');
        if (nameInput) currentTeam.name = nameInput.value.trim();
        const logoInput = document.getElementById('teamLogoUrlInput');
        if (logoInput) currentTeam.logoUrl = logoInput.value.trim();
        const playerInputs = document.querySelectorAll('.playerNameInput');
        const ratingInputs = document.querySelectorAll('.playerRatingInput');
        if (playerInputs.length === ratingInputs.length && playerInputs.length > 0) {
          let newPlayers = [];
          playerInputs.forEach((inp, i) => {
            const name = inp.value.trim();
            const rating = parseFloat(ratingInputs[i].value.trim() || '0.0');
            const old = (currentTeam.players && currentTeam.players[i]) || {};
            newPlayers.push({ ...old, name, rating });
          });
          currentTeam.players = newPlayers;
        }
        // Awards сохраняем из текущего глобального списка
        currentTeam.awards = currentAwards.slice();
        if (window.csApi) {
          console.log('SAVE AWARDS:', JSON.stringify(currentTeam.awards));
          await window.csApi.upsertTeam(currentTeam);
        } else {
          const saved = await readSavedTeams();
          // Главное: найти команду по старому имени (originalTeamName)
          const idx = saved.findIndex(t => t.name === originalTeamName);
          if (idx !== -1) {
            saved[idx] = currentTeam;
            console.log('SAVE AWARDS:', JSON.stringify(currentTeam.awards));
            await writeSavedTeams(saved);
          }
        }
        // --- Новый фикс: после сохранения всегда загружаем allTeams с актуальными данными
        await loadAllTeams();
        // ... далее отключаем editMode и показываем актуальный профиль по новому имени (если он менялся)
        editMode = false;
        await showTeamProfile();
        alert('Профиль сохранён!');
      }
      if (e.target && e.target.id === 'cancelEditBtn') {
        editMode = false;
        showTeamProfile();
      }
    });
    window._prepProfileEditMode = (team) => {
      // Показываем кнопку +награда, делаем input'ы
      if(addAwardBtn) addAwardBtn.classList.remove('hidden');
      let profileMetaDiv = document.getElementById('profileMetaEdit');
      if (!profileMetaDiv) {
        profileMetaDiv = document.createElement('div');
        profileMetaDiv.id = 'profileMetaEdit';
        profileMetaDiv.className = 'flex gap-2 mb-2';
        const teamDiv = document.getElementById('teamName');
        if(teamDiv && teamDiv.parentNode){
          teamDiv.parentNode.insertBefore(profileMetaDiv, teamDiv.nextSibling);
        }
      }
      profileMetaDiv.innerHTML = `
        <button id="saveProfileBtn" class="bg-green-500 text-white rounded px-3 py-1">Сохранить</button>
        <button id="cancelEditBtn" class="bg-gray-600 text-white rounded px-3 py-1">Отмена</button>
      `;
      originalTeamName = team.name;
      currentTeam = team;
      // Awards: всегда работаем с копией, чтобы не терять изменения
      currentAwards = Array.isArray(team.awards) ? [...team.awards] : [];
      renderAwards({ ...team, awards: currentAwards });
    };
    window._cleanProfileEditMode = () => {
      if(addAwardBtn) addAwardBtn.classList.add('hidden');
      let profileMetaDiv = document.getElementById('profileMetaEdit');
      if (profileMetaDiv) profileMetaDiv.innerHTML = '';
    };
  });
}

initializeProfileEdit();

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
      if (editMode) {
        logoEl.outerHTML = `<input type='url' id='teamLogoUrlInput' value='${team.logoUrl || ''}' class='block mb-2 bg-gray-800 px-2 py-1 rounded w-32' placeholder='Logo URL'>`;
      } else {
        logoEl.src = team.logoUrl || 'https://via.placeholder.com/64';
        logoEl.onerror = function() { this.src = 'https://via.placeholder.com/64'; };
      }
    }
    const nameEl = document.getElementById('teamName');
    if (nameEl) {
      if (editMode) {
        nameEl.innerHTML = `<input type='text' id='teamNameInput' value='${team.name || ''}' class='bg-gray-800 px-2 py-1 rounded'>`;
        document.getElementById('editProfileBtn').style.display = 'none';
        window._prepProfileEditMode(team);
      } else {
        nameEl.textContent = team.name;
        document.getElementById('editProfileBtn').style.display = 'inline';
        window._cleanProfileEditMode();
      }
    }
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
        team.players.forEach((p, idx) => {
          // В режиме edit inputы, иначе как раньше
          if (editMode) {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 py-2';
            const prVal = !isNaN(parseFloat(p.rating)) ? String(parseFloat(p.rating)) : '0.0';
            const img = p.photoUrl ? `<img src="${p.photoUrl}" class="w-8 h-8 rounded mr-2" alt="${p.name}">` : '';
            div.innerHTML = `
              <div class='flex items-center'>${img} <input type='text' value='${p.name || ''}' class='playerNameInput bg-gray-800 px-2 py-1 rounded' style='width:90px;'> </div>
              <input type='number' value='${prVal}' step='0.01' class='playerRatingInput bg-gray-800 px-2 py-1 rounded' style='width:60px;'>
            `;
            roster.appendChild(div);
          } else {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between py-2';
            const pr = !isNaN(parseFloat(p.rating)) ? String(parseFloat(p.rating)) : '0.0';
            const img = p.photoUrl ? `<img src="${p.photoUrl}" class="w-8 h-8 rounded mr-2" alt="${p.name}">` : '';
            div.innerHTML = `
              <div class="flex items-center">${img} ${p.name}</div>
              <span>${pr}</span>
            `;
            roster.appendChild(div);
          }
          // Элемент баннера (очень крупный, как на HLTV)
          if (banner && p.photoUrl) {
            const b = document.createElement('div');
            b.className = 'flex flex-col items-center';
            b.innerHTML = `
              <img src="${p.photoUrl}" class="w-32 h-32 rounded" alt="${p.name}">
              <span>${p.name}</span>
            `;
            banner.appendChild(b);
          }
        });
      } else {
        roster.innerHTML = '<p class="text-gray-500">Нет данных о составе</p>';
        if (banner) banner.innerHTML = '';
      }
    }
    // История матчей
    const tbody = document.getElementById('historyBody');
    if (tbody) {
      tbody.innerHTML = '';
      if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-2 text-center">Нет матчей</td></tr>';
      } else {
        history.forEach(m => {
          const row = document.createElement('tr');
          row.className = 'border-t border-gray-700 hover:bg-gray-700';
          const changeColor = m.ratingChange >= 0 ? 'text-green-400' : 'text-red-400';
          row.innerHTML = `
            <td class="p-2">${m.date || 'N/A'}</td>
            <td class="p-2">${m.opponent || 'N/A'}</td>
            <td class="p-2">${m.result === 'Win' ? 'Win' : (m.result === 'Loss' ? 'Loss' : m.result)}</td>
            <td class="p-2">${m.score || 'N/A'}</td>
            <td class="p-2 ${changeColor}">${m.ratingChange >= 0 ? '+' : ''}${m.ratingChange || 0}</td>
          `;
          tbody.appendChild(row);
        });
      }
    }
    // Новый график
    buildRankingChart(team);
    renderAwards(team);
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

// Новая функция для графика
function buildRankingChart(team) {
  const ctx = document.getElementById('rankingChart')?.getContext('2d');
  if (!ctx) return;

  if (window._rankingChart) {
    window._rankingChart.destroy();
    window._rankingChart = null;
  }

  // Берём только реальные значения rank из истории команды
  const historyArr = (Array.isArray(team.history) ? team.history : []).slice().sort((a, b) => {
    // сортировка по дате (по возрастанию)
    return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
  });

  // Формируем массивы для графика только с теми матчами, у которых rank !== undefined/null
  const labels = [];
  const ranks = [];
  historyArr.forEach((m, idx) => {
    if (m.rank !== undefined && m.rank !== null) {
      labels.push(m.date ? `${idx + 1}` : `Матч ${idx + 1}`); // либо номер или дата
      ranks.push(m.rank);
    }
  });

  if (ranks.length === 0) {
    // Нет реальных данных для графика
    window._rankingChart = new Chart(ctx, {
      type: 'line',
      data: { labels: ['Нет данных'], datasets: [{ label: 'Нет данных о ранге', data: [null], borderColor: 'gray' }] },
      options: { plugins: { legend: { display: false } },
                 scales: { y: { reverse: true, min: 1, title: { display: true, text: 'Место в рейтинге' } }, x: { title: { display: true, text: 'Игра (матч)' } } },
                 elements: { point: { radius: 0 } }
      }
    });
    const peakEl = document.getElementById('peakInfo');
    if (peakEl) peakEl.textContent = `Нет сохранённой истории позиций команды.`;
    return;
  }

  // Расчёт пика
  const peakRank = Math.min(...ranks);
  let totalPeak = 0;
  let onPeak = false;
  for (let r of ranks) {
    if (r === peakRank) {
      totalPeak++;
      onPeak = true;
    } else {
      onPeak = false;
    }
  }
  // Обновляем инфо о пике
  const peakEl = document.getElementById('peakInfo');
  if (peakEl) peakEl.textContent = `Пик: #${peakRank} (на пике: ${totalPeak} игр)`;

  // Финальная точка (текущее место) можно тоже взять из последнего ранка
  // если хочешь выделять — дополни здесь!

  window._rankingChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Позиция в рейтинге',
        data: ranks,
        borderColor: 'orange',
        backgroundColor: 'rgba(255,140,0,0.2)',
        tension: 0,
        fill: false,
        pointRadius: 3,
        pointBackgroundColor: 'orange',
      }]
    },
    options: {
      scales: {
        y: {
          reverse: true,
          min: 1,
          max: Math.max(...ranks),
          title: { display: true, text: 'Место в рейтинге' }
        },
        x: {
          title: { display: true, text: 'Игра (матч)' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}
