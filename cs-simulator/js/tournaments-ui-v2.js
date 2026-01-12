/**
 * Tournaments UI v2 - Clean and Simple
 */

let allTeamsUI = [];

async function initTournamentsUI() {
  console.log('🚀 Initializing Tournaments UI...');

  // Load teams first
  await tournamentManagerV2.loadTeams();
  allTeamsUI = tournamentManagerV2.allTeams;
  console.log(`✅ Loaded ${allTeamsUI.length} teams`);

  // Load tournaments
  tournamentManagerV2.loadTournaments();
  console.log(`✅ Loaded ${tournamentManagerV2.tournaments.length} tournaments`);

  // Setup UI
  setupEventListeners();
  renderTournamentsList();
  populateTeamsCheckboxes();

  // Process any pending reported match result (from main screen)
  processPendingMatchResult();

  // Listen for storage events (other tab reported a match)
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'last_played_match_result' || ev.key === 'pending_match_result') {
      processPendingMatchResult();
    }
  });
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Create tournament button
  const createBtn = document.getElementById('createTournamentBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      document.getElementById('createTournamentModal').classList.remove('hidden');
    });
  }

  // Cancel button
  const cancelBtn = document.getElementById('cancelCreateBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      document.getElementById('createTournamentModal').classList.add('hidden');
      document.getElementById('createTournamentForm').reset();
    });
  }

  // Form submission
  const form = document.getElementById('createTournamentForm');
  if (form) {
    form.addEventListener('submit', handleCreateTournament);
  }

  // Group stage format change
  const formatSelect = document.getElementById('groupStageFormat');
  if (formatSelect) {
    formatSelect.addEventListener('change', (e) => {
      const roundsContainer = document.getElementById('roundsContainer');
      const groupsContainer = document.getElementById('groupsCountContainer');

      if (e.target.value === 'round-robin') {
        roundsContainer?.classList.remove('hidden');
        groupsContainer?.classList.add('hidden');
      } else if (e.target.value === 'double') {
        groupsContainer?.classList.remove('hidden');
        roundsContainer?.classList.add('hidden');
      } else {
        roundsContainer?.classList.add('hidden');
        groupsContainer?.classList.add('hidden');
      }
    });
  }

  // Tournament tabs
  const groupTab = document.getElementById('groupStageTab');
  const playoffTab = document.getElementById('playoffTab');

  if (groupTab) {
    groupTab.addEventListener('click', () => showGroupStage());
  }
  if (playoffTab) {
    playoffTab.addEventListener('click', () => showPlayoff());
  }

  // Close tournament modal
  const closeBtns = document.querySelectorAll('#closeTournamentViewBtn, #closeTournamentBtn');
  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => closeTournamentModal());
  });

  // Delete tournament
  const deleteBtn = document.getElementById('deleteTournamentBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', handleDeleteTournament);
  }
}

/**
 * Populate teams checkboxes
 */
function populateTeamsCheckboxes() {
  const container = document.getElementById('teamsSelection');
  if (!container) return;

  if (allTeamsUI.length === 0) {
    container.innerHTML = '<p class="text-gray-400">Нет команд. Создайте команду сначала!</p>';
    return;
  }

  container.innerHTML = allTeamsUI.map(team => `
    <label class="flex items-center gap-3 p-3 hover:bg-gray-600 rounded-lg cursor-pointer">
      <input type="checkbox" value="${team.id}" class="team-checkbox w-4 h-4">
      <img src="${team.logoUrl || 'https://via.placeholder.com/32'}" alt="${team.name}" class="w-6 h-6 rounded">
      <span>${team.name}</span>
    </label>
  `).join('');

  // Add change listeners
  document.querySelectorAll('.team-checkbox').forEach(cb => {
    cb.addEventListener('change', updateTeamsCount);
  });

  updateTeamsCount();
}

/**
 * Update selected teams count
 */
function updateTeamsCount() {
  const count = document.querySelectorAll('.team-checkbox:checked').length;
  const counter = document.getElementById('selectedTeamsCount');
  if (counter) {
    counter.textContent = count;
  }
}

/**
 * Get selected team IDs
 */
function getSelectedTeamIds() {
  const checkboxes = document.querySelectorAll('.team-checkbox:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Handle create tournament
 */
async function handleCreateTournament(e) {
  e.preventDefault();

  const name = document.getElementById('tournamentName').value.trim();
  const teamIds = getSelectedTeamIds();
  const groupFormat = document.getElementById('groupStageFormat').value;
  const groupsCount = parseInt(document.getElementById('groupsCount').value) || 1;
  const groupRounds = parseInt(document.getElementById('groupRounds').value) || 1;
  const playoffTeams = document.getElementById('playoffTeams').value;
  const playoffFormat = document.getElementById('playoffFormat').value;

  console.log('Creating tournament with data:', {
    name, 
    teamIds, 
    groupFormat, 
    groupsCount, 
    groupRounds, 
    playoffTeams, 
    playoffFormat
  });

  // Validation
  if (!name) {
    alert('Введите название турнира!');
    return;
  }

  if (teamIds.length < 4) {
    alert('Выберите минимум 4 команды!');
    return;
  }

  try {
    // Проверяем, что команды существуют
    const teams = tournamentManagerV2.allTeams.filter(t => teamIds.includes(t.id));
    if (teams.length !== teamIds.length) {
      console.error('Some teams not found:', {
        requested: teamIds,
        found: teams.map(t => t.id)
      });
      alert('Ошибка: некоторые выбранные команды не найдены. Пожалуйста, обновите страницу и попробуйте снова.');
      return;
    }

    console.log('Teams found for tournament:', teams);

    const tournament = tournamentManagerV2.createTournament({
      name,
      teamIds,
      groupStageFormat: groupFormat,
      groupsCount: groupsCount,
      groupRounds: groupRounds,
      playoffFormat: playoffFormat,
      playoffTeams: playoffTeams
    });

    if (!tournament || !tournament.id) {
      throw new Error('Не удалось создать турнир: пустой ответ от сервера');
    }

    // Сохраняем турниры в хранилище
    tournamentManagerV2.saveTournaments();
    console.log('Tournament created successfully:', tournament);
    console.log('All tournament IDs after create:', tournamentManagerV2.tournaments.map(t => t.id));
    try {
      sessionStorage.setItem('last_created_tournament', JSON.stringify({ id: tournament.id, createdAt: Date.now(), tournament }));
      console.log('Saved last_created_tournament to sessionStorage');
    } catch (e) {
      console.warn('Could not save last_created_tournament to sessionStorage:', e);
    }

    // Обновляем UI
    document.getElementById('createTournamentModal').classList.add('hidden');
    document.getElementById('createTournamentForm').reset();
    updateTeamsCount();
    renderTournamentsList();

    // Даем время на обновление UI перед редиректом
    setTimeout(() => {
      try {
        console.log('Redirecting to tournament:', tournament.id);
        openTournament(tournament.id);
      } catch (e) {
        console.error('Error in openTournament:', e);
        // Показываем кнопку для перехода вручную
        const manualLink = `tournament-view.html?id=${tournament.id}`;
        alert(`Турнир создан, но произошла ошибка при перенаправлении. Перейдите по ссылке вручную: ${manualLink}`);
      }
    }, 100);
    
  } catch (error) {
    console.error('Error creating tournament:', error);
    const errorMessage = error.message || 'Неизвестная ошибка';
    alert(`❌ Ошибка при создании турнира: ${errorMessage}`);
  }
}

/**
 * Render tournaments list
 */
function renderTournamentsList() {
  const container = document.getElementById('tournamentsContainer');
  
  if (!container) {
    console.error('❌ Элемент с ID "tournamentsContainer" не найден на странице');
    return;
  }

  try {
    if (!tournamentManagerV2 || !Array.isArray(tournamentManagerV2.tournaments)) {
      console.error('❌ Не удалось загрузить список турниров:', tournamentManagerV2);
      container.innerHTML = '<div class="bg-red-900 p-4 rounded text-white">Ошибка загрузки списка турниров. Пожалуйста, обновите страницу.</div>';
      return;
    }

    if (tournamentManagerV2.tournaments.length === 0) {
      container.innerHTML = '<div class="bg-gray-800 rounded-lg p-8 text-center text-gray-400">Турниров нет. Создайте новый турнир!</div>';
      return;
    }

    const html = tournamentManagerV2.tournaments.map(t => {
      try {
        return `
          <div class="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 cursor-pointer transition" onclick="openTournament('${t.id}')">
            <h3 class="text-xl font-bold mb-4">${t.name || 'Без названия'}</h3>
            <div class="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p class="text-gray-400">Команд</p>
                <p class="text-xl font-bold">${t.teams ? t.teams.length : 0}</p>
              </div>
              <div>
                <p class="text-gray-400">Групповая</p>
                <p class="text-lg">${t.groupStageFormat === 'none' ? '✗ Нет' : t.groupStageFormat || 'Не указано'}</p>
              </div>
              <div>
                <p class="text-gray-400">Плей-офф</p>
                <p class="text-lg">${t.playoffFormat || 'Не указано'}</p>
              </div>
              <div>
                <p class="text-gray-400">Статус</p>
                <p class="text-lg ${t.completed ? 'text-green-400' : 'text-yellow-400'}">${t.completed ? '✓ Завершен' : '● Активен'}</p>
              </div>
            </div>
          </div>
        `;
      } catch (e) {
        console.error('Ошибка при рендеринге турнира:', t, e);
        return ''; // Пропускаем битый турнир
      }
    }).join('');

    container.innerHTML = html;
  } catch (e) {
    console.error('Критическая ошибка при отображении турниров:', e);
    container.innerHTML = `
      <div class="bg-red-900 p-4 rounded text-white">
        <p>Произошла ошибка при загрузке турниров:</p>
        <p class="text-sm mt-2">${e.message || 'Неизвестная ошибка'}</p>
        <button onclick="window.location.reload()" class="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
          Обновить страницу
        </button>
      </div>
    `;
  }
}

/**
 * Open tournament
 */
function openTournament(tournamentId) {
  console.log('Looking for tournament ID:', tournamentId);
  
  // Проверяем, что tournamentManagerV2 инициализирован
  if (!tournamentManagerV2) {
    console.error('Tournament manager is not initialized');
    window.location.href = `tournament-view.html?id=${encodeURIComponent(tournamentId)}`;
    return;
  }

  // Try to find tournament in memory
  let tournament = tournamentManagerV2.tournaments.find(t => t.id === tournamentId);

  // If not found, reload tournaments from storage and try again
  if (!tournament) {
    console.warn(`Tournament with ID ${tournamentId} not found in memory — reloading from storage and retrying`);
    try {
      tournamentManagerV2.loadTournaments();
      tournament = tournamentManagerV2.tournaments.find(t => t.id === tournamentId || String(t.id) === String(tournamentId) || String(t.id) === String(Number(tournamentId)));
      console.log('Tournament IDs after reload:', tournamentManagerV2.tournaments.map(t => t.id));
    } catch (e) {
      console.error('Error reloading tournaments:', e);
    }
  }

  if (!tournament) {
    console.warn(`Tournament with ID ${tournamentId} still not found`);

    // If tournaments exist, redirect to first but inform user
    if (tournamentManagerV2.tournaments.length > 0) {
      const firstTournamentId = tournamentManagerV2.tournaments[0].id;
      console.log(`Redirecting to first available tournament: ${firstTournamentId}`);
      window.location.href = `tournament-view.html?id=${encodeURIComponent(firstTournamentId)}`;
      return;
    }

    alert('Турнир не найден. Пожалуйста, создайте новый турнир.');
    return;
  }

  // If tournament found, redirect to its page
  window.location.href = `tournament-view.html?id=${encodeURIComponent(tournamentId)}`;
}

/**
 * Close tournament modal
 */
function closeTournamentModal() {
  document.getElementById('viewTournamentModal').classList.add('hidden');
  tournamentManagerV2.currentTournament = null;
}

/**
 * Show group stage
 */
function showGroupStage() {
  const tournament = tournamentManagerV2.currentTournament;
  if (!tournament || !tournament.groupStage) {
    document.getElementById('groupsContainer').innerHTML = '<p class="text-gray-400">Групповая стадия отсутствует</p>';
    return;
  }

  // Update tabs
  document.getElementById('groupStageTab').classList.remove('bg-gray-700');
  document.getElementById('groupStageTab').classList.add('bg-blue-600');
  document.getElementById('playoffTab').classList.remove('bg-blue-600');
  document.getElementById('playoffTab').classList.add('bg-gray-700');

  document.getElementById('groupStageContent').classList.remove('hidden');
  document.getElementById('playoffContent').classList.add('hidden');

  renderGroupStage(tournament);
}

/**
 * Render group stage
 */
function renderGroupStage(tournament) {
  const container = document.getElementById('groupsContainer');
  if (!tournament.groupStage) {
    container.innerHTML = '<p class="text-gray-400">Групповая стадия отсутствует</p>';
    return;
  }

  console.log('Rendering group stage:', tournament.groupStage);
  console.log('Tournament teams:', tournament.teams);

  let html = '';

  if (tournament.groupStageFormat === 'double') {
    // Double elimination with groups
    const groups = tournament.groupStage.groups || [];
    if (groups.length === 0) {
      container.innerHTML = '<p class="text-red-400">Ошибка: нет групп!</p>';
      return;
    }

    html = '<div class="space-y-8">';

    groups.forEach(group => {
      html += `<div class="bg-gray-700/50 rounded-lg p-4 border border-gray-600">`;
      html += `<h3 class="text-lg font-bold mb-6">📋 Группа ${group.number}</h3>`;

      // Winners bracket
      html += `<div class="mb-6">`;
      html += `<h4 class="font-bold mb-3">👑 Верхняя сетка</h4>`;
      html += renderBracket(tournament, group.winnersBracket);
      html += `</div>`;

      // Losers bracket
      html += `<div>`;
      html += `<h4 class="font-bold mb-3">💀 Нижняя сетка</h4>`;
      html += renderBracket(tournament, group.losersBracket);
      html += `</div>`;

      html += `</div>`;
    });

    html += '</div>';
  } else if (tournament.groupStageFormat === 'swiss' || tournament.groupStageFormat === 'round-robin') {
    // Standings table
    const standings = tournament.groupStage.standings || [];

    html += `<div class="bg-gray-700/50 rounded-lg p-4">`;
    html += `<h3 class="text-lg font-bold mb-4">📊 Таблица стендинга</h3>`;
    html += `<table class="w-full text-sm">`;
    html += `<thead><tr class="border-b border-gray-600">`;
    html += `<th class="px-4 py-2 text-left">#</th>`;
    html += `<th class="px-4 py-2 text-left">Команда</th>`;
    html += `<th class="px-4 py-2 text-center">М</th>`;
    html += `<th class="px-4 py-2 text-center">В</th>`;
    html += `<th class="px-4 py-2 text-center">П</th>`;
    html += `<th class="px-4 py-2 text-center">Очки</th>`;
    html += `</tr></thead>`;
    html += `<tbody>`;

    standings
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .forEach((standing, idx) => {
        const team = tournament.teams.find(t => t.id === standing.teamId);
        const teamName = team ? team.name : 'Unknown';
        const logoUrl = team ? team.logoUrl : '';

        html += `<tr class="border-b border-gray-600 hover:bg-gray-600/30">`;
        html += `<td class="px-4 py-2 font-bold">${idx + 1}</td>`;
        html += `<td class="px-4 py-2 flex items-center gap-2">`;
        html += `<img src="${logoUrl || 'https://via.placeholder.com/24'}" alt="${teamName}" class="w-5 h-5 rounded">`;
        html += `<span>${teamName}</span>`;
        html += `</td>`;
        html += `<td class="px-4 py-2 text-center">${standing.matchesPlayed || 0}</td>`;
        html += `<td class="px-4 py-2 text-center text-green-400">${standing.wins || 0}</td>`;
        html += `<td class="px-4 py-2 text-center text-red-400">${standing.losses || 0}</td>`;
        html += `<td class="px-4 py-2 text-center font-bold">${standing.points || 0}</td>`;
        html += `</tr>`;
      });

    html += `</tbody></table>`;
    html += `</div>`;
  }

  container.innerHTML = html;
}

/**
 * Render bracket (winners or losers)
 */
function renderBracket(tournament, bracket) {
  if (!bracket || !bracket.rounds) {
    return '<p class="text-gray-400 text-sm">Матчи не сгенерированы</p>';
  }

  let html = '<div class="space-y-4">';

  bracket.rounds.forEach(round => {
    html += `<div class="bg-gray-600/30 rounded-lg p-3">`;
    html += `<h5 class="font-semibold mb-2 text-sm">Раунд ${round.number}</h5>`;

    if (round.matches.length === 0) {
      html += '<p class="text-gray-400 text-xs">Матчи не созданы</p>';
    } else {
      round.matches.forEach(match => {
        const team1 = tournament.teams.find(t => t.id === match.team1Id);
        const team2 = tournament.teams.find(t => t.id === match.team2Id);

        const t1Name = team1 ? team1.name : 'Unknown';
        const t2Name = team2 ? team2.name : 'Unknown';
        const t1Logo = team1 ? team1.logoUrl : '';
        const t2Logo = team2 ? team2.logoUrl : '';

        html += `<div class="flex items-center gap-2 p-2 bg-gray-500/20 rounded text-xs">`;
        html += `<img src="${t1Logo || 'https://via.placeholder.com/16'}" alt="${t1Name}" class="w-4 h-4 rounded">`;
        html += `<span class="flex-1 truncate">${t1Name}</span>`;
        html += `<span class="text-gray-400">vs</span>`;
        html += `<span class="flex-1 text-right truncate">${t2Name}</span>`;
        html += `<img src="${t2Logo || 'https://via.placeholder.com/16'}" alt="${t2Name}" class="w-4 h-4 rounded">`;
        html += `</div>`;
      });
    }

    html += `</div>`;
  });

  html += '</div>';
  return html;
}

/**
 * Show playoff
 */
function showPlayoff() {
  const tournament = tournamentManagerV2.currentTournament;
  if (!tournament || !tournament.playoff) {
    document.getElementById('bracketContainer').innerHTML = '<p class="text-gray-400">Плей-офф отсутствует</p>';
    return;
  }

  // Update tabs
  document.getElementById('playoffTab').classList.remove('bg-gray-700');
  document.getElementById('playoffTab').classList.add('bg-blue-600');
  document.getElementById('groupStageTab').classList.remove('bg-blue-600');
  document.getElementById('groupStageTab').classList.add('bg-gray-700');

  document.getElementById('groupStageContent').classList.add('hidden');
  document.getElementById('playoffContent').classList.remove('hidden');

  const container = document.getElementById('bracketContainer');
  // Render the playoff bracket and attach handlers
  container.innerHTML = renderPlayoffV2(tournament);

  // Attach click handlers for matches
  container.querySelectorAll('.playoff-match').forEach(el => {
    el.addEventListener('click', () => {
      const team1Id = el.getAttribute('data-team1');
      const team2Id = el.getAttribute('data-team2');
      const matchId = el.getAttribute('data-match');
      openMatchPreview(team1Id, team2Id, tournament.id, matchId);
    });
  });
}

/**
 * Render a beautiful playoff bracket matching the design reference
 */
function renderPlayoffV2(tournament) {
  const p = tournament.playoff;
  if (!p) return '<p class="text-gray-400">Плей-офф: отсутствует</p>';

  let html = '';
  html += `<h3 class="text-2xl font-bold mb-8">🏆 Плей-офф — ${p.type === 'single' ? 'Single Elimination' : 'Double Elimination'}</h3>`;

  if (p.type === 'single') {
    html += renderSingleElimBracket(tournament);
  } else if (p.type === 'double') {
    html += renderDoubleElimBracket(tournament);
  }

  return html;
}

function renderSingleElimBracket(tournament) {
  if (!tournament.playoff || !tournament.playoff.rounds) {
    return '<p class="text-gray-400">❌ Раунды плей-офф не найдены</p>';
  }
  const rounds = tournament.playoff.rounds || [];
  if (rounds.length === 0) return '<p class="text-gray-400">Нет раундов</p>';

  let html = '<div class="space-y-6">';

  rounds.forEach((round, roundIdx) => {
    const isLast = roundIdx === rounds.length - 1;
    const title = isLast ? '🏆 ФИНАЛ' : `⚔️ ${roundIdx === 0 ? 'Четвертьфиналы' : roundIdx === 1 ? 'Полуфиналы' : `Раунд ${round.number}`}`;

    html += `<div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">`;
    html += `<h4 class="font-bold text-lg mb-4">${title}</h4>`;
    html += `<div class="space-y-3">`;

    (round.matches || []).forEach(m => {
      const t1 = tournamentManagerV2.getTeamById(m.team1Id);
      const t2 = m.team2Id ? tournamentManagerV2.getTeamById(m.team2Id) : null;

      const t1Name = t1?.name || 'TBD';
      const t2Name = t2?.name || 'TBD';
      const completed = m.completed;
      const winner = m.winner;

      html += `
        <div class="bg-gray-700/60 hover:bg-gray-700/80 transition rounded-lg overflow-hidden playoff-match cursor-pointer" data-match="${m.id}" data-team1="${m.team1Id}" data-team2="${m.team2Id || ''}">
          <div class="flex items-stretch">
            <!-- Team 1 -->
            <div class="flex-1 flex items-center gap-3 p-4 ${winner === m.team1Id ? 'bg-green-900/30 border-l-4 border-green-500' : completed ? 'bg-red-900/20' : ''}">
              <img src="${t1?.logoUrl || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded border border-gray-600">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-white truncate">${t1Name}</div>
                <div class="text-xs text-gray-400">${t1?.players?.length || 0} игроков</div>
              </div>
              ${completed ? `<div class="text-xl font-bold ${winner === m.team1Id ? 'text-green-400' : 'text-gray-500'}">${m.team1Score ?? '—'}</div>` : '<div class="text-gray-500">vs</div>'}
            </div>

            <!-- Divider -->
            <div class="w-px bg-gray-600"></div>

            <!-- Team 2 -->
            <div class="flex-1 flex items-center gap-3 p-4 ${winner === m.team2Id ? 'bg-green-900/30 border-r-4 border-green-500' : completed ? 'bg-red-900/20' : ''}">
              ${completed ? `<div class="text-xl font-bold ${winner === m.team2Id ? 'text-green-400' : 'text-gray-500'}">${m.team2Score ?? '—'}</div>` : ''}
              <div class="flex-1 text-right min-w-0">
                <div class="font-semibold text-white truncate">${t2Name}</div>
                <div class="text-xs text-gray-400">${t2?.players?.length || 0} игроков</div>
              </div>
              <img src="${t2?.logoUrl || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded border border-gray-600">
            </div>
          </div>
        </div>
      `;
    });

    html += '</div></div>';
  });

  html += '</div>';
  return html;
}

function renderDoubleElimBracket(tournament) {
  const p = tournament.playoff;
  if (!p) {
    return '<p class="text-gray-400">❌ Плей-офф не инициализирован</p>';
  }

  let html = '<div class="grid grid-cols-3 gap-6">';

  // Winners Bracket
  html += '<div>';
  html += '<h4 class="font-bold text-lg mb-4 text-blue-400">👑 Верхняя сетка (Winners)</h4>';
  (p.winnersBracket?.rounds || []).forEach((round, idx) => {
    const title = idx === 0 ? 'Четвертьфиналы' : idx === 1 ? 'Полуфиналы' : `Раунд ${idx}`;
    html += `<div class="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mb-4">`;
    html += `<h5 class="text-sm font-semibold mb-3 text-blue-300">${title}</h5>`;
    (round.matches || []).forEach(m => {
      const t1 = tournamentManagerV2.getTeamById(m.team1Id);
      const t2 = m.team2Id ? tournamentManagerV2.getTeamById(m.team2Id) : null;
      html += `
        <div class="bg-gray-700/40 hover:bg-gray-700/60 p-2 rounded mb-2 playoff-match cursor-pointer" data-match="${m.id}" data-team1="${m.team1Id}" data-team2="${m.team2Id || ''}">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <img src="${t1?.logoUrl || 'https://via.placeholder.com/28'}" class="w-7 h-7 rounded">
              <span class="text-sm font-semibold truncate">${t1?.name || 'TBD'}</span>
            </div>
            ${m.completed ? `<span class="text-sm font-bold text-green-400">${m.team1Score}</span>` : ''}
          </div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <img src="${t2?.logoUrl || 'https://via.placeholder.com/28'}" class="w-7 h-7 rounded">
              <span class="text-sm font-semibold truncate">${t2?.name || 'TBD'}</span>
            </div>
            ${m.completed ? `<span class="text-sm font-bold text-green-400">${m.team2Score}</span>` : ''}
          </div>
        </div>
      `;
    });
    html += '</div>';
  });
  html += '</div>';

  // Losers Bracket
  html += '<div>';
  html += '<h4 class="font-bold text-lg mb-4 text-red-400">💀 Нижняя сетка (Losers)</h4>';
  (p.losersBracket?.rounds || []).forEach((round, idx) => {
    const title = `Раунд ${idx + 1}`;
    html += `<div class="bg-red-900/20 border border-red-700/30 rounded-lg p-4 mb-4">`;
    html += `<h5 class="text-sm font-semibold mb-3 text-red-300">${title}</h5>`;
    (round.matches || []).forEach(m => {
      const t1 = tournamentManagerV2.getTeamById(m.team1Id);
      const t2 = m.team2Id ? tournamentManagerV2.getTeamById(m.team2Id) : null;
      html += `
        <div class="bg-gray-700/40 hover:bg-gray-700/60 p-2 rounded mb-2 playoff-match cursor-pointer" data-match="${m.id}" data-team1="${m.team1Id}" data-team2="${m.team2Id || ''}">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <img src="${t1?.logoUrl || 'https://via.placeholder.com/28'}" class="w-7 h-7 rounded">
              <span class="text-sm font-semibold truncate">${t1?.name || 'TBD'}</span>
            </div>
            ${m.completed ? `<span class="text-sm font-bold text-green-400">${m.team1Score}</span>` : ''}
          </div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <img src="${t2?.logoUrl || 'https://via.placeholder.com/28'}" class="w-7 h-7 rounded">
              <span class="text-sm font-semibold truncate">${t2?.name || 'TBD'}</span>
            </div>
            ${m.completed ? `<span class="text-sm font-bold text-green-400">${m.team2Score}</span>` : ''}
          </div>
        </div>
      `;
    });
    html += '</div>';
  });
  html += '</div>';

  // Grand Final
  html += '<div>';
  html += '<h4 class="font-bold text-lg mb-4 text-yellow-400">🏆 Финал</h4>';
  const gf = p.grand || {};
  const t1 = tournamentManagerV2.getTeamById(gf.team1Id);
  const t2 = tournamentManagerV2.getTeamById(gf.team2Id);
  html += `
    <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-4">
      <div class="bg-gray-700/60 p-3 rounded mb-2 playoff-match cursor-pointer" data-match="${gf.id || 'grand'}" data-team1="${gf.team1Id || ''}" data-team2="${gf.team2Id || ''}">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <img src="${t1?.logoUrl || 'https://via.placeholder.com/32'}" class="w-8 h-8 rounded">
            <span class="font-semibold">${t1?.name || '—'}</span>
          </div>
          ${gf.completed ? `<span class="text-lg font-bold text-yellow-400">${gf.team1Score}</span>` : ''}
        </div>
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <img src="${t2?.logoUrl || 'https://via.placeholder.com/32'}" class="w-8 h-8 rounded">
            <span class="font-semibold">${t2?.name || '—'}</span>
          </div>
          ${gf.completed ? `<span class="text-lg font-bold text-yellow-400">${gf.team2Score}</span>` : ''}
        </div>
      </div>
    </div>
  `;
  html += '</div>';

  html += '</div>';
  return html;
}

/**
 * Open pre-match preview modal with simple chance calculations and stats
 */
function openMatchPreview(team1Id, team2Id, tournamentId, matchId) {
  const team1 = tournamentManagerV2.getTeamById(team1Id);
  const team2 = team2Id ? tournamentManagerV2.getTeamById(team2Id) : null;

  let modal = document.getElementById('matchPreviewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'matchPreviewModal';
    modal.className = 'fixed inset-0 flex items-center justify-center z-50 overflow-y-auto';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.innerHTML = `
      <div class="bg-gray-900 rounded-lg w-11/12 max-w-4xl p-6 text-white my-4">
        <div id="matchPreviewContent"></div>
        <div class="mt-4 flex gap-3 justify-end">
          <button id="matchPreviewPlay" class="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-semibold">Играть</button>
          <button id="matchPreviewClose" class="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded">Закрыть</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('matchPreviewClose').addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }
  modal.classList.remove('hidden');

  const content = document.getElementById('matchPreviewContent');
  const t1Name = team1?.name || 'Unknown';
  const t2Name = team2?.name || '—';

  const winChances = tournamentManagerV2.calculateWinChance(team1Id, team2Id);
  const history = tournamentManagerV2.getMatchHistory(team1Id, team2Id) || [];

  const getAvgRating = (team) => {
    if (!team?.players?.length) return 1500;
    return Math.round(team.players.reduce((s,p)=>s+(typeof p.rating==='number'?p.rating:1500),0)/team.players.length);
  };

  const r1 = getAvgRating(team1);
  const r2 = getAvgRating(team2);

  // Build player comparison table
  let playersHtml = '<div class="grid grid-cols-2 gap-4 mt-4">';
  const maxPlayers = Math.max((team1?.players?.length || 0), (team2?.players?.length || 0));
  for (let i = 0; i < maxPlayers; i++) {
    const p1 = team1?.players?.[i];
    const p2 = team2?.players?.[i];
    playersHtml += `
      <div class="flex items-center gap-2">
        <div class="flex-1 bg-gray-800 rounded p-2">
          <div class="text-sm font-semibold">${p1?.name || '—'}</div>
          <div class="text-xs text-gray-400">Рейтинг: ${p1?.rating ?? '—'}</div>
        </div>
        <div class="text-center text-sm text-gray-500">⚔️</div>
        <div class="flex-1 bg-gray-800 rounded p-2 text-right">
          <div class="text-sm font-semibold">${p2?.name || '—'}</div>
          <div class="text-xs text-gray-400">Рейтинг: ${p2?.rating ?? '—'}</div>
        </div>
      </div>
    `;
  }
  playersHtml += '</div>';

  // Отображение истории матчей
  let historyHtml = '';
  if (!history || history.length === 0) {
    // Если истории нет
    historyHtml = `
      <div class="p-4 bg-gray-800 rounded-lg text-center border border-gray-700">
        <div class="text-yellow-400 text-2xl mb-2">ℹ️</div>
        <div class="text-gray-300 font-medium">История встреч отсутствует</div>
        <div class="text-sm text-gray-500 mt-1">Здесь будут отображаться предыдущие матчи</div>
      </div>`;
  } else {
    // Если есть история матчей
    historyHtml = `
    <div class="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
      <div class="px-4 py-3 bg-gray-700 text-gray-200 font-medium">
        <div class="flex items-center justify-between">
          <span>История встреч</span>
          <span class="text-xs bg-gray-600 text-gray-200 px-2 py-1 rounded-full">${history.length} матчей</span>
        </div>
      </div>
      <div class="divide-y divide-gray-700">`;
    
    // Сортируем матчи по дате (новые сверху)
    const sortedHistory = [...history].sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA;
    });
    
    // Берем последние 5 матчей
    sortedHistory.slice(0, 5).forEach((match, idx) => {
      try {
        const when = match.date ? new Date(match.date).toLocaleDateString('ru-RU') : 'Дата неизвестна';
        const isTeam1Winner = match.winnerId === team1Id;
        const isTeam2Winner = match.winnerId === team2Id;
        const winnerName = isTeam1Winner ? team1?.name : (isTeam2Winner ? team2?.name : 'Ничья');
        const map = match.map ? `[${match.map}]` : '';

        // Compute display score: prefer normalized per-map score when available (for BO1 show actual map round score)
        let scoreBadge = '';
        try {
          // Prefer pre-normalized map details created by tournament manager
          if (Array.isArray(match.mapDetailsNormalized) && match.mapDetailsNormalized.length === 1) {
            const md = match.mapDetailsNormalized[0];
            if (typeof md.teamAScore !== 'undefined' && typeof md.teamBScore !== 'undefined') {
              scoreBadge = `<div class="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">${md.teamAScore}-${md.teamBScore}</div>`;
            }
          } else {
            const raw = match.raw || {};
            console.log(`DEBUG match ${idx}: raw.mapDetails=${JSON.stringify(raw.mapDetails)}`);
            console.log(`DEBUG match ${idx}: raw.score=${raw.score}`);
            // If raw has mapDetails with single map, use that map's team/opponent scores (fallback)
            if (Array.isArray(raw.mapDetails) && raw.mapDetails.length === 1) {
              const md = raw.mapDetails[0];
              const left = md.teamScore; const right = md.opponentScore;
              if (typeof left !== 'undefined' && typeof right !== 'undefined') {
                scoreBadge = `<div class="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">${left}-${right}</div>`;
              }
            } else if (raw.score && typeof raw.score === 'string') {
              // fallback to raw.score
              scoreBadge = `<div class="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">${raw.score}</div>`;
            }
          }
        } catch(e) {
          console.warn('Could not compute detailed score for history entry', e);
        }

        historyHtml += `
        <div class="p-3 hover:bg-gray-750 transition-colors cursor-pointer">
          <div class="flex justify-between items-center text-sm">
            <div class="text-gray-400">${when}</div>
            ${scoreBadge || (map ? `<div class="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">${map}</div>` : '')}
          </div>
          <div class="mt-1 text-white font-medium flex items-center">
            ${isTeam1Winner ? '🏆 ' : (isTeam2Winner ? '  ' : '🤝 ')}${winnerName}${isTeam2Winner ? ' 🏆' : ''}
          </div>
        </div>`;
      } catch (e) {
        console.error('Ошибка при отображении матча:', e);
      }
    });
    
    // Закрываем контейнеры
    historyHtml += `
      </div>
    </div>`;
  }

  content.innerHTML = `
    <h3 class="text-2xl font-bold mb-6 text-center">⚔️ Предматчевый анализ</h3>
    
    <div class="grid grid-cols-2 gap-6">
      <!-- Team 1 -->
      <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div class="flex items-center gap-3 mb-4">
          <img src="${team1?.logoUrl || 'https://via.placeholder.com/48'}" class="w-14 h-14 rounded border border-gray-600">
          <div>
            <div class="text-xl font-bold">${t1Name}</div>
            <div class="text-sm text-blue-400">Средний рейтинг: ${r1}</div>
          </div>
        </div>
      </div>

      <!-- Team 2 -->
      <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div class="flex items-center gap-3 justify-end mb-4">
          <div class="text-right">
            <div class="text-xl font-bold">${t2Name}</div>
            <div class="text-sm text-red-400">Средний рейтинг: ${r2}</div>
          </div>
          <img src="${team2?.logoUrl || 'https://via.placeholder.com/48'}" class="w-14 h-14 rounded border border-gray-600">
        </div>
      </div>
    </div>

    <!-- Win Chances -->
    <div class="mt-6 bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-4 border border-gray-600">
      <div class="flex items-center justify-between mb-3">
        <span class="font-semibold text-lg">${t1Name}</span>
        <span class="text-gray-400">Шансы на победу</span>
        <span class="font-semibold text-lg text-right">${t2Name}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-2xl font-bold text-blue-400">${winChances.a}%</span>
        <div class="flex-1 relative h-8 bg-gray-900 rounded overflow-hidden border border-gray-600">
          <div class="absolute left-0 top-0 h-full bg-blue-500" style="width:${winChances.a}%"></div>
          <div class="absolute left-1/2 top-0 h-full w-px bg-gray-500 transform -translate-x-1/2"></div>
          <div class="relative h-full flex items-center justify-center text-xs font-bold text-white">
            ${Math.abs(winChances.a - 50) > 5 ? (winChances.a > 50 ? `Фаворит ${t1Name}` : `Фаворит ${t2Name}`) : 'Равные шансы'}
          </div>
        </div>
        <span class="text-2xl font-bold text-red-400">${winChances.b}%</span>
      </div>
    </div>

    <!-- Player Comparison -->
    <div class="mt-6">
      <h4 class="font-bold mb-3 text-lg">👥 Сравнение игроков</h4>
      ${playersHtml}
    </div>

    <!-- History -->
    <div class="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-600">
      <h4 class="font-bold mb-3 text-lg">📊 История встреч</h4>
      ${historyHtml}
    </div>
  `;

  const playBtn = document.getElementById('matchPreviewPlay');
  playBtn.onclick = async () => {
    const payload = {
      tournamentId: tournamentId,
      matchId: matchId,
      team1Id: team1?.id || team1Id,
      team2Id: team2?.id || team2Id,
      team1Name: team1?.name || '',
      team2Name: team2?.name || ''
    };
    localStorage.setItem('pending_match', JSON.stringify(payload));
    console.log('Navigating to main screen with payload:', payload);
    window.location.href = 'index.html';
  };
}

/**
 * Process pending result reported by main screen
 */
function processPendingMatchResult() {
  try {
    const raw = localStorage.getItem('last_played_match_result');
    if (!raw) return;
    const res = JSON.parse(raw);
    console.log('🔁 Processing reported match result:', res);
    const { tournamentId, matchId, team1Score, team2Score, winnerId } = res;
    const tournament = tournamentManagerV2.getTournament(tournamentId);
    if (!tournament) {
      console.warn('Tournament for reported result not found:', tournamentId);
      localStorage.removeItem('last_played_match_result');
      return;
    }

    const applied = applyMatchResultToTournament(tournament, matchId, team1Score, team2Score, winnerId);
    if (applied) {
      tournamentManagerV2.saveTournaments();
      renderTournamentsList();
      // if current tournament open, re-render playoff
      if (tournamentManagerV2.currentTournament && tournamentManagerV2.currentTournament.id === tournament.id) {
        showPlayoff();
      }
      console.log('✅ Applied match result to tournament');
    }

    localStorage.removeItem('last_played_match_result');
  } catch (e) {
    console.error('Error processing pending match result:', e);
  }
}

function applyMatchResultToTournament(tournament, matchId, team1Score, team2Score, winnerId) {
  // search in single-elimination rounds and auto-promote winner
  if (tournament.playoff && tournament.playoff.type === 'single') {
    const rounds = tournament.playoff.rounds || [];
    for (let r = 0; r < rounds.length; r++) {
      const round = rounds[r];
      for (let mi = 0; mi < (round.matches || []).length; mi++) {
        const m = round.matches[mi];
        if (m.id === matchId) {
          m.completed = true; m.team1Score = team1Score; m.team2Score = team2Score; m.winner = winnerId;
          // promote winner to next round
          const nextRound = rounds[r + 1];
          if (nextRound) {
            const destIndex = Math.floor(mi / 2);
            nextRound.matches = nextRound.matches || [];
            while (nextRound.matches.length <= destIndex) {
              nextRound.matches.push({ id: `m_${Date.now()}_${Math.floor(Math.random() * 1e4)}`, team1Id: null, team2Id: null, completed: false, winner: null });
            }
            const dest = nextRound.matches[destIndex];
            if (!dest.team1Id) {
              dest.team1Id = winnerId;
            } else if (!dest.team2Id) {
              dest.team2Id = winnerId;
            }
          }
          return true;
        }
      }
    }
  }

  // double-elimination: update winners bracket and auto-promote there (simplified)
  if (tournament.playoff && tournament.playoff.type === 'double') {
    const p = tournament.playoff;
    for (let r = 0; r < (p.winnersBracket?.rounds || []).length; r++) {
      const round = p.winnersBracket.rounds[r];
      for (let mi = 0; mi < (round.matches || []).length; mi++) {
        const m = round.matches[mi];
        if (m.id === matchId) {
          m.completed = true; m.team1Score = team1Score; m.team2Score = team2Score; m.winner = winnerId;
          const next = p.winnersBracket.rounds[r + 1];
          if (next) {
            const destIndex = Math.floor(mi / 2);
            next.matches = next.matches || [];
            while (next.matches.length <= destIndex) {
              next.matches.push({ id: `m_${Date.now()}_${Math.floor(Math.random() * 1e4)}`, team1Id: null, team2Id: null, completed: false, winner: null });
            }
            const dest = next.matches[destIndex];
            if (!dest.team1Id) dest.team1Id = winnerId; else if (!dest.team2Id) dest.team2Id = winnerId;
          }
          return true;
        }
      }
    }

    for (const round of (p.losersBracket?.rounds || [])) {
      for (const m of round.matches || []) if (m.id === matchId) { m.completed = true; m.team1Score = team1Score; m.team2Score = team2Score; m.winner = winnerId; return true; }
    }
    // grand final
    if (p.grand && p.grand.id === matchId) {
      p.grand.completed = true; p.grand.team1Score = team1Score; p.grand.team2Score = team2Score; p.grand.winner = winnerId; return true;
    }
  }

  return false;
}

/**
 * Handle delete tournament
 */
function handleDeleteTournament() {
  const tournament = tournamentManagerV2.currentTournament;
  if (!tournament) return;

  if (!confirm(`Удалить турнир "${tournament.name}"?`)) {
    return;
  }

  tournamentManagerV2.deleteTournament(tournament.id);
  closeTournamentModal();
  renderTournamentsList();
  alert('Турнир удален!');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initTournamentsUI);
