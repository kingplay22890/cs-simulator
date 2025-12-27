// UI логика для турниров
let allTeams = [];

async function initTournamentsUI() {
  // Загружаем данные
  console.log('initTournamentsUI: Starting...');
  
  await tournamentManager.loadTeams();
  console.log('After loadTeams, allTeams in manager:', tournamentManager.allTeams);
  
  allTeams = tournamentManager.allTeams;
  console.log('allTeams assigned to local variable:', allTeams);
  console.log('allTeams has', allTeams.length, 'teams');
  
  // Проверяем структуру команд
  if (allTeams.length > 0) {
    console.log('First team structure:', { 
      id: allTeams[0].id, 
      name: allTeams[0].name,
      hasId: 'id' in allTeams[0]
    });
  }
  
  tournamentManager.loadTournaments();
  console.log('Loaded tournaments:', tournamentManager.tournaments);

  // Инициализируем UI элементы
  initializeEventListeners();
  renderTournamentsList();
  populateTeamsSelection();
}

function initializeEventListeners() {
  document.getElementById('createTournamentBtn').addEventListener('click', () => {
    document.getElementById('createTournamentModal').classList.remove('hidden');
  });

  document.getElementById('cancelCreateBtn').addEventListener('click', () => {
    document.getElementById('createTournamentModal').classList.add('hidden');
    document.getElementById('createTournamentForm').reset();
  });

  document.getElementById('createTournamentForm').addEventListener('submit', handleCreateTournament);

  document.getElementById('groupStageFormat').addEventListener('change', (e) => {
    const roundsContainer = document.getElementById('roundsContainer');
    const groupsContainer = document.getElementById('groupsCountContainer');
    
    // Показываем раунды ТОЛЬКО для круговой системы и двойного выбывания
    if (e.target.value === 'round-robin') {
      roundsContainer.classList.remove('hidden');
      groupsContainer.classList.add('hidden');
    } else if (e.target.value === 'double') {
      groupsContainer.classList.remove('hidden');
      roundsContainer.classList.add('hidden');
    } else {
      roundsContainer.classList.add('hidden');
      groupsContainer.classList.add('hidden');
    }
  });

  document.getElementById('closeTournamentViewBtn').addEventListener('click', closeTournamentModal);
  document.getElementById('closeTournamentBtn').addEventListener('click', closeTournamentModal);
  document.getElementById('deleteTournamentBtn').addEventListener('click', handleDeleteTournament);

  document.getElementById('groupStageTab').addEventListener('click', () => {
    showGroupStage();
  });

  document.getElementById('playoffTab').addEventListener('click', () => {
    showPlayoff();
  });
}

function populateTeamsSelection() {
  const container = document.getElementById('teamsSelection');
  
  console.log('populateTeamsSelection: allTeams =', allTeams);
  
  if (allTeams.length === 0) {
    container.innerHTML = '<p class="text-gray-400">Команд не найдено. Сначала создайте команды!</p>';
    return;
  }

  const html = allTeams.map(team => {
    console.log(`Creating checkbox for team:`, { id: team.id, name: team.name });
    return `
      <label class="flex items-center gap-3 p-3 hover:bg-gray-600 rounded-lg cursor-pointer">
        <input type="checkbox" value="${team.id}" class="team-checkbox w-4 h-4" data-team-name="${team.name}">
        <img src="${team.logoUrl || 'https://via.placeholder.com/32'}" alt="${team.name}" class="w-6 h-6 rounded object-cover">
        <span>${team.name}</span>
      </label>
    `;
  }).join('');
  
  container.innerHTML = html;
  console.log('populateTeamsSelection: HTML created with', allTeams.length, 'teams');

  // Обновляем счётчик выбранных команд
  const checkboxes = document.querySelectorAll('.team-checkbox');
  console.log('Found checkboxes:', checkboxes.length);
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectedTeamsCount);
  });
}

function updateSelectedTeamsCount() {
  const selected = document.querySelectorAll('.team-checkbox:checked').length;
  document.getElementById('selectedTeamsCount').textContent = selected;
}

function getSelectedTeams() {
  const allCheckboxes = document.querySelectorAll('.team-checkbox');
  console.log('All checkboxes in form:', allCheckboxes.length);
  
  const checkboxes = document.querySelectorAll('.team-checkbox:checked');
  console.log('Checked checkboxes:', checkboxes.length);
  
  const teams = Array.from(checkboxes).map(cb => {
    const value = cb.value;
    const name = cb.dataset.teamName;
    console.log('Checkbox:', { value, name, htmlValue: cb.getAttribute('value') });
    return value;
  });
  
  console.log('Selected teams array:', teams);
  console.log('Selected teams (non-undefined):', teams.filter(t => t !== undefined));
  return teams;
}

async function handleCreateTournament(e) {
  e.preventDefault();

  const name = document.getElementById('tournamentName').value;
  const teams = getSelectedTeams();
  const groupFormat = document.getElementById('groupStageFormat').value;
  const groupRounds = parseInt(document.getElementById('groupRounds').value) || 0;
  const groupsCount = parseInt(document.getElementById('groupsCount').value) || 1;
  const playoffTeams = document.getElementById('playoffTeams').value;
  const playoffFormat = document.getElementById('playoffFormat').value;

  if (teams.length < 4) {
    alert('Выберите минимум 4 команды');
    return;
  }

  try {
    // Убедимся что команды загружены
    if (!tournamentManager.allTeams || tournamentManager.allTeams.length === 0) {
      console.log('Teams not loaded, loading now...');
      await tournamentManager.loadTeams();
    }

    console.log('Creating tournament with:', {
      name, teams, groupFormat, groupRounds, groupsCount, playoffTeams, playoffFormat
    });
    console.log('Current allTeams in manager:', tournamentManager.allTeams);

    const tournament = tournamentManager.createTournament({
      name,
      teams,
      groupStageFormat: groupFormat,
      groupRounds: groupRounds,
      groupsCount: groupsCount,
      playoffTeams: playoffTeams,
      playoffFormat: playoffFormat
    });

    console.log('Tournament created successfully:', tournament);

    // Закрываем модальное окно и очищаем форму
    document.getElementById('createTournamentModal').classList.add('hidden');
    document.getElementById('createTournamentForm').reset();
    updateSelectedTeamsCount();

    // Обновляем список турниров
    renderTournamentsList();
  } catch (error) {
    console.error('Error creating tournament:', error);
    alert(`Ошибка при создании турнира: ${error.message}`);
  }
}

function renderTournamentsList() {
  const container = document.getElementById('tournamentsContainer');
  const tournaments = tournamentManager.tournaments;

  if (tournaments.length === 0) {
    container.innerHTML = '<div class="bg-gray-800 rounded-lg p-8 text-center text-gray-400">Турниров не создано</div>';
    return;
  }

  container.innerHTML = tournaments.map(tournament => `
    <div class="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition cursor-pointer" onclick="openTournamentModal('${tournament.id}')">
      <div class="flex items-start justify-between mb-4">
        <h3 class="text-xl font-bold">${tournament.name}</h3>
        <span class="px-3 py-1 rounded-full text-sm font-semibold ${
          tournament.status === 'active' 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-gray-600/20 text-gray-400'
        }">
          ${tournament.status === 'active' ? '🔴 Активен' : '✅ Завершён'}
        </span>
      </div>
      <div class="grid grid-cols-4 gap-4 text-sm text-gray-400">
        <div>
          <p class="text-xs uppercase text-gray-500">Команд</p>
          <p class="text-lg font-semibold text-white">${tournament.teams.length}</p>
        </div>
        <div>
          <p class="text-xs uppercase text-gray-500">Групповая стадия</p>
          <p class="text-lg font-semibold text-white">
            ${tournament.groupStageFormat === 'swiss' ? '🇨🇭 Швейцария' : 
              tournament.groupStageFormat === 'round-robin' ? '🔄 Круговая' : 
              '❌ Нет'}
          </p>
        </div>
        <div>
          <p class="text-xs uppercase text-gray-500">Плей-офф</p>
          <p class="text-lg font-semibold text-white">
            ${tournament.playoffFormat === 'single' ? '📊 Single' : '📊 Double'}
          </p>
        </div>
        <div>
          <p class="text-xs uppercase text-gray-500">Этап</p>
          <p class="text-lg font-semibold text-white">
            ${tournament.currentStage === 'group' ? '👥 Группа' : '🏆 Плей-офф'}
          </p>
        </div>
      </div>
    </div>
  `).join('');
}

function openTournamentModal(tournamentId) {
  const tournament = tournamentManager.getTournament(tournamentId);
  if (!tournament) {
    console.error('Tournament not found:', tournamentId);
    alert('Турнир не найден');
    return;
  }

  console.log('Opening tournament:', tournament);
  console.log('Tournament teams before restore:', tournament.teams);
  console.log('Tournament team IDs:', tournament.teamIds);
  
  // Если команды не заполнены, восстанавливаем из allTeams
  if (!tournament.teams || tournament.teams.length === 0 || (tournament.teams[0] && !tournament.teams[0].name)) {
    console.log('Restoring tournament teams from allTeams');
    tournament.teams = tournament.teamIds.map(teamId => {
      const team = allTeams.find(t => t.id === teamId);
      const restoredTeam = {
        id: teamId,
        name: team?.name || 'Unknown',
        logoUrl: team?.logoUrl || '',
        players: team?.players || []
      };
      console.log(`Restored team ${teamId}:`, restoredTeam);
      return restoredTeam;
    });
    console.log('Restored tournament teams:', tournament.teams);
    
    // Сохраняем восстановленные команды в localStorage
    tournamentManager.saveTournaments();
  }

  tournamentManager.currentTournament = tournament;

  document.getElementById('tournamentTitle').textContent = tournament.name;
  document.getElementById('viewTournamentModal').classList.remove('hidden');

  // Показываем нужную стадию по умолчанию
  try {
    if (tournament.currentStage === 'group' && tournament.groupStageFormat !== 'none') {
      document.getElementById('groupStageTab').click();
    } else {
      document.getElementById('playoffTab').click();
    }
  } catch (error) {
    console.error('Error displaying tournament stage:', error);
    alert('Ошибка при отображении турнира');
  }
}

function closeTournamentModal() {
  document.getElementById('viewTournamentModal').classList.add('hidden');
  tournamentManager.currentTournament = null;
}

function handleDeleteTournament() {
  if (!tournamentManager.currentTournament) return;

  if (confirm(`Вы уверены, что хотите удалить турнир "${tournamentManager.currentTournament.name}"?`)) {
    tournamentManager.deleteTournament(tournamentManager.currentTournament.id);
    closeTournamentModal();
    renderTournamentsList();
  }
}

function showGroupStage() {
  const tournament = tournamentManager.currentTournament;
  if (!tournament || tournament.groupStageFormat === 'none') {
    console.error('Cannot show group stage:', { tournament, format: tournament?.groupStageFormat });
    return;
  }

  console.log('Showing group stage:', tournament);
  
  // Убеждаемся что команды восстановлены
  if (!tournament.teams || tournament.teams.length === 0 || (tournament.teams[0] && !tournament.teams[0].name)) {
    console.log('Teams not loaded, restoring from allTeams');
    tournament.teams = tournament.teamIds.map(teamId => {
      const team = allTeams.find(t => t.id === teamId);
      return {
        id: teamId,
        name: team?.name || 'Unknown',
        logoUrl: team?.logoUrl || '',
        players: team?.players || []
      };
    });
  }

  document.getElementById('groupStageTab').classList.remove('bg-gray-700', 'text-gray-300');
  document.getElementById('groupStageTab').classList.add('bg-blue-600', 'text-white');
  document.getElementById('playoffTab').classList.add('bg-gray-700', 'text-gray-300');
  document.getElementById('playoffTab').classList.remove('bg-blue-600', 'text-white');

  document.getElementById('groupStageContent').classList.remove('hidden');
  document.getElementById('playoffContent').classList.add('hidden');

  renderGroupStage(tournament);
}

function showPlayoff() {
  const tournament = tournamentManager.currentTournament;
  if (!tournament || !tournament.playoff) return;

  document.getElementById('playoffTab').classList.remove('bg-gray-700', 'text-gray-300');
  document.getElementById('playoffTab').classList.add('bg-blue-600', 'text-white');
  document.getElementById('groupStageTab').classList.add('bg-gray-700', 'text-gray-300');
  document.getElementById('groupStageTab').classList.remove('bg-blue-600', 'text-white');

  document.getElementById('groupStageContent').classList.add('hidden');
  document.getElementById('playoffContent').classList.remove('hidden');

  renderPlayoff(tournament);
}

function renderGroupStage(tournament) {
  const container = document.getElementById('groupsContainer');

  console.log('renderGroupStage called with:', {
    groupStageFormat: tournament.groupStageFormat,
    groupStage: tournament.groupStage,
    teamsCount: tournament.teams?.length,
    teamIds: tournament.teamIds
  });

  if (!tournament.groupStage) {
    console.error('Group stage is null:', { 
      format: tournament.groupStageFormat,
      groupStage: tournament.groupStage 
    });
    container.innerHTML = '<p class="text-gray-400">Групповая стадия не используется в этом турнире</p>';
    return;
  }

  console.log('Rendering group stage:', tournament.groupStage);
  console.log('Teams in tournament:', tournament.teams);

  let html = '';

  if (tournament.groupStageFormat === 'double') {
    // Double elimination групповая стадия с группами
    if (tournament.groupStage.groups && tournament.groupStage.groups.length > 0) {
      html += '<div class="space-y-8">';
      
      tournament.groupStage.groups.forEach(group => {
        html += `
          <div class="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <h3 class="text-lg font-bold mb-6">📋 Группа ${group.groupNumber}</h3>
            <div class="space-y-6">
              <div>
                <h4 class="font-bold mb-3">👑 Верхняя сетка (Winners)</h4>
                ${renderDoubleGroupBracket(tournament, 'winners', group)}
              </div>
              <div>
                <h4 class="font-bold mb-3">💀 Нижняя сетка (Losers)</h4>
                ${renderDoubleGroupBracket(tournament, 'losers', group)}
              </div>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
    } else {
      // Старый формат без групп (обратная совместимость)
      html += `
        <div class="space-y-6">
          <div>
            <h3 class="text-lg font-bold mb-4">👑 Верхняя сетка (Winners Bracket)</h3>
            ${renderDoubleGroupBracket(tournament, 'winners')}
          </div>
          <div>
            <h3 class="text-lg font-bold mb-4">💀 Нижняя сетка (Losers Bracket)</h3>
            ${renderDoubleGroupBracket(tournament, 'losers')}
          </div>
        </div>
      `;
    }
  } else {
    // Таблица стоящика для швейцарской системы и круговой
    // Убеждаемся что standings заполнен
    if (!tournament.groupStage.standings || tournament.groupStage.standings.length === 0) {
      console.warn('Standings is empty, initializing from tournament teams');
      tournament.groupStage.standings = tournament.teamIds.map(teamId => {
        const teamInfo = tournament.teams.find(t => t.id === teamId);
        return {
          teamId: teamId,
          teamName: teamInfo?.name || 'Unknown',
          wins: 0,
          losses: 0,
          points: 0,
          matchesPlayed: 0,
          eliminated: false,
          eliminatedRound: null
        };
      });
    }

    html += `
      <div class="bg-gray-700/50 rounded-lg p-4">
        <h3 class="text-lg font-bold mb-4">📊 Таблица стоящика</h3>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-600">
              <th class="px-4 py-2 text-left">#</th>
              <th class="px-4 py-2 text-left">Команда</th>
              <th class="px-4 py-2 text-center">М</th>
              <th class="px-4 py-2 text-center">В</th>
              <th class="px-4 py-2 text-center">П</th>
              <th class="px-4 py-2 text-center">Очки</th>
              <th class="px-4 py-2 text-center">Статус</th>
            </tr>
          </thead>
          <tbody>
    `;

    tournament.groupStage.standings
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.wins - a.wins;
      })
      .forEach((standing, idx) => {
        // Ищем команду в tournament.teams или в allTeams
        let teamInfo = tournament.teams?.find(t => t.id === standing.teamId);
        if (!teamInfo || !teamInfo.name) {
          teamInfo = allTeams.find(t => t.id === standing.teamId);
        }
        
        if (!teamInfo) {
          console.warn('Team not found for standing:', standing);
          return;
        }
        
        const statusText = standing.eliminated ? `❌ Выбыл (раунд ${standing.eliminatedRound})` : '🟢 Активен';
        const statusClass = standing.eliminated ? 'text-red-400' : 'text-green-400';
        
        html += `
          <tr class="border-b border-gray-600 hover:bg-gray-600/30 ${standing.eliminated ? 'opacity-50' : ''}">
            <td class="px-4 py-2 font-bold">${idx + 1}</td>
            <td class="px-4 py-2 flex items-center gap-2">
              <img src="${teamInfo.logoUrl || 'https://via.placeholder.com/24'}" alt="${teamInfo.name}" class="w-5 h-5 rounded">
              <span>${teamInfo.name}</span>
            </td>
            <td class="px-4 py-2 text-center">${standing.matchesPlayed}</td>
            <td class="px-4 py-2 text-center text-green-400 font-semibold">${standing.wins}</td>
            <td class="px-4 py-2 text-center text-red-400 font-semibold">${standing.losses}</td>
            <td class="px-4 py-2 text-center font-bold">${standing.points}</td>
            <td class="px-4 py-2 text-center ${statusClass} font-semibold">${statusText}</td>
          </tr>
        `;
      });

    html += `
          </tbody>
        </table>
      </div>
    `;

    // Показываем раунды для швейцарской системы и круговой
    if (tournament.groupStage.rounds && tournament.groupStage.rounds.length > 0) {
      html += `
        <div class="bg-gray-700/50 rounded-lg p-4 mt-6">
          <h3 class="text-lg font-bold mb-4">⚔️ Раунды</h3>
          <div class="space-y-4">
      `;

      tournament.groupStage.rounds.forEach(round => {
        html += `
          <div class="bg-gray-600/30 rounded-lg p-3">
            <h4 class="font-bold mb-2">Раунд ${round.number}</h4>
            <div class="space-y-2">
        `;

        if (round.matches.length === 0) {
          html += '<p class="text-gray-400 text-sm">Матчи не сгенерированы</p>';
        } else {
          round.matches.forEach(match => {
            let team1Info = tournament.teams?.find(t => t.id === match.team1Id);
            let team2Info = tournament.teams?.find(t => t.id === match.team2Id);
            
            // Fallback на allTeams если не найдены
            if (!team1Info || !team1Info.name) {
              team1Info = allTeams.find(t => t.id === match.team1Id);
            }
            if (!team2Info || !team2Info.name) {
              team2Info = allTeams.find(t => t.id === match.team2Id);
            }

            html += `
              <div class="flex items-center gap-4 p-2 bg-gray-600/50 rounded-lg text-sm">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <img src="${team1Info?.logoUrl || 'https://via.placeholder.com/20'}" alt="${team1Info?.name}" class="w-4 h-4 rounded">
                    <span>${team1Info?.name || 'Unknown'}</span>
                  </div>
                </div>
                <div class="text-center w-12">
                  ${match.completed 
                    ? `<span class="font-bold text-xs">${match.team1Score} - ${match.team2Score}</span>`
                    : '<span class="text-gray-400 text-xs">vs</span>'
                  }
                </div>
                <div class="flex-1 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <span>${team2Info?.name || 'Unknown'}</span>
                    <img src="${team2Info?.logoUrl || 'https://via.placeholder.com/20'}" alt="${team2Info?.name}" class="w-4 h-4 rounded">
                  </div>
                </div>
                ${!match.completed
                  ? `<button onclick="editGroupMatch('${tournament.id}', ${round.number}, '${match.id}')" 
                      class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded transition">
                      Результат
                    </button>`
                  : ''
                }
              </div>
            `;
          });
        }

        html += `
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }
  }

  // Кнопка завершения групповой стадии
  if (tournament.currentStage === 'group') {
    let canCompleteGroupStage = false;
    
    if (tournament.groupStageFormat === 'double') {
      // Для double elimination нужно проверить обе сетки
      if (tournament.groupStage.groups && tournament.groupStage.groups.length > 0) {
        // Проверяем все группы
        canCompleteGroupStage = tournament.groupStage.groups.every(group => {
          const wBracketCompleted = group.winnersBracket.rounds.every(r =>
            r.matches.length > 0 && r.matches.every(m => m.completed)
          );
          const lBracketCompleted = group.losersBracket.rounds.every(r =>
            r.matches.length > 0 && r.matches.every(m => m.completed)
          );
          return wBracketCompleted && lBracketCompleted;
        });
      }
    } else if (tournament.groupStage.rounds) {
      canCompleteGroupStage = tournament.groupStage.rounds.every(r =>
        r.matches.length > 0 && r.matches.every(m => m.completed)
      );
    }

    if (canCompleteGroupStage) {
      html += `
        <div class="mt-6">
          <button onclick="completeGroupStage('${tournament.id}')" 
            class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition">
            ✅ Завершить групповую стадию и перейти к плей-офф
          </button>
        </div>
      `;
    }
  }

  container.innerHTML = html;
}

function renderDoubleGroupBracket(tournament, bracket, group = null) {
  const groupStage = tournament.groupStage;
  
  if (!groupStage) {
    console.error('Group stage is null');
    return '<p class="text-gray-400">Групповая стадия не инициализирована</p>';
  }

  // Если есть группы, используем конкретную группу
  let selectedBracket = null;
  if (group) {
    selectedBracket = bracket === 'winners' ? group.winnersBracket : group.losersBracket;
  } else {
    // Старый формат без групп
    if (!groupStage.winnersBracket || !groupStage.losersBracket) {
      console.error('Invalid group stage structure for double elimination');
      return '<p class="text-gray-400">Ошибка: структура групповой стадии повреждена</p>';
    }
    selectedBracket = bracket === 'winners' ? groupStage.winnersBracket : groupStage.losersBracket;
  }
  
  if (!selectedBracket || !selectedBracket.rounds) {
    console.error('No rounds in bracket:', selectedBracket);
    return '<p class="text-gray-400">Раунды не найдены</p>';
  }
  
  // Helper функция для получения информации о команде
  const getTeamInfo = (teamId) => {
    // Сначала ищем в tournament.teams
    let team = tournament.teams?.find(t => t.id === teamId);
    
    // Если не найдена, ищем в allTeams
    if (!team || !team.name) {
      team = allTeams.find(t => t.id === teamId);
    }
    
    return team;
  };
  
  let html = '<div class="space-y-4">';

  selectedBracket.rounds.forEach(round => {
    html += `<div class="bg-gray-600/30 rounded-lg p-3">`;
    html += `<h5 class="font-semibold mb-2 text-sm">Раунд ${round.number}</h5>`;
    html += '<div class="space-y-2">';

    if (round.matches.length === 0) {
      html += '<p class="text-gray-400 text-xs">Матчи не сгенерированы</p>';
    } else {
      round.matches.forEach(match => {
        const team1Info = getTeamInfo(match.team1Id);
        const team2Info = getTeamInfo(match.team2Id);

        console.log(`Match ${match.id}: team1=${team1Info?.name}, team2=${team2Info?.name}`);

        html += `
          <div class="flex items-center gap-2 p-2 bg-gray-500/20 rounded text-xs">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1 truncate">
                <img src="${team1Info?.logoUrl || 'https://via.placeholder.com/16'}" alt="${team1Info?.name}" class="w-4 h-4 rounded flex-shrink-0">
                <span class="truncate">${team1Info?.name || 'Unknown'}</span>
              </div>
            </div>
            <div class="text-center w-10 flex-shrink-0">
              ${match.completed 
                ? `<span class="font-bold">${match.team1Score}-${match.team2Score}</span>`
                : '<span class="text-gray-400">vs</span>'
              }
            </div>
            <div class="flex-1 text-right min-w-0">
              <div class="flex items-center justify-end gap-1 truncate">
                <span class="truncate">${team2Info?.name || 'Unknown'}</span>
                <img src="${team2Info?.logoUrl || 'https://via.placeholder.com/16'}" alt="${team2Info?.name}" class="w-4 h-4 rounded flex-shrink-0">
              </div>
            </div>
          </div>
        `;
      });
    }

    html += '</div></div>';
  });

  html += '</div>';
  return html;
}

function renderPlayoff(tournament) {
  const container = document.getElementById('bracketContainer');

  if (!tournament.playoff) {
    console.error('Playoff not initialized:', tournament);
    container.innerHTML = '<p class="text-gray-400">Плей-офф не инициализирован</p>';
    return;
  }

  console.log('Rendering playoff:', tournament.playoff);

  let html = '';

  if (tournament.playoff.type === 'single') {
    html = renderSingleEliminationBracket(tournament.playoff, tournament.id);
  } else if (tournament.playoff.type === 'double') {
    html = `
      <div class="space-y-6">
        <div>
          <h3 class="text-lg font-bold mb-4">👑 Верхняя сетка (Winners Bracket)</h3>
          ${renderSingleEliminationBracket(tournament.playoff.winnersBracket, tournament.id, 'winners')}
        </div>
        <div>
          <h3 class="text-lg font-bold mb-4">💀 Нижняя сетка (Losers Bracket)</h3>
          ${renderSingleEliminationBracket(tournament.playoff.losersBracket, tournament.id, 'losers')}
        </div>
        <div class="bg-gray-700/50 rounded-lg p-4">
          <h3 class="text-lg font-bold mb-4">🏆 Финал (Grand Final)</h3>
          ${renderGrandFinal(tournament.playoff.grand, tournament.id)}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderSingleEliminationBracket(bracket, tournamentId, stage = null) {
  let html = '<div class="space-y-4">';

  bracket.rounds.forEach((round, roundIdx) => {
    html += `<div class="bg-gray-700/50 rounded-lg p-4">`;
    html += `<h4 class="font-bold mb-3">Раунд ${round.number}</h4>`;
    html += '<div class="space-y-2">';

    round.matches.forEach(match => {
      const team1 = tournamentManager.getTeamById(match.team1Id);
      const team2 = match.team2Id ? tournamentManager.getTeamById(match.team2Id) : null;

      html += `
        <div class="flex items-center gap-4 p-3 bg-gray-600/30 rounded-lg">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <img src="${team1?.logoUrl || 'https://via.placeholder.com/20'}" alt="${team1?.name}" class="w-5 h-5 rounded">
              <span class="font-semibold ${match.winner === match.team1Id ? 'text-green-400' : ''}">${team1?.name || 'Unknown'}</span>
            </div>
          </div>
          <div class="text-center w-16">
            ${match.completed 
              ? `<span class="font-bold text-sm">${match.isBye ? 'БУХ' : (match.team1Score !== null ? `${match.team1Score}` : '✓')}</span>`
              : '<span class="text-gray-400 text-sm">vs</span>'
            }
          </div>
          <div class="flex-1 text-right">
            ${match.team2Id
              ? `<div class="flex items-center justify-end gap-2">
                  <span class="font-semibold ${match.winner === match.team2Id ? 'text-green-400' : ''}">${team2?.name || 'Unknown'}</span>
                  <img src="${team2?.logoUrl || 'https://via.placeholder.com/20'}" alt="${team2?.name}" class="w-5 h-5 rounded">
                </div>`
              : '<span class="text-gray-400 text-sm">-</span>'
            }
          </div>
          ${!match.completed && !match.isBye
            ? `<button onclick="editPlayoffMatch('${tournamentId}', '${stage || 'default'}', ${round.number}, '${match.id}')" 
                class="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded transition">
                Результат
              </button>`
            : ''
          }
        </div>
      `;
    });

    html += '</div></div>';
  });

  html += '</div>';
  return html;
}

function renderGrandFinal(grandFinal, tournamentId) {
  const team1 = grandFinal.team1Id ? tournamentManager.getTeamById(grandFinal.team1Id) : null;
  const team2 = grandFinal.team2Id ? tournamentManager.getTeamById(grandFinal.team2Id) : null;

  return `
    <div class="flex items-center gap-4 p-4 bg-gray-600/30 rounded-lg">
      <div class="flex-1">
        ${team1 
          ? `<div class="flex items-center gap-2">
              <img src="${team1.logoUrl || 'https://via.placeholder.com/24'}" alt="${team1.name}" class="w-6 h-6 rounded">
              <span class="font-semibold text-lg">${team1.name}</span>
            </div>`
          : '<span class="text-gray-400">Победитель верхней сетки</span>'
        }
      </div>
      <div class="text-center">
        ${grandFinal.completed
          ? `<span class="font-bold text-lg">${grandFinal.team1Score} - ${grandFinal.team2Score}</span>`
          : '<span class="text-gray-400">vs</span>'
        }
      </div>
      <div class="flex-1 text-right">
        ${team2
          ? `<div class="flex items-center justify-end gap-2">
              <span class="font-semibold text-lg">${team2.name}</span>
              <img src="${team2.logoUrl || 'https://via.placeholder.com/24'}" alt="${team2.name}" class="w-6 h-6 rounded">
            </div>`
          : '<span class="text-gray-400">Победитель нижней сетки</span>'
        }
      </div>
    </div>
  `;
}

// Вспомогательные функции
function generateSwissRound(tournamentId, roundNumber) {
  const success = tournamentManager.generateSwissRound(tournamentId, roundNumber);
  if (success) {
    openTournamentModal(tournamentId);
    showGroupStage();
  } else {
    alert('Не удалось сгенерировать раунд');
  }
}

function completeGroupStage(tournamentId) {
  const success = tournamentManager.completeGroupStage(tournamentId);
  if (success) {
    openTournamentModal(tournamentId);
    showPlayoff();
  }
}

function editGroupMatch(tournamentId, roundNumber, matchId) {
  const tournament = tournamentManager.getTournament(tournamentId);
  const round = tournament.groupStage.rounds.find(r => r.number === roundNumber);
  const match = round.matches.find(m => m.id === matchId);

  const team1Info = tournament.teams.find(t => t.id === match.team1Id);
  const team2Info = tournament.teams.find(t => t.id === match.team2Id);

  const score1 = prompt(`Введите счёт для ${team1Info.name}:`, match.team1Score || '');
  if (score1 === null) return;

  const score2 = prompt(`Введите счёт для ${team2Info.name}:`, match.team2Score || '');
  if (score2 === null) return;

  tournamentManager.updateGroupMatch(tournamentId, roundNumber, matchId, parseInt(score1), parseInt(score2));
  openTournamentModal(tournamentId);
  showGroupStage();
}

function editPlayoffMatch(tournamentId, stage, roundNumber, matchId) {
  const tournament = tournamentManager.getTournament(tournamentId);
  let bracket = null;
  let match = null;

  if (tournament.playoff.type === 'single') {
    const round = tournament.playoff.rounds.find(r => r.number === roundNumber);
    match = round.matches.find(m => m.id === matchId);
  } else {
    bracket = stage === 'winners' ? tournament.playoff.winnersBracket : tournament.playoff.losersBracket;
    const round = bracket.rounds.find(r => r.number === roundNumber);
    match = round.matches.find(m => m.id === matchId);
  }

  if (!match) return;

  const team1Info = tournament.teams.find(t => t.id === match.team1Id);
  const team2Info = tournament.teams.find(t => t.id === match.team2Id);
  const teams = [
    { id: match.team1Id, name: team1Info.name },
    { id: match.team2Id, name: team2Info.name }
  ];

  const winnerName = prompt(`Кто победил? (${team1Info.name} / ${team2Info.name}):`, '');
  if (!winnerName) return;

  const winner = teams.find(t => t.name.toLowerCase() === winnerName.toLowerCase())?.id;
  if (!winner) {
    alert('Команда не найдена');
    return;
  }

  tournamentManager.updatePlayoffMatch(tournamentId, stage, roundNumber, matchId, winner);
  openTournamentModal(tournamentId);
  showPlayoff();
}

// Инициализируем при загрузке страницы
document.addEventListener('DOMContentLoaded', initTournamentsUI);
