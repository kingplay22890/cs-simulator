// script.js - исправленная версия

// Функции для работы с командами (совместимость)
async function writeSavedTeams(teams) {
  if (window.csApi) {
    await window.csApi.writeSavedTeams(teams);
  } else {
    
  }
}

// Глобальный кэш команд для поиска
let allTeamsCache = [];

// Мок-данные HLTV
const hltvTeams = [
    {
        name: "G2 Esports",
        logoUrl: "https://img-cdn.hltv.org/teamlogo/yeXBldn9w8LZCgdElAenPs.png?ixlib=java-2.1.0&w=50&s=15eaba0b75250065d20162d2cb05e3e6",
        players: [
            { name: "m0NESY", rating: 1.2 },
            { name: "NiKo", rating: 1.1 },
            { name: "jks", rating: 1.0 },
            { name: "huNter-", rating: 0.9 },
            { name: "nexa", rating: 0.8 }
        ]
    }
];

const maps = (window.mapUtils?.getPool?.() || ['Mirage', 'Dust2', 'Ancient', 'Overpass', 'Train', 'Nuke', 'Inferno']).filter(Boolean);

// Глобальные настройки вероятностей для игроков
const PLAYER_HOT_PROB_GLOBAL = 0.02; // 0.5% шанс на "матч жизни" (уменьшено)
const PLAYER_COLD_PROB_GLOBAL = 0.01;
// ������� ��� ��������� ����������� �� ������
function renderMapSquares(team1Wins, team2Wins, maxMaps) {
  let squaresDiv = document.getElementById('mapSquares');
  if (!squaresDiv) {
    squaresDiv = document.createElement('div');
    squaresDiv.id = 'mapSquares';
    squaresDiv.className = 'flex justify-center gap-3 mt-3';
    const scoreDisplay = document.getElementById('matchScore');
    if (scoreDisplay && scoreDisplay.parentNode) {
      scoreDisplay.parentNode.insertBefore(squaresDiv, scoreDisplay.nextSibling);
    }
  }
  let html = '';
  for (let i = 0; i < maxMaps; i++) {
    const team1Color = i < team1Wins ? 'bg-blue-500' : 'bg-gray-600';
    const team2Color = i < team2Wins ? 'bg-red-500' : 'bg-gray-600';
    html += '<div class="flex gap-1"><div class="w-6 h-6 rounded border border-gray-400 ' + team1Color + ' transition-colors"></div><div class="w-6 h-6 rounded border border-gray-400 ' + team2Color + ' transition-colors"></div></div>';
  }
  squaresDiv.innerHTML = html;
} // 0.2% шанс на провал у игрока (уменьшено)

function takeRandomMap(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return pool.splice(idx, 1)[0];
}

function simulateMapVeto(format, team1Name, team2Name) {
  const pool = maps.length ? [...maps] : window.mapUtils.getPool();
  const log = [];
  const mapOrder = [];

  const ban = (team) => {
    const map = takeRandomMap(pool);
    if (map) log.push({ type: 'ban', team, map });
  };

  const pick = (team) => {
    const map = takeRandomMap(pool);
    if (map) {
      log.push({ type: 'pick', team, map });
      mapOrder.push(map);
    }
  };

  const decider = () => {
    const map = takeRandomMap(pool);
    if (map) {
      log.push({ type: 'decider', map });
      mapOrder.push(map);
    }
  };

  switch (format) {
    case 'BO1':
      // Баним все карты до тех пор, пока не останется последняя
      while (pool.length > 1) {
        const currentTeam = (pool.length % 2 === 0) ? team2Name : team1Name;
        ban(currentTeam);
      }
      // Последняя оставшаяся карта автоматически становится выбранной
      if (pool.length === 1) {
        decider();
      }
      break;
    case 'BO3':
      ban(team1Name);
      ban(team2Name);
      pick(team1Name);
      pick(team2Name);
      ban(team1Name);
      ban(team2Name);
      decider();
      break;
    case 'BO5':
      ban(team1Name);
      ban(team2Name);
      while (mapOrder.length < 5 && pool.length > 0) {
        pick(mapOrder.length % 2 === 0 ? team1Name : team2Name);
      }
      break;
    default:
      pick(team1Name);
  }

  if (mapOrder.length === 0) {
    mapOrder.push(...pool.slice(0, 1));
  }

  return { mapOrder, log, remainingPool: pool };
}

async function renderVetoPanel(vetoData, team1Name, team2Name) {
  const container = document.getElementById('vetoResults');
  if (!container || !vetoData) return;

  // Добавляем стили для hover эффекта если их нет
  if (!document.getElementById('vetoHoverStyles')) {
    const style = document.createElement('style');
    style.id = 'vetoHoverStyles';
    style.textContent = `
      .veto-card {
        position: relative;
        aspect-ratio: 1;
        border-radius: 2rem;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .veto-card:hover {
        transform: scale(1.05);
        box-shadow: 0 8px 32px rgba(0, 200, 255, 0.3);
      }
      .veto-card-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: filter 0.3s ease;
      }
      .veto-card.ban .veto-card-image {
        filter: grayscale(1) opacity(0.7);
      }
      .veto-card-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 1.5rem;
        z-index: 10;
      }
      .veto-card-title {
        color: white;
        font-weight: 800;
        font-size: 2rem;
        text-align: center;
        text-shadow: 0 3px 10px rgba(0,0,0,0.9);
        letter-spacing: 0.05em;
      }
      .veto-card-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }
      .veto-card-logo {
        width: 3.5rem;
        height: 3.5rem;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        transition: all 0.3s ease;
      }
      .veto-card.ban .veto-card-logo {
        filter: grayscale(1) opacity(0.8);
      }
      .veto-card:hover .veto-card-logo {
        transform: scale(1.1) rotate(5deg);
        box-shadow: 0 6px 20px rgba(0, 200, 255, 0.5);
      }
      .veto-card.ban:hover .veto-card-logo {
        filter: grayscale(0.3) opacity(1);
      }
      .veto-card-button {
        padding: 0.5rem 1.5rem;
        color: black;
        font-weight: 700;
        font-size: 0.875rem;
        border-radius: 0.5rem;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      .veto-card-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.4);
      }
      .veto-card-button.ban {
        background: #9CA3AF;
      }
      .veto-card-button.pick-team1 {
        background: #3B82F6;
      }
      .veto-card-button.pick-team2 {
        background: #FBBF24;
      }
      .veto-card-button.decider {
        background: #9CA3AF;
      }
      .map-order-card {
        position: relative;
        border-radius: 2rem;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s ease;
        height: 280px;
      }
      .map-order-card:hover {
        transform: translateY(-12px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      }
      .map-order-image-container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: 2rem;
      }
      .map-order-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s ease;
      }
      .map-order-card:hover .map-order-image {
        transform: scale(1.1);
      }
      .map-order-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 1.5rem;
        z-index: 10;
      }
      .map-order-title {
        color: white;
        font-weight: 800;
        font-size: 2.5rem;
        text-align: center;
        text-shadow: 0 3px 10px rgba(0,0,0,0.9);
        letter-spacing: 0.05em;
      }
      .map-order-label {
        color: white;
        font-weight: 600;
        font-size: 1rem;
        text-align: center;
        text-shadow: 0 2px 8px rgba(0,0,0,0.9);
      }
    `;
    document.head.appendChild(style);
  }

  // Map images
  const mapImages = {
    'Ancient': 'https://liquipedia.net/commons/images/thumb/f/fc/CS2_de_ancient.png/800px-CS2_de_ancient.png',
    'Dust2': 'https://liquipedia.net/commons/images/thumb/d/d7/CS2_Dust_2_A_Site.jpg/800px-CS2_Dust_2_A_Site.jpg',
    'Inferno': 'https://liquipedia.net/commons/images/thumb/0/08/CS2_de_inferno.png/800px-CS2_de_inferno.png',
    'Mirage': 'https://liquipedia.net/commons/images/thumb/f/f1/CS2_de_mirage.png/800px-CS2_de_mirage.png',
    'Nuke': 'https://liquipedia.net/commons/images/thumb/a/ad/CS2_de_nuke.png/800px-CS2_de_nuke.png',
    'Overpass': 'https://liquipedia.net/commons/images/thumb/3/3c/CS2_de_overpass.png/800px-CS2_de_overpass.png',
    'Train': 'https://liquipedia.net/commons/images/thumb/4/44/CS2_de_train.png/800px-CS2_de_train.png'
  };

  // Get team logos
  const team1Logo = getLogo('team1') || '';
  const team2Logo = getLogo('team2') || '';
  const teamLogos = {
    [team1Name]: team1Logo,
    [team2Name]: team2Logo
  };

  // Build veto grid
  const vetoGridHtml = (vetoData.log || []).map((entry) => {
    const mapImage = mapImages[entry.map] || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect fill='%23222' width='300' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='32' fill='%23999'%3E${entry.map}%3C/text%3E%3C/svg%3E`;
    
    let actionType = '';
    if (entry.type === 'ban') {
      actionType = 'ban';
    } else if (entry.type === 'pick') {
      actionType = entry.team === team1Name ? 'pick-team1' : 'pick-team2';
    } else {
      actionType = 'decider';
    }
    
    const actionBadge = entry.type === 'ban' 
      ? 'BAN'
      : entry.type === 'pick'
      ? 'PICK'
      : 'DECIDER';
    
    const teamLogo = actionType !== 'decider' ? (teamLogos[entry.team] || '') : '';
    const logoHtml = teamLogo ? `<img src="${teamLogo}" alt="${entry.team}" class="veto-card-logo" onerror="this.style.display='none'">` : (actionType !== 'decider' ? '<div class="veto-card-logo" style="background: #374151;"></div>' : '');
    
    return `
      <div class="veto-card ${entry.type === 'ban' ? 'ban' : ''}">
        <img src="${mapImage}" alt="${entry.map}" class="veto-card-image" onerror="this.style.backgroundColor='#1a1a1a'">
        <div class="veto-card-overlay">
          <div class="veto-card-title">${entry.map}</div>
          <div class="veto-card-center">
            ${logoHtml}
            <button class="veto-card-button ${actionType}">
              ${actionBadge}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Build map order section
  const mapOrderHtml = (vetoData.mapOrder || []).map((map, idx) => {
    const mapImage = mapImages[map] || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%23222' width='200' height='150'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='24' fill='%23999'%3E${map}%3C/text%3E%3C/svg%3E`;
    return `
      <div class="map-order-card">
        <div class="map-order-image-container">
          <img src="${mapImage}" alt="${map}" class="map-order-image" onerror="this.style.backgroundColor='#1a1a1a'">
          <div class="map-order-overlay">
            <div></div>
            <div class="text-center">
              <div class="map-order-title">${map}</div>
              <div class="map-order-label">Map ${idx + 1}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="mt-8">
      <div class="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
        <!-- Team Header -->
        <div class="text-center mb-6">
          <h2 class="text-white text-2xl font-bold tracking-wider">${team1Name} VS ${team2Name}</h2>
        </div>

        <!-- Veto Grid -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          ${vetoGridHtml}
        </div>

        <!-- Divider -->
        <div class="border-t border-gray-700 my-6"></div>

        <!-- Map Order Section -->
        <div class="mb-4">
          <h3 class="text-center text-white text-xl font-bold tracking-widest mb-6">MAP ORDER</h3>
          <div class="grid grid-cols-3 gap-6">
            ${mapOrderHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTeamDropdown(teamNum, teams) {
  const dropdown = document.getElementById(`team${teamNum}Dropdown`);
    if (!dropdown) return;
    
    if (teams.length === 0) {
        dropdown.innerHTML = '<div class="team-search-item-empty">No teams found</div>';
        dropdown.classList.remove('hidden');
        return;
    }
    
    dropdown.innerHTML = teams.map((team, index) => {
        const logo = team.logoUrl || 'https://via.placeholder.com/32?text=🏆';
        const rating = typeof team.rating === 'number' ? team.rating : 1500;
        const hltvBadge = team.isHltv ? '<span class="text-xs bg-purple-600 px-1 rounded ml-2">HLTV</span>' : '';
        
        return `
            <div class="team-search-item" data-team-name="${team.name}" data-index="${index}">
                <img src="${logo}" alt="${team.name}" class="team-search-item-logo" onerror="this.src='https://via.placeholder.com/32?text=🏆'">
                <div class="team-search-item-info">
                    <div class="team-search-item-name">${team.name}${hltvBadge}</div>
                    <div class="team-search-item-rating">Rating: ${rating}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Добавляем обработчики клика
    dropdown.querySelectorAll('.team-search-item').forEach(item => {
        item.addEventListener('click', () => {
            const teamName = item.getAttribute('data-team-name');
            selectTeam(teamNum, teamName);
        });
    });
    
    dropdown.classList.remove('hidden');
}

function updateSelectedItem(teamNum, items) {
    items.forEach((item, index) => {
        if (index === selectedTeamIndex[`team${teamNum}`]) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('selected');
        }
    });
}

async function selectTeam(teamNum, teamName) {
    const searchInput = document.getElementById(`team${teamNum}Search`);
    const dropdown = document.getElementById(`team${teamNum}Dropdown`);
    
    // Находим команду
    const team = allTeamsCache.find(t => t.name === teamName);
    if (!team) return;
    
    // Устанавливаем значение в поле поиска
    if (searchInput) {
        searchInput.value = team.name;
    }
    
    // Скрываем выпадающий список
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
    
    // Загружаем команду
    if (team.isHltv) {
        // Загружаем HLTV команду
        await loadHltvTeamByName(teamNum, teamName);
    } else {
        // Загружаем сохраненную команду
        await loadTeamByName(teamNum, teamName);
    }
}

// On main page load: check if there is a pending match request from tournaments UI
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const raw = localStorage.getItem('pending_match');
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (!payload) return;
    console.log('📨 Pending match payload on main:', payload);
    
    // Load teams directly from localStorage instead of waiting for cache
    const raw_teams = localStorage.getItem('cs_teams');
    const teams = raw_teams ? JSON.parse(raw_teams) : [];
    console.log('📂 Loaded teams from localStorage:', teams.length, 'teams');

    // Team 1
    if (payload.team1Id) {
      let team = teams.find(t => t.id === payload.team1Id);
      if (!team) {
        console.warn('❌ Team1 by id not found, trying by name:', payload.team1Name);
        team = teams.find(t => t.name === payload.team1Name);
      }
      if (team) {
        console.log('✅ Team1 found:', team.name);
        populateTeamDirectly(1, team);
      } else {
        console.error('❌❌ Team1 not found at all! Searched for id:', payload.team1Id, 'and name:', payload.team1Name);
      }
    }

    // Team 2
    if (payload.team2Id) {
      let team = teams.find(t => t.id === payload.team2Id);
      if (!team) {
        console.warn('❌ Team2 by id not found, trying by name:', payload.team2Name);
        team = teams.find(t => t.name === payload.team2Name);
      }
      if (team) {
        console.log('✅ Team2 found:', team.name);
        populateTeamDirectly(2, team);
      } else {
        console.error('❌❌ Team2 not found at all! Searched for id:', payload.team2Id, 'and name:', payload.team2Name);
      }
    }

    console.log('✅ Pending match loaded');
  } catch (e) {
    console.error('❌ Error processing pending_match:', e);
  }
  await loadSavedTeams();
});

// Direct team population - load from localStorage if needed
// Функция для обновления предматчевой статистики
async function updatePreMatchStats() {
  const team1Name = document.getElementById('team1Name')?.value?.trim();
  const team2Name = document.getElementById('team2Name')?.value?.trim();
  const preMatchStats = document.getElementById('preMatchStats');
  
  if (!preMatchStats) return;
  
  // Показываем статистику только если обе команды выбраны
  if (team1Name && team2Name && team1Name !== 'Team A' && team2Name !== 'Team B') {
    preMatchStats.classList.remove('hidden');
    
    // Обновляем названия команд
    document.getElementById('preMatchTeam1Name').textContent = team1Name;
    document.getElementById('preMatchTeam2Name').textContent = team2Name;
    
    // Обновляем логотипы
    const team1Logo = getLogo('team1');
    const team2Logo = getLogo('team2');
    const team1LogoEl = document.getElementById('preMatchTeam1Logo');
    const team2LogoEl = document.getElementById('preMatchTeam2Logo');
    if (team1Logo && team1LogoEl) {
      team1LogoEl.src = team1Logo;
      team1LogoEl.style.display = 'block';
    }
    if (team2Logo && team2LogoEl) {
      team2LogoEl.src = team2Logo;
      team2LogoEl.style.display = 'block';
    }
    
    // Рассчитываем шансы на победу по формуле (на основе рейтинга и head-to-head)
    let team1Chance = 50;
    let team2Chance = 50;
    try {
      const calculatedChances = await calculateWinChances(team1Name, team2Name);
      team1Chance = Number.isFinite(calculatedChances.team1) ? calculatedChances.team1 : 50;
      team2Chance = Number.isFinite(calculatedChances.team2) ? calculatedChances.team2 : 50;
    } catch (error) {
      console.error('updatePreMatchStats: win chance calc failed, fallback to 50/50', error);
    }
    
    // Обновляем прогресс-бары
    document.getElementById('preMatchTeam1Bar').style.width = `${team1Chance}%`;
    document.getElementById('preMatchTeam2Bar').style.width = `${team2Chance}%`;
    document.getElementById('preMatchChanceText').textContent = `${team1Chance}% - ${team2Chance}%`;
    
    // Обновляем поля ввода (можно редактировать)
    const team1ChanceInput = document.getElementById('team1Chance');
    const team2ChanceInput = document.getElementById('team2Chance');
    if (team1ChanceInput && !team1ChanceInput.matches(':focus')) team1ChanceInput.value = team1Chance;
    if (team2ChanceInput && !team2ChanceInput.matches(':focus')) team2ChanceInput.value = team2Chance;
    
    // Обновляем составы (выполняем даже если расчет шансов не удался)
    updatePreMatchLineups();
    
    // Загружаем дополнительную статистику (история матчей, head-to-head и т.д.)
    await loadPreMatchAdditionalStats(team1Name, team2Name);
  } else {
    preMatchStats.classList.add('hidden');
  }
}

// Глобальные переменные для выбранных игроков
let selectedPlayer1 = null;
let selectedPlayer2 = null;

// Обновление составов команд
function updatePreMatchLineups() {
  const team1Players = [];
  const team2Players = [];
  
  document.querySelectorAll('#team1Players > div').forEach(div => {
    const name = div.children[0]?.value?.trim();
    const rating = parseFloat(div.children[1]?.value) || 0;
    const photoUrl = div.children[2]?.value?.trim() || '';
    if (name) {
      team1Players.push({ name, rating, photoUrl, team: 'team1' });
    }
  });
  
  document.querySelectorAll('#team2Players > div').forEach(div => {
    const name = div.children[0]?.value?.trim();
    const rating = parseFloat(div.children[1]?.value) || 0;
    const photoUrl = div.children[2]?.value?.trim() || '';
    if (name) {
      team2Players.push({ name, rating, photoUrl, team: 'team2' });
    }
  });
  
  const team1List = document.getElementById('preMatchTeam1PlayersList');
  const team2List = document.getElementById('preMatchTeam2PlayersList');
  
  // Выбираем игроков по умолчанию — самый высокий рейтинг в каждой команде
  if (!selectedPlayer1 && team1Players.length > 0) {
    const p = [...team1Players].sort((a, b) => b.rating - a.rating)[0];
    selectedPlayer1 = { name: p.name, team: 'team1', rating: p.rating, photoUrl: p.photoUrl };
  }
  if (!selectedPlayer2 && team2Players.length > 0) {
    const p = [...team2Players].sort((a, b) => b.rating - a.rating)[0];
    selectedPlayer2 = { name: p.name, team: 'team2', rating: p.rating, photoUrl: p.photoUrl };
  }

  // Новый рендер блоков lineups
  const container = document.getElementById('lineupsContainer');

  function renderPlayerCard(p, idx, sideColor, selected) {
    const borderClass = selected ? `ring-2 ${sideColor === 'blue' ? 'ring-blue-500' : 'ring-purple-500'}` : 'ring-1 ring-gray-700';
    const nameColor = selected ? (sideColor === 'blue' ? 'text-blue-200' : 'text-purple-200') : 'text-white';
    const flag = ''; // флагов нет в данных, оставляем пустым
    return `
      <div class="flex flex-col items-center bg-gray-800/60 rounded-xl p-3 ${borderClass} shadow-md transition hover:-translate-y-1 hover:shadow-lg cursor-pointer"
           onclick="selectPlayerForCompare('${p.name}', '${p.team}', ${p.rating}, '${p.photoUrl || ''}')">
        ${p.photoUrl ? `<img src="${p.photoUrl}" class="w-14 h-14 rounded-lg object-cover mb-2" onerror="this.style.display='none'">`
          : `<div class="w-14 h-14 rounded-lg bg-gray-700 flex items-center justify-center text-lg text-white mb-2">${p.name.charAt(0).toUpperCase()}</div>`}
        <div class="flex items-center gap-1 text-xs text-gray-300">${flag}<span>${p.name}</span></div>
        <div class="text-[11px] text-gray-400">Rating ${p.rating.toFixed(2)}</div>
        ${selected ? `<div class="mt-1 text-[10px] ${sideColor === 'blue' ? 'text-blue-300' : 'text-purple-300'} font-semibold">Selected</div>` : ''}
        </div>
    `;
  }

  function renderTeamRow(teamName, players, sideColor) {
    return `
      <div class="bg-gray-900/70 border border-gray-800 rounded-2xl p-4 shadow-inner">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm text-white">${teamName ? teamName.charAt(0).toUpperCase() : '?'}</div>
            <div>
              <div class="text-sm font-semibold text-white">${teamName || 'Team'}</div>
              <div class="text-[11px] text-gray-400">Rating preview</div>
      </div>
          </div>
          <div class="text-[11px] text-gray-400">Lineup</div>
        </div>
        <div class="grid grid-cols-5 gap-3">
          ${players.map((p, idx) => renderPlayerCard(p, idx, sideColor, (sideColor === 'blue' ? selectedPlayer1 : selectedPlayer2)?.name === p.name)).join('')}
        </div>
      </div>
    `;
  }

  // Сохраняем ссылку на секцию сравнения, чтобы не потерять при перерисовке
  const compareSection = document.getElementById('playerComparisonSection');

  if (container) {
    const team1Title = document.getElementById('team1Name')?.value?.trim() || 'Team 1';
    const team2Title = document.getElementById('team2Name')?.value?.trim() || 'Team 2';
    container.innerHTML = `
      ${renderTeamRow(team1Title, team1Players, 'blue')}
      <div id="lineupsCompareAnchor"></div>
      ${renderTeamRow(team2Title, team2Players, 'purple')}
    `;
  }

  // Переносим блок сравнения внутрь lineups между составами (после перерисовки контейнера)
  const containerEl = document.getElementById('lineupsContainer');
  const anchor = document.getElementById('lineupsCompareAnchor');
  if (compareSection && containerEl) {
    if (anchor) {
      anchor.replaceWith(compareSection);
    } else {
      // если по какой-то причине якорь не создался — просто добавим в конец
      containerEl.appendChild(compareSection);
    }
  }

  // Показываем/скрываем секцию сравнения
  if (compareSection) {
    compareSection.classList.remove('hidden');
    compareSection.style.display = 'block';
    // Всегда перерендерим (если игроков нет, покажем подсказку)
    setTimeout(() => renderPlayerComparison(), 30);
  }
}

// Выбор игрока для сравнения
function selectPlayerForCompare(playerName, team, rating, photoUrl) {
  // Оставляем только смену выбора, без снятия — чтобы блок сравнения не пропадал
  if (team === 'team1') {
    selectedPlayer1 = { name: playerName, team, rating, photoUrl };
  } else {
    selectedPlayer2 = { name: playerName, team, rating, photoUrl };
  }
  updatePreMatchLineups();
  // Мгновенно перерендерим сравнение, чтобы не было пустого состояния
  renderPlayerComparison();
}

function formatStatNumber(value, digits = 2) {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(digits);
}

async function getPlayerAggregatedStats(playerName) {
  try {
    const teams = await loadAllTeamsForCompare();
    let totalMatches = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAdr = 0;
    let adrCount = 0;
    let totalAssists = 0;

    (teams || []).forEach(team => {
      if (!team || !Array.isArray(team.history)) return;
      team.history.forEach(match => {
        if (!match || !Array.isArray(match.playerStats)) return;
        const ps = match.playerStats.find(p => (p.name || '').toLowerCase().trim() === playerName.toLowerCase().trim());
        if (!ps) return;
        totalMatches += 1;
        const ratingVal = typeof ps.rating2 === 'number' ? ps.rating2 : parseFloat(ps.rating2) || 1.0;
        ratingSum += ratingVal;
        ratingCount += 1;
        totalKills += ps.kills || 0;
        totalDeaths += ps.deaths || 0;
        const adrVal = parseFloat(ps.adr);
        if (Number.isFinite(adrVal) && adrVal > 0) {
          totalAdr += adrVal;
          adrCount += 1;
        }
        totalAssists += ps.assists || 0;
      });
    });

    const avgRating = ratingCount > 0 ? ratingSum / ratingCount : 0;
    const totalRounds = totalMatches * 24;
    const kpr = totalRounds > 0 ? totalKills / totalRounds : 0;
    const dpr = totalRounds > 0 ? totalDeaths / totalRounds : 0;
    const adr = adrCount > 0 ? totalAdr / adrCount : 0;
    const kast = totalRounds > 0 ? Math.min(100, ((totalKills + totalAssists) / totalRounds) * 100) : 0;

    return { rating: avgRating, kpr, dpr, adr, kast, totalMatches };
  } catch (e) {
    console.warn('getPlayerAggregatedStats fallback for', playerName, e);
    return { rating: 0, kpr: 0, dpr: 0, adr: 0, kast: 0, totalMatches: 0 };
  }
}

function renderCenteredMetricRow(label, left, right) {
  return `
    <div class="flex items-center justify-center gap-4 text-sm text-white">
      <span class="font-semibold text-blue-200">${left}</span>
      <span class="text-gray-400 uppercase tracking-wide text-xs">${label}</span>
      <span class="font-semibold text-purple-200">${right}</span>
    </div>
  `;
}

// Рендеринг сравнения игроков на странице (не модальное окно)
async function renderPlayerComparison() {
  const content = document.getElementById('playerComparisonContent');
  if (!content) return;

  // Если нет выбранных двух игроков — показываем подсказку, но блок не скрываем
  if (!selectedPlayer1 || !selectedPlayer2) {
    content.innerHTML = `
      <div class="w-full flex flex-col items-center justify-center py-8 text-center text-gray-400 text-sm">
        Select one player from each team to compare
      </div>
    `;
    return;
  }

  try {
    const player1Stats = await getPlayerAggregatedStats(selectedPlayer1.name);
    const player2Stats = await getPlayerAggregatedStats(selectedPlayer2.name);

    const player1Rating = Number.isFinite(player1Stats.rating) ? player1Stats.rating : (selectedPlayer1.rating || 0);
    const player2Rating = Number.isFinite(player2Stats.rating) ? player2Stats.rating : (selectedPlayer2.rating || 0);
    const player1KPR = formatStatNumber(player1Stats.kpr);
    const player2KPR = formatStatNumber(player2Stats.kpr);
    const player1DPR = formatStatNumber(player1Stats.dpr);
    const player2DPR = formatStatNumber(player2Stats.dpr);
    const player1Kast = formatStatNumber(player1Stats.kast, 1);
    const player2Kast = formatStatNumber(player2Stats.kast, 1);
    const player1Adr = Math.round(player1Stats.adr || 0);
    const player2Adr = Math.round(player2Stats.adr || 0);
    const player1Matches = player1Stats.totalMatches || 0;
    const player2Matches = player2Stats.totalMatches || 0;

    content.innerHTML = `
      <div class="w-full max-w-5xl mx-auto px-4 py-4">
        <div class="grid grid-cols-3 gap-6 items-center">
          <!-- Left player -->
          <div class="flex flex-col items-center">
            <div class="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-blue-500/10 border-2 border-blue-500/40 shadow-lg overflow-hidden flex items-center justify-center mb-3">
              ${
                selectedPlayer1.photoUrl
                  ? `<img src="${selectedPlayer1.photoUrl}" class="w-full h-full object-cover" onerror="this.style.display='none'">`
                  : `<div class="w-full h-full flex items-center justify-center text-4xl font-bold text-blue-300">${selectedPlayer1.name.charAt(0).toUpperCase()}</div>`
              }
            </div>
            <div class="text-lg font-bold text-white mb-1">${selectedPlayer1.name}</div>
            <div class="text-[11px] uppercase tracking-wide text-blue-300">Rating ${formatStatNumber(player1Rating)}</div>
            <a href="player-profile.html?player=${encodeURIComponent(selectedPlayer1.name)}"
               class="mt-3 px-4 py-1.5 rounded-full border border-blue-500/40 text-[11px] text-blue-200 hover:bg-blue-500/10 transition">
              Player profile
            </a>
          </div>

          <!-- Center stats -->
          <div class="space-y-2 text-center">
            <div class="text-xs uppercase tracking-[0.2em] text-gray-400">HIGHLIGHTED STATS</div>
            <div class="text-[11px] text-gray-500 mb-2">(Past 3 months)</div>

            ${renderCenteredMetricRow('RATING', formatStatNumber(player1Rating), formatStatNumber(player2Rating))}
            ${renderCenteredMetricRow('KILLS PER ROUND', player1KPR, player2KPR)}
            ${renderCenteredMetricRow('DEATHS PER ROUND', player1DPR, player2DPR)}
            ${renderCenteredMetricRow('KAST', `${player1Kast}%`, `${player2Kast}%`)}
            ${renderCenteredMetricRow('ROUND SWING', '+0.00%', '+0.00%')}
            ${renderCenteredMetricRow('AVERAGE DAMAGE PER ROUND', player1Adr, player2Adr)}

            <button type="button"
                    class="mt-3 inline-flex items-center justify-center px-4 py-2 rounded-full bg-gray-800/80 border border-gray-700 text-[12px] font-medium text-gray-200 hover:bg-gray-700 transition">
              Full comparison
            </button>
          </div>

          <!-- Right player -->
          <div class="flex flex-col items-center">
            <div class="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-purple-500/10 border-2 border-purple-500/40 shadow-lg overflow-hidden flex items-center justify-center mb-3">
              ${
                selectedPlayer2.photoUrl
                  ? `<img src="${selectedPlayer2.photoUrl}" class="w-full h-full object-cover" onerror="this.style.display='none'">`
                  : `<div class="w-full h-full flex items-center justify-center text-4xl font-bold text-purple-300">${selectedPlayer2.name.charAt(0).toUpperCase()}</div>`
              }
            </div>
            <div class="text-lg font-bold text-white mb-1">${selectedPlayer2.name}</div>
            <div class="text-[11px] uppercase tracking-wide text-purple-300">Rating ${formatStatNumber(player2Rating)}</div>
            <a href="player-profile.html?player=${encodeURIComponent(selectedPlayer2.name)}"
               class="mt-3 px-4 py-1.5 rounded-full border border-purple-500/40 text-[11px] text-purple-200 hover:bg-purple-500/10 transition">
              Player profile
            </a>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('renderPlayerComparison error, using minimal fallback', e);
    const r1 = selectedPlayer1.rating || 0;
    const r2 = selectedPlayer2.rating || 0;
    content.innerHTML = `
      <div class="flex items-center justify-center gap-3 text-lg font-semibold text-white text-center">
        <span class="text-blue-200">${selectedPlayer1.name}</span>
        <span class="text-gray-400">${(r1.toFixed ? r1.toFixed(2) : r1)} rating ${(r2.toFixed ? r2.toFixed(2) : r2)}</span>
        <span class="text-purple-200">${selectedPlayer2.name}</span>
      </div>
    `;
  }
}

// Функция расчета Round Swing
function calculateRoundSwing(playerStats) {
  if (!playerStats) return '0.00%';
  
  const kd = parseFloat(playerStats.kd_ratio) || 0;
  const adr = parseFloat(playerStats.avg_adr) || 0;
  const totalMatches = playerStats.total_matches || 0;
  const totalRounds = totalMatches * 24;
  const totalAssists = playerStats.total_assists || 0;
  
  const kdImpact = kd > 1 ? Math.min((kd - 1) * 0.3, 0.5) : (kd < 1 ? (kd - 1) * 0.4 : 0);
  const adrImpact = adr > 75 ? Math.min((adr - 75) / 100, 0.2) : (adr < 60 ? (adr - 60) / 200 : 0);
  const assistImpact = totalAssists > 0 && totalRounds > 0 ? Math.min((totalAssists / totalRounds) * 0.1, 0.15) : 0;
  
  const swing = (kdImpact + adrImpact + assistImpact) * 100;
  return swing >= 0 ? `+${swing.toFixed(2)}%` : `${swing.toFixed(2)}%`;
}

function openFullPlayerComparison() {
  // Открываем полное сравнение (можно расширить позже)
  alert('Полное сравнение будет доступно в следующей версии');
}

// Загрузка статистики игрока для сравнения (fallback функция)
async function fetchPlayerStatsForCompare(playerName) {
  try {
    // Загружаем команды
    const allTeams = await loadAllTeamsForCompare();
    
    // Агрегируем статистику вручную (аналогично player-profile.js)
    let totalMatches = 0;
    let wins = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAdr = 0;
    let adrCount = 0;
    let mvpCount = 0;
    let totalRounds = 0;
    let roundsWithKillOrAssist = 0;
    
    allTeams.forEach(team => {
      if (!Array.isArray(team.history)) return;
      
      team.history.forEach(match => {
        if (!Array.isArray(match.playerStats)) return;
        
        const playerStat = match.playerStats.find(p => 
          (p.name || '').toLowerCase().trim() === playerName.toLowerCase().trim()
        );
        
        if (playerStat) {
          totalMatches++;
          const rating = typeof playerStat.rating2 === 'number' ? playerStat.rating2 : parseFloat(playerStat.rating2) || 1.0;
          ratingSum += rating;
          ratingCount++;
          
          totalKills += playerStat.kills || 0;
          totalDeaths += playerStat.deaths || 0;
          
          const adr = parseFloat(playerStat.adr);
          if (!isNaN(adr) && adr > 0) {
            totalAdr += adr;
            adrCount++;
          }
          
          // Примерно 24 раунда за матч для расчета KAST
          const rounds = 24;
          totalRounds += rounds;
          const kastRounds = Math.min((playerStat.kills || 0) + (playerStat.assists || 0), rounds);
          roundsWithKillOrAssist += kastRounds;
          
          if (match.result === 'Win') wins++;
          
          // Проверяем MVP
          if (match.mvp && (match.mvp.name || '').toLowerCase().trim() === playerName.toLowerCase().trim()) {
            mvpCount++;
          }
        }
      });
    });
    
    const avgRating = ratingCount > 0 ? (ratingSum / ratingCount) : 0;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
    const kdRatio = totalDeaths > 0 ? (totalKills / totalDeaths) : (totalKills > 0 ? totalKills : 0);
    const avgAdr = adrCount > 0 ? (totalAdr / adrCount) : 0;
    
    // KAST расчет
    const baseKast = totalRounds > 0 ? (roundsWithKillOrAssist / totalRounds) * 100 : 0;
    const survivalBonus = totalDeaths > 0 ? Math.min(((totalKills - totalDeaths) / totalRounds) * 50, 20) : 0;
    const kast = Math.min(baseKast + survivalBonus, 100);
    
    // Round Swing (упрощенный расчет)
    const kdImpact = kdRatio > 1 ? Math.min((kdRatio - 1) * 0.3, 0.5) : (kdRatio < 1 ? (kdRatio - 1) * 0.4 : 0);
    const adrImpact = avgAdr > 75 ? Math.min((avgAdr - 75) / 100, 0.2) : (avgAdr < 60 ? (avgAdr - 60) / 200 : 0);
    const swing = Math.max(0, Math.abs(kdImpact + adrImpact) - 0.3) * 100;
    const swingDisplay = (kdImpact + adrImpact) > 0 ? `+${swing.toFixed(2)}` : `-${swing.toFixed(2)}`;
    
    return {
      avgRating: avgRating,
      totalMatches: totalMatches,
      totalKills: totalKills,
      totalDeaths: totalDeaths,
      winRate: winRate,
      kdRatio: kdRatio.toFixed(2),
      avgAdr: Math.round(avgAdr),
      mvpCount: mvpCount,
      kast: kast.toFixed(1),
      swing: swingDisplay
    };
  } catch (error) {
    console.error('Error fetching player stats for compare:', error);
    return {
      avgRating: 0,
      totalMatches: 0,
      totalKills: 0,
      totalDeaths: 0,
      winRate: 0,
      kdRatio: '0.00',
      avgAdr: 0,
      mvpCount: 0,
      kast: '0.0',
      swing: '0.00'
    };
  }
}

// Функция для загрузки всех команд (если не определена)
async function loadAllTeamsForCompare() {
  if (typeof window.readSavedTeams === 'function') {
    return await window.readSavedTeams();
  }
  if (window.csApi && window.csApi.fetchTeams) {
    return await window.csApi.fetchTeams();
  }
  const raw = localStorage.getItem('cs_teams');
  return JSON.parse(raw || '[]');
}

// Функция для показа деталей матча head-to-head (заглушка)
function showHeadToHeadMatchDetails(team1Name, opponentName, matchDate) {
  // Можно расширить позже для показа деталей матча
  console.log('Head-to-head match details:', { team1Name, opponentName, matchDate });
}

// Делаем функции глобальными
window.selectPlayerForCompare = selectPlayerForCompare;
window.renderPlayerComparison = renderPlayerComparison;
window.openFullPlayerComparison = openFullPlayerComparison;
window.showHeadToHeadMatchDetails = showHeadToHeadMatchDetails;

// Функция расчета шансов на победу на основе рейтинга и head-to-head
async function calculateWinChances(team1Name, team2Name) {
  try {
    const savedTeams = await readSavedTeams();
    const team1 = savedTeams.find(t => t.name === team1Name);
    const team2 = savedTeams.find(t => t.name === team2Name);
    
    if (!team1 || !team2) {
      return { team1: 50, team2: 50 };
    }
    
    // Получаем рейтинги команд
    const rating1 = typeof team1.rating === 'number' ? team1.rating : 1500;
    const rating2 = typeof team2.rating === 'number' ? team2.rating : 1500;
    
    // Базовый расчет на основе рейтинга (Elo-подобная формула с еще меньшим влиянием)
    // Используем еще больший делитель (1200 вместо 800) для более плавного влияния рейтинга
    // Вероятность победы команды 1 = 1 / (1 + 10^((rating2 - rating1) / 1200))
    const ratingDiff = rating2 - rating1;
    const expectedScore1 = 1 / (1 + Math.pow(10, ratingDiff / 1200));
    let team1Chance = Math.round(expectedScore1 * 100);
    
    // Корректировка на основе head-to-head встреч (40% веса)
    const headToHead = [];
    if (team1.history && Array.isArray(team1.history)) {
      team1.history.forEach(match => {
        if (match.opponent === team2Name || match.opponent === team2.name) {
          headToHead.push({ ...match, team: team1Name });
        }
      });
    }
    
    if (headToHead.length > 0) {
      const team1Wins = headToHead.filter(m => m.result === 'Win').length;
      const team2Wins = headToHead.length - team1Wins;
      const h2hWinRate = team1Wins / headToHead.length; // 0-1
      
      // Корректировка: если head-to-head показывает другую тенденцию, корректируем на 40%
      const h2hAdjustment = (h2hWinRate - 0.5) * 12; // от -6% до +6%
      team1Chance = Math.round(team1Chance * 0.6 + (team1Chance + h2hAdjustment) * 0.4);
    }
    
    // Ограничиваем значения от 5% до 95%
    team1Chance = Math.max(5, Math.min(95, team1Chance));
    const team2Chance = 100 - team1Chance;
    
    return { team1: team1Chance, team2: team2Chance };
  } catch (error) {
    console.error('Error calculating win chances:', error);
    return { team1: 50, team2: 50 };
  }
}

// Вспомогательная функция для нормализации имен
function normalizeName(name) {
  return (name || '').toLowerCase().trim();
}

// Загрузка дополнительной статистики (история матчей, head-to-head)
async function loadPreMatchAdditionalStats(team1Name, team2Name) {
  const statsDiv = document.getElementById('preMatchAdditionalStats');
  if (!statsDiv) return;
  
  try {
    // Загружаем команды из базы
    const savedTeams = await readSavedTeams();
    const team1 = savedTeams.find(t => t.name === team1Name);
    const team2 = savedTeams.find(t => t.name === team2Name);
    
    if (!team1 || !team2) {
      statsDiv.innerHTML = '<div class="text-gray-400">Статистика недоступна</div>';
      return;
    }
    
    // Находим личные встречи
    const headToHead = [];
    if (team1.history && Array.isArray(team1.history)) {
      team1.history.forEach(match => {
        if (match.opponent === team2Name || match.opponent === team2.name) {
          headToHead.push({ ...match, team: team1Name });
        }
      });
    }
    
    // Сортируем по дате (новые сверху)
    headToHead.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
    
    let statsHtml = '<div class="space-y-4">';
    
    // Head to Head с конкретными счетами (для обеих команд)
    if (headToHead.length > 0) {
      const team1Wins = headToHead.filter(m => m.result === 'Win').length;
      const team2Wins = headToHead.length - team1Wins;
      
      // Получаем логотипы команд
      const team1Logo = team1?.logoUrl || '';
      const team2Logo = team2?.logoUrl || '';
      
      statsHtml += `
        <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
          <h4 class="text-lg font-semibold mb-3 text-gray-300">Head to head</h4>
          <div class="text-sm text-gray-400 mb-4">
            ${team1Name}: ${team1Wins} wins, ${team2Name}: ${team2Wins} wins
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-700">
                  <th class="text-left p-2 text-gray-400">Дата</th>
                  <th class="text-center p-2 text-gray-400">Команды</th>
                  <th class="text-center p-2 text-gray-400">Счёт</th>
                  <th class="text-center p-2 text-gray-400">Победитель</th>
                </tr>
              </thead>
              <tbody>
                ${headToHead.map(match => {
                  const dateDisplay = match.date ? new Date(match.date).toLocaleDateString('ru-RU') : 'N/A';
                  const score = match.score || 'N/A';
                  
                  // Определяем победителя на основе счета
                  let winner = '';
                  let winnerClass = '';
                  if (match.result === 'Win') {
                    winner = team1Name;
                    winnerClass = 'text-green-400';
                  } else if (match.result === 'Loss') {
                    winner = team2Name;
                    winnerClass = 'text-green-400';
                  } else {
                    winner = 'Ничья';
                    winnerClass = 'text-yellow-400';
                  }
                  
                  const team1LogoHtml = team1Logo 
                    ? `<img src="${team1Logo}" class="w-5 h-5 rounded inline-block" alt="${team1Name}" onerror="this.style.display='none';">`
                    : '';
                  const team2LogoHtml = team2Logo 
                    ? `<img src="${team2Logo}" class="w-5 h-5 rounded inline-block" alt="${team2Name}" onerror="this.style.display='none';">`
                    : '';
                  
                  return `
                    <tr class="border-b border-gray-700/50 hover:bg-gray-700/30 transition cursor-pointer" onclick="showHeadToHeadMatchDetails('${team1Name}', '${team2Name}', '${match.date || ''}')">
                      <td class="p-3 text-gray-400">${dateDisplay}</td>
                      <td class="p-3">
                        <div class="flex items-center justify-center gap-3">
                          <div class="flex items-center gap-1">
                            ${team1LogoHtml}
                            <span class="text-white font-semibold text-xs">${team1Name}</span>
                          </div>
                          <span class="text-gray-500">VS</span>
                          <div class="flex items-center gap-1">
                            ${team2LogoHtml}
                            <span class="text-white font-semibold text-xs">${team2Name}</span>
                          </div>
                        </div>
                      </td>
                      <td class="p-3 text-center font-mono font-semibold text-white text-lg">${score}</td>
                      <td class="p-3 text-center">
                        <span class="${winnerClass} font-bold">${winner}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      statsHtml += `
        <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
          <h4 class="text-lg font-semibold mb-2 text-gray-300">Head to head</h4>
          <div class="text-sm text-gray-400">Нет личных встреч</div>
        </div>
      `;
    }
    
    statsHtml += '</div>';
    statsDiv.innerHTML = statsHtml;
  } catch (error) {
    console.error('Error loading pre-match stats:', error);
    statsDiv.innerHTML = '<div class="text-red-400">Ошибка загрузки статистики</div>';
  }
}

function populateTeamDirectly(teamNum, team) {
  try {
    console.log(`🔧 Populating team${teamNum}:`, team.name);
    document.getElementById(`team${teamNum}Name`).value = team.name;
    document.getElementById(`team${teamNum}LogoUrl`).value = team.logoUrl || '';
    const preview = document.getElementById(`team${teamNum}LogoPreview`);
    if (preview) preview.src = team.logoUrl || '';
    
    const activePlayers = team.players && Array.isArray(team.players)
      ? team.players.filter(p => p.status !== 'benched')
      : [];
    
    const playerContainer = document.getElementById(`team${teamNum}Players`);
    if (!playerContainer) {
      console.warn(`Player container not found for team${teamNum}`);
      return;
    }
    const divs = playerContainer.querySelectorAll('div');
    divs.forEach((div, index) => {
      if (activePlayers[index]) {
        div.children[0].value = activePlayers[index].name || '';
        div.children[1].value = activePlayers[index].rating ?? '';
        if (div.children[2]) div.children[2].value = activePlayers[index].photoUrl || '';
      } else {
        div.children[0].value = '';
        div.children[1].value = '';
        if (div.children[2]) div.children[2].value = '';
      }
    });
    console.log(`✅ Team${teamNum} populated:`, team.name);
    
    // Обновляем предматчевую статистику после загрузки команды
    setTimeout(() => updatePreMatchStats(), 100);
  } catch (e) {
    console.error(`Error populating team${teamNum}:`, e);
  }
}

// Load team by id and populate form (used when selectTeam by name fails)
async function loadTeamById(teamNum, teamId) {
  try {
    const savedTeams = await readSavedTeams();
    const team = savedTeams.find(t => t.id === teamId);
    if (!team) {
      console.warn('loadTeamById: team not found', teamId);
      return;
    }
    document.getElementById(`team${teamNum}Name`).value = team.name;
    document.getElementById(`team${teamNum}LogoUrl`).value = team.logoUrl || '';
    const preview = document.getElementById(`team${teamNum}LogoPreview`);
    if (preview) preview.src = team.logoUrl || '';

    const activePlayers = team.players && Array.isArray(team.players)
      ? team.players.filter(p => p.status !== 'benched')
      : [];
    const playerContainer = document.getElementById(`team${teamNum}Players`);
    playerContainer.querySelectorAll('div').forEach((div, index) => {
      if (activePlayers[index]) {
        div.children[0].value = activePlayers[index].name || '';
        div.children[1].value = activePlayers[index].rating ?? '';
        if (div.children[2]) div.children[2].value = activePlayers[index].photoUrl || '';
      } else {
        div.children[0].value = '';
        div.children[1].value = '';
        if (div.children[2]) div.children[2].value = '';
      }
    });
    console.log('loadTeamById: populated team slot', teamNum, team.name);
  } catch (e) {
    console.error('Error in loadTeamById', e);
  }
}

// Helper: report match result to tournaments UI via localStorage
// result: { tournamentId, matchId, team1Score, team2Score, winnerId }
window.reportMatchResult = function(result) {
  if (!result || !result.tournamentId || !result.matchId) throw new Error('Invalid result');
  localStorage.setItem('last_played_match_result', JSON.stringify(result));
  // Optionally remove pending_match
  localStorage.removeItem('pending_match');
  alert('Результат матча отправлен в турнирную систему. Вернитесь в Турниры.');
};

async function loadTeamByName(teamNum, teamName) {
    const savedTeams = await readSavedTeams();
    const team = savedTeams.find(t => t.name === teamName);
    if (!team) return;
    
    document.getElementById(`team${teamNum}Name`).value = team.name;
    document.getElementById(`team${teamNum}LogoUrl`).value = team.logoUrl || '';
    
    const countrySelect = document.getElementById(`team${teamNum}Country`);
    if (countrySelect && team.country) {
        countrySelect.value = team.country;
    }
    
    const preview = document.getElementById(`team${teamNum}LogoPreview`);
    if (preview) preview.src = team.logoUrl || '';
    
    // Фильтруем только активных игроков (не BENCHED)
    const activePlayers = team.players && Array.isArray(team.players) 
      ? team.players.filter(p => p.status !== 'benched')
      : [];
    
    const playerContainer = document.getElementById(`team${teamNum}Players`);
    playerContainer.querySelectorAll('div').forEach((div, index) => {
        if (activePlayers[index]) {
            div.children[0].value = activePlayers[index].name || '';
            div.children[1].value = activePlayers[index].rating ?? '';
            if (div.children[2]) div.children[2].value = activePlayers[index].photoUrl || '';
        } else {
            div.children[0].value = '';
            div.children[1].value = '';
            if (div.children[2]) div.children[2].value = '';
        }
    });
    
    // Обновляем предматчевую статистику после загрузки команды
    setTimeout(() => updatePreMatchStats(), 100);
}

async function loadHltvTeamByName(teamNum, teamName) {
    const team = hltvTeams.find(t => t.name === teamName);
    if (!team) return;
    
    document.getElementById(`team${teamNum}Name`).value = team.name;
    document.getElementById(`team${teamNum}LogoUrl`).value = team.logoUrl;
    const preview = document.getElementById(`team${teamNum}LogoPreview`);
    if (preview) preview.src = team.logoUrl;
    
    // Фильтруем только активных игроков (не BENCHED)
    const activePlayers = team.players && Array.isArray(team.players)
      ? team.players.filter(p => p.status !== 'benched')
      : [];
    
    const playerContainer = document.getElementById(`team${teamNum}Players`);
    playerContainer.querySelectorAll('div').forEach((div, index) => {
        if (activePlayers[index]) {
            div.children[0].value = activePlayers[index].name;
            div.children[1].value = activePlayers[index].rating;
        } else {
            div.children[0].value = '';
            div.children[1].value = '';
        }
    });
}

// Сохранение команды: НЕ стираем history или rating, если команда существует
async function saveTeam(teamNum) {
    const teamName = document.getElementById(`team${teamNum}Name`).value.trim() || `Team ${teamNum === 1 ? 'A' : 'B'}`;
    const logoUrl = document.getElementById(`team${teamNum}LogoUrl`).value.trim();
    const country = document.getElementById(`team${teamNum}Country`).value.trim();
    const region = country ? getRegionByCountry(country) : '';
    
    // собираем игроков (включая фото)
    const players = [];
    const savedTeams = await readSavedTeams();
    const existingTeam = savedTeams.find(t => t.name === teamName);
    
    for (const div of document.querySelectorAll(`#team${teamNum}Players > div`)) {
        const name = div.children[0].value.trim();
        const rating = parseFloat(div.children[1].value);
        const photoUrl = (div.children[2]?.value || '').trim();
        if (name && !isNaN(rating)) {
            // Сохраняем существующий статус игрока, если команда уже существует
            const existingPlayer = existingTeam?.players?.find(p => p.name === name);
            players.push({ 
                name, 
                rating, 
                photoUrl,
                status: existingPlayer?.status || 'active'
            });
        }
    }

    if (players.length !== 5) {
        alert('Each team must have exactly 5 players with valid names and ratings!');
        return;
    }

    // Слияние с existing players: сохраняем BENCHED игроков, которых нет в форме
    const mergedPlayers = mergePlayersWithBench(existingTeam?.players || [], players);

    if (window.csApi) {
      const currentTeams = await readSavedTeams();
      const existing = currentTeams.find(t => t.name === teamName);
      const teamData = existing 
        ? { ...existing, logoUrl: logoUrl || existing.logoUrl || '', players: mergedPlayers, country, region } 
        : { name: teamName, logoUrl: logoUrl || '', players: mergedPlayers, country, region, rating: 1500, history: [] };
      console.log('Saving team to Supabase:', teamData);
      await window.csApi.upsertTeam(teamData);
      const saved = await window.csApi.getTeamByName(teamName);
      console.log('Saved team from Supabase:', saved);
    } else {
        const savedTeams = await readSavedTeams();
        const existingIndex = savedTeams.findIndex(t => t.name === teamName);
        let teamData;
        if (existingIndex !== -1) {
            const existing = savedTeams[existingIndex];
        teamData = { 
          ...existing, 
          id: existing.id || 'team_' + teamName.replace(/\s+/g, '_').toLowerCase(),
          name: teamName, 
          logoUrl: logoUrl || existing.logoUrl || '', 
          players: mergedPlayers,
          country,
          region
        };
            savedTeams[existingIndex] = teamData;
        } else {
            teamData = { 
              id: 'team_' + teamName.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now(),
              name: teamName, 
              logoUrl: logoUrl || '', 
          players: mergedPlayers, 
              country,
              region,
              rating: 1500, 
              history: [] 
            };
            savedTeams.push(teamData);
        }
        await writeSavedTeams(savedTeams);
    }
    await loadSavedTeams();
        
    alert(`Team ${teamName} saved!`);
}

// Загрузка команды в форму
async function loadTeam(teamNum) {
    const select = document.getElementById(`team${teamNum}Load`);
    if (!select) return;
    const teamName = select.value;
    if (!teamName) return;
    const savedTeams = await readSavedTeams();
    const team = savedTeams.find(t => t.name === teamName);
    if (!team) return;

    document.getElementById(`team${teamNum}Name`).value = team.name;
    document.getElementById(`team${teamNum}LogoUrl`).value = team.logoUrl || '';
    const preview = document.getElementById(`team${teamNum}LogoPreview`);
    if (preview) preview.src = team.logoUrl || '';

    const playerContainer = document.getElementById(`team${teamNum}Players`);
    playerContainer.querySelectorAll('div').forEach((div, index) => {
        if (team.players[index]) {
            div.children[0].value = team.players[index].name || '';
            div.children[1].value = team.players[index].rating ?? '';
            if (div.children[2]) div.children[2].value = team.players[index].photoUrl || '';
        } else {
            div.children[0].value = '';
            div.children[1].value = '';
            if (div.children[2]) div.children[2].value = '';
        }
    });
}

// HLTV load (не затираем историю, если уже есть)
async function loadHltvTeam(teamNum) {
    const select = document.getElementById(`team${teamNum}HltvLoad`);
    if (!select) return;
    const teamName = select.value;
    if (!teamName) return;
    const team = hltvTeams.find(t => t.name === teamName);
    if (!team) return;

    document.getElementById(`team${teamNum}Name`).value = team.name;
    document.getElementById(`team${teamNum}LogoUrl`).value = team.logoUrl;
    const preview = document.getElementById(`team${teamNum}LogoPreview`);
    if (preview) preview.src = team.logoUrl;

    const playerContainer = document.getElementById(`team${teamNum}Players`);
    playerContainer.querySelectorAll('div').forEach((div, index) => {
        if (team.players[index]) {
            div.children[0].value = team.players[index].name;
            div.children[1].value = team.players[index].rating;
        } else {
            div.children[0].value = '';
            div.children[1].value = '';
        }
    });

    if (window.csApi) {
        const existingTeams = await readSavedTeams();
        const existing = existingTeams.find(t => t.name === team.name);
        const payload = existing ? { ...existing, logoUrl: team.logoUrl, players: team.players } : { name: team.name, logoUrl: team.logoUrl, players: team.players, rating: 1500, history: [] };
        await window.csApi.upsertTeam(payload);
    } else {
        const savedTeams = await readSavedTeams();
        const existingIndex = savedTeams.findIndex(t => t.name === team.name);
        if (existingIndex !== -1) {
            savedTeams[existingIndex] = { ...savedTeams[existingIndex], logoUrl: team.logoUrl, players: team.players };
        } else {
            savedTeams.push({ name: team.name, logoUrl: team.logoUrl, players: team.players, rating: 1500, history: [] });
        }
        await writeSavedTeams(savedTeams);
    }
    await loadSavedTeams();
}

// ---------- РЕЙТИНГИ и ИСТОРИЯ ----------
// Elo расчёт и запись истории — функция безопасная и идемпотентная
function makePlayer(name, rating, photoUrl) {
  return { id: 'p' + Date.now() + Math.floor(Math.random()*1e6), name, rating, photoUrl };
}

function mergePlayersWithBench(existingPlayers = [], currentLineup = []) {
  const result = [];
  const existingMap = new Map();
  existingPlayers.forEach(player => {
    existingMap.set(normalizeName(player.name), { ...player });
  });

  currentLineup.forEach(player => {
    const key = normalizeName(player.name);
    const prev = existingMap.get(key);
    const mergedPlayer = {
      ...(prev || {}),
      ...player,
      status: 'active'
    };
    if (!mergedPlayer.id) {
      const newId = makePlayer(player.name, player.rating, player.photoUrl).id;
      mergedPlayer.id = newId;
    }
    result.push(mergedPlayer);
    if (prev) {
      existingMap.delete(key);
    }
  });

  // Добавляем оставшихся (чаще всего BENCHED)
  existingMap.forEach(player => result.push(player));
  return result;
}

function normalizeName(name) {
  return (name||'').toLowerCase().trim();
}

async function updateTeamRatings(team1Name, team2Name, winnerName, finalScore, playerSeriesRatings, playerSeriesStats, mvpMatchParam, mapSeriesResults = []) {
    console.log('updateTeamRatings called with:', { team1Name, team2Name, winnerName, finalScore, mvpMatchParam });
    
    try {
      const savedTeams = await readSavedTeams();
      console.log('Saved teams count:', savedTeams.length);
      
      const idx1 = savedTeams.findIndex(t => t.name === team1Name);
      const idx2 = savedTeams.findIndex(t => t.name === team2Name);
      
      console.log('Team indices:', { idx1, idx2, team1Name, team2Name });
      
      if (idx1 === -1 || idx2 === -1) {
          console.warn('One or both teams not found when updating ratings:', team1Name, team2Name);
          console.warn('Available teams:', savedTeams.map(t => t.name));
          return;
      }
      const t1 = { ...savedTeams[idx1], history: Array.isArray(savedTeams[idx1].history) ? [...savedTeams[idx1].history] : [] };
      const t2 = { ...savedTeams[idx2], history: Array.isArray(savedTeams[idx2].history) ? [...savedTeams[idx2].history] : [] };
      const kFactor = 32;
      const expected1 = 1 / (1 + Math.pow(10, (t2.rating - t1.rating) / 400));
      const expected2 = 1 - expected1;
      let delta1 = 0, delta2 = 0;
      if (winnerName === team1Name) { delta1 = Math.round(kFactor * (1 - expected1)); delta2 = Math.round(kFactor * (0 - expected2)); }
      else if (winnerName === team2Name) { delta1 = Math.round(kFactor * (0 - expected1)); delta2 = Math.round(kFactor * (1 - expected2)); }
      else { delta1 = Math.round(kFactor * (0.5 - expected1)); delta2 = Math.round(kFactor * (0.5 - expected2)); }
      t1.rating = Math.max(100, Math.round(t1.rating + delta1));
      t2.rating = Math.max(100, Math.round(t2.rating + delta2));

      // Обновление статистики rating2Avg с учётом id и normalizeName (как ранее)
      if (playerSeriesRatings && t1.players) {
          const map1 = playerSeriesRatings.team1 || {};
          t1.players = t1.players.map(p => {
              const keys = Object.keys(map1);
              const statKey = keys.find(k => normalizeName(k) === normalizeName(p.name));
              const r = statKey ? parseFloat(map1[statKey]) : NaN;
              if (!isNaN(r)) {
                  const prevMatches = typeof p.rating2Matches === 'number' ? p.rating2Matches : 0;
                  const prevAvg = typeof p.rating2Avg === 'number' ? p.rating2Avg : (typeof p.rating === 'number' ? p.rating : 1.0);
                  const newAvg = ((prevAvg * prevMatches) + r) / (prevMatches + 1);
                  return { ...p, rating2Avg: parseFloat(newAvg.toFixed(2)), rating2Matches: prevMatches + 1 };
              }
              return p;
          });
      }
      if (playerSeriesRatings && t2.players) {
          const map2 = playerSeriesRatings.team2 || {};
          t2.players = t2.players.map(p => {
              const keys = Object.keys(map2);
              const statKey = keys.find(k => normalizeName(k) === normalizeName(p.name));
              const r = statKey ? parseFloat(map2[statKey]) : NaN;
              if (!isNaN(r)) {
                  const prevMatches = typeof p.rating2Matches === 'number' ? p.rating2Matches : 0;
                  const prevAvg = typeof p.rating2Avg === 'number' ? p.rating2Avg : (typeof p.rating === 'number' ? p.rating : 1.0);
                  const newAvg = ((prevAvg * prevMatches) + r) / (prevMatches + 1);
                  return { ...p, rating2Avg: parseFloat(newAvg.toFixed(2)), rating2Matches: prevMatches + 1 };
              }
              return p;
          });
      }

      const date = new Date().toISOString();
      const scoreStr = typeof finalScore === 'string' ? finalScore : (finalScore && finalScore.score) ? finalScore.score : 'N/A';
      const teamsAfter = savedTeams.map(t => {
          if (t.name === t1.name) return { ...t, rating: t1.rating };
          if (t.name === t2.name) return { ...t, rating: t2.rating };
          return t;
      });
      const sorted = teamsAfter.slice().sort((a, b) => b.rating - a.rating);
      const t1Rank = sorted.findIndex(t => t.name === t1.name) + 1;
      const t2Rank = sorted.findIndex(t => t.name === t2.name) + 1;

      // Сохраняем playerStats в запись истории с MVP матча
      const mvpData = mvpMatchParam ? { name: mvpMatchParam.name, photoUrl: mvpMatchParam.photoUrl, avgRating: mvpMatchParam.avgRating } : null;
      const mapSeriesArray = Array.isArray(mapSeriesResults) ? mapSeriesResults : [];
      const entry1MapDetails = mapSeriesArray.map((map, index) => ({
          name: map.mapName,
          order: index + 1,
          teamScore: map.score1,
          opponentScore: map.score2,
          result: map.winner === team1Name ? 'Win' : 'Loss',
          playerStats: Array.isArray(map.team1Stats) 
              ? map.team1Stats.map(p => ({
                  id: p.id,
                  name: p.name,
                  rating2: parseFloat(p.rating2) || 0,
                  kills: p.kills || 0,
                  deaths: p.deaths || 0,
                  assists: p.assists || 0,
                  adr: parseFloat(p.adr) || 0
                }))
              : []
      }));
      const entry2MapDetails = mapSeriesArray.map((map, index) => ({
          name: map.mapName,
          order: index + 1,
          teamScore: map.score2,
          opponentScore: map.score1,
          result: map.winner === team2Name ? 'Win' : 'Loss',
          playerStats: Array.isArray(map.team2Stats) 
              ? map.team2Stats.map(p => ({
                  id: p.id,
                  name: p.name,
                  rating2: parseFloat(p.rating2) || 0,
                  kills: p.kills || 0,
                  deaths: p.deaths || 0,
                  assists: p.assists || 0,
                  adr: parseFloat(p.adr) || 0
                }))
              : []
      }));

      const entry1 = {
          date,
          opponent: team2Name,
          result: winnerName === team1Name ? 'Win' : (winnerName === team2Name ? 'Loss' : 'Draw'),
          score: scoreStr,
          ratingChange: delta1,
          rank: t1Rank,
          mvp: mvpData,
          mapDetails: entry1MapDetails,
          playerStats: Array.isArray(playerSeriesStats?.team1)
              ? playerSeriesStats.team1.map(p => ({
                  id: p.id,
                  name: p.name,
                  photoUrl: p.photoUrl || '',
                  rating2: parseFloat(p.rating2),
                  kills: p.kills || 0,
                  deaths: p.deaths || 0,
                  adr: parseFloat(p.adr) || 0
                }))
              : []
      };
      const entry2 = {
          date,
          opponent: team1Name,
          result: winnerName === team2Name ? 'Win' : (winnerName === team1Name ? 'Loss' : 'Draw'),
          score: scoreStr.split('-').reverse().join('-'),
          ratingChange: delta2,
          rank: t2Rank,
          mvp: mvpData,
          mapDetails: entry2MapDetails,
          playerStats: Array.isArray(playerSeriesStats?.team2)
              ? playerSeriesStats.team2.map(p => ({
                  id: p.id,
                  name: p.name,
                  photoUrl: p.photoUrl || '',
                  rating2: parseFloat(p.rating2),
                  kills: p.kills || 0,
                  deaths: p.deaths || 0,
                  adr: parseFloat(p.adr) || 0
                }))
              : []
      };

      t1.history = [entry1, ...t1.history];
      t2.history = [entry2, ...t2.history];

      console.log('DEBUG: entry1 mapDetails:', JSON.stringify(entry1.mapDetails));
      console.log('DEBUG: entry1 score:', entry1.score);
      console.log('DEBUG: entry2 mapDetails:', JSON.stringify(entry2.mapDetails));
      console.log('DEBUG: entry2 score:', entry2.score);
      console.log('Updated teams before saving:', { t1, t2 });

      if (window.csApi) {
          console.log('Saving via Supabase API...');
          await window.csApi.upsertTeamsBulk([t1, t2]);
          
          // Сохраняем статистику игроков по каждой карте отдельно
          if (mapSeriesResults && Array.isArray(mapSeriesResults) && mapSeriesResults.length > 0) {
              // Сохраняем статистику для каждой карты
              for (const mapResult of mapSeriesResults) {
                  const mapName = mapResult.mapName || 'Unknown';
                  const mapScore1 = mapResult.score1 || 0;
                  const mapScore2 = mapResult.score2 || 0;
                  const mapScoreStr = `${mapScore1}-${mapScore2}`;
                  const mapWinner = mapResult.winner;
                  const isTeam1Winner = mapWinner === team1Name;
                  
                  // Сохраняем статистику команды 1 для этой карты
                  if (mapResult.team1Stats && Array.isArray(mapResult.team1Stats)) {
                      for (const player of mapResult.team1Stats) {
                          console.log('Saving team1 player for map:', { player_name: player.name, map: mapName, kills: player.kills, deaths: player.deaths, adr: player.adr });
                          await window.csApi.savePlayerMatch({
                              player_name: player.name,
                              team_name: t1.name,
                              opponent: t2.name,
                              match_date: date,
                              result: isTeam1Winner ? 'Win' : 'Loss',
                              score: `${mapName}: ${mapScoreStr}`,
                              rating: parseFloat(player.rating2) || 0,
                              kills: player.kills || 0,
                              deaths: player.deaths || 0,
                              adr: parseFloat(player.adr) || 0
                          });
                      }
                  }
                  
                  // Сохраняем статистику команды 2 для этой карты
                  if (mapResult.team2Stats && Array.isArray(mapResult.team2Stats)) {
                      for (const player of mapResult.team2Stats) {
                          console.log('Saving team2 player for map:', { player_name: player.name, map: mapName, kills: player.kills, deaths: player.deaths, adr: player.adr });
                          await window.csApi.savePlayerMatch({
                              player_name: player.name,
                              team_name: t2.name,
                              opponent: t1.name,
                              match_date: date,
                              result: !isTeam1Winner ? 'Win' : 'Loss',
                              score: `${mapName}: ${mapScore2}-${mapScore1}`,
                              rating: parseFloat(player.rating2) || 0,
                              kills: player.kills || 0,
                              deaths: player.deaths || 0,
                              adr: parseFloat(player.adr) || 0
                          });
                      }
                  }
              }
          } else {
              // Fallback: сохраняем общую статистику, если нет данных по картам
              if (playerSeriesStats?.team1 && Array.isArray(playerSeriesStats.team1)) {
                  for (const player of playerSeriesStats.team1) {
                      console.log('Saving team1 player (fallback):', { player_name: player.name, kills: player.kills, deaths: player.deaths, adr: player.adr });
                      await window.csApi.savePlayerMatch({
                          player_name: player.name,
                          team_name: t1.name,
                          opponent: t2.name,
                          match_date: date,
                          result: entry1.result,
                          score: scoreStr,
                          rating: parseFloat(player.rating2),
                          kills: player.kills || 0,
                          deaths: player.deaths || 0,
                          adr: parseFloat(player.adr) || 0
                      });
                  }
              }
              if (playerSeriesStats?.team2 && Array.isArray(playerSeriesStats.team2)) {
                  for (const player of playerSeriesStats.team2) {
                      console.log('Saving team2 player (fallback):', { player_name: player.name, kills: player.kills, deaths: player.deaths, adr: player.adr });
                      await window.csApi.savePlayerMatch({
                          player_name: player.name,
                          team_name: t2.name,
                          opponent: t1.name,
                          match_date: date,
                          result: entry2.result,
                          score: entry2.score,
                          rating: parseFloat(player.rating2),
                          kills: player.kills || 0,
                          deaths: player.deaths || 0,
                          adr: parseFloat(player.adr) || 0
                      });
                  }
              }
          }
      } else {
          console.log('Saving via localStorage...');
          savedTeams[idx1] = t1;
          savedTeams[idx2] = t2;
          await writeSavedTeams(savedTeams);
          console.log('Teams saved to localStorage');
      }
      
      console.log('updateTeamRatings completed successfully');

      // Report tournament match result if tournament is active
      const pendingStr = localStorage.getItem('pending_match');
      if (pendingStr) {
        try {
          const pending = JSON.parse(pendingStr);
          if (pending.tournamentId && pending.matchId && pending.team1Id && pending.team2Id) {
            const team1IsWinner = winnerName === team1Name;
            const result = {
              tournamentId: pending.tournamentId,
              matchId: pending.matchId,
              team1Id: pending.team1Id,
              team2Id: pending.team2Id,
              team1Score: parseInt(finalScore.split('-')[0]) || 0,
              team2Score: parseInt(finalScore.split('-')[1]) || 0,
              winner: team1IsWinner ? 'team1' : 'team2',
              team1Name: team1Name,
              team2Name: team2Name
            };
            console.log('🏆 Reporting tournament match result:', result);
            window.reportMatchResult(result);
          }
        } catch (e) {
          console.error('Error reporting tournament result:', e);
        }
      }
    } catch (e) {
      console.error('Fatal error in updateTeamRatings:', e);
    }
}

// ---------- Симуляция матча ----------

function getLogo(teamPrefix) {
    const urlInput = document.getElementById(`${teamPrefix}LogoUrl`)?.value;
    const fileInput = document.getElementById(`${teamPrefix}LogoFile`)?.files?.[0];
    if (fileInput) {
        return URL.createObjectURL(fileInput);
    } else if (urlInput) {
        return urlInput;
    }
    return null;
}

function generatePlayerStats(players, isWinner, totalRounds) {
    const baseKills = Math.floor(totalRounds * 0.8);
    return players.map(player => {
        const ratingFactor = player.rating || 1.0;
        let kills = Math.floor((Math.random() * 5 + baseKills + (isWinner ? 3 : -3)) * ratingFactor);
        let deaths = Math.floor((Math.random() * 5 + baseKills - (isWinner ? 3 : -3)) / Math.max(0.5, ratingFactor));
        const assists = Math.floor(Math.random() * Math.max(0, kills) * 0.4);
        let adr = (Math.random() * 30 + 60 * (player.rating || 1)).toFixed(0);
        let rating2 = parseFloat((player.rating + (isWinner ? Math.random() * 0.4 : -Math.random() * 0.3)).toFixed(2));

        // Маленький шанс на «матч жизни» для отдельного игрока
        if (Math.random() < (typeof PLAYER_HOT_PROB_GLOBAL !== 'undefined' ? PLAYER_HOT_PROB_GLOBAL : 0.02)) {
            const extraKills = Math.floor(8 + Math.random() * 10);
            kills += extraKills;
            rating2 = parseFloat((rating2 + 0.5 + Math.random() * 1.0).toFixed(2));
            adr = Math.max(adr, Math.floor(adr * (1 + 0.2 + Math.random() * 0.5)));
            // пометка в имени (необязательно)
            player._hotMatch = true;
        }

        // Очень маленький шанс на провал у игрока
        if (Math.random() < (typeof PLAYER_COLD_PROB_GLOBAL !== 'undefined' ? PLAYER_COLD_PROB_GLOBAL : 0.005)) {
            const lostKills = Math.floor(3 + Math.random() * 5);
            kills = Math.max(0, kills - lostKills);
            rating2 = parseFloat((rating2 - (0.4 + Math.random() * 0.8)).toFixed(2));
            player._coldMatch = true;
        }

        return { ...player, kills: Math.max(0, kills), deaths: Math.max(0, deaths), assists, adr, rating2: rating2.toFixed ? rating2.toFixed(2) : rating2 };
    });
}

function simulateLiveMap(team1Name, team2Name, team1Chance, team1Players, team2Players, team1Logo, team2Logo, mapNumber, mapName, simSpeed, callback) {
    const selectedMap = mapName || maps[Math.floor(Math.random() * maps.length)] || 'Mirage';
    let score1 = 0, score2 = 0;
    let isOvertime = false;
    let otNumber = 0;
    let otRoundCount = 0;
    const liveScoreDiv = document.getElementById('liveScore');
    const statsDiv = document.getElementById('stats');

    if (!liveScoreDiv || !statsDiv) {
        console.warn('Live UI elements missing');
    }

    if (liveScoreDiv) {
        liveScoreDiv.classList.remove('hidden');
        liveScoreDiv.innerHTML = `
            <h3 class="text-lg font-semibold mb-2">Map ${mapNumber} (${selectedMap}) (Live)</h3>
            <div class="flex items-center justify-center space-x-4 mb-4">
                <div class="flex items-center space-x-2">
                    ${team1Logo ? `<img src="${team1Logo}" alt="${team1Name} Logo" class="team-logo">` : ''}
                    <span>${team1Name}</span>
                </div>
                <span id="liveScoreText" class="text-2xl font-bold">0 - 0</span>
                <div class="flex items-center space-x-2">
                    <span>${team2Name}</span>
                    ${team2Logo ? `<img src="${team2Logo}" alt="${team2Name} Logo" class="team-logo">` : ''}
                </div>
            </div>
        `;
    }

    // Настройки случайности
    const UPSET_PROB = 0.03; // 3% шанс апсета на карту
    const PLAYER_HOT_PROB = (typeof PLAYER_HOT_PROB_GLOBAL !== 'undefined' ? PLAYER_HOT_PROB_GLOBAL : 0.02); // configurable via global

    let effectiveTeam1Chance = Number(team1Chance);
    // Редкий апсет: даём существенный бонус аутсайдеру
    if (Math.random() < UPSET_PROB) {
        const underdogIsTeam1 = effectiveTeam1Chance < 50;
        const bonus = 30 + Math.random() * 25; // 30..55
        if (underdogIsTeam1) {
            effectiveTeam1Chance = Math.min(95, effectiveTeam1Chance + bonus);
            console.log('🎲 Upset event: boosting underdog Team1 by', bonus.toFixed(1));
        } else {
            effectiveTeam1Chance = Math.max(5, effectiveTeam1Chance - bonus);
            console.log('🎲 Upset event: cutting favorite Team1 by', bonus.toFixed(1));
        }
        // пометка в UI (необязательная)
        if (liveScoreDiv) {
            const note = document.createElement('div');
            note.className = 'text-xs text-yellow-500';
            note.textContent = 'Rare upset event occured on this map!';
            liveScoreDiv.appendChild(note);
        }
    }

    let timeout = simSpeed === 'fast' ? 500 : 1800;
    const isInstant = simSpeed === 'instant';

    function simulateRound() {
        const random = Math.random() * 100;
        if (random < effectiveTeam1Chance) score1++; else score2++;
        const el = document.getElementById('liveScoreText');
        if (el) el.textContent = `${score1} - ${score2}`;
    }

    function checkFinish() {
        if (!isOvertime) {
            if (score1 >= 13 || score2 >= 13) return true;
            if (score1 === 12 && score2 === 12) {
                isOvertime = true;
                otNumber = 1;
            }
        } else {
            // отслеживаем OT по отрывам
            const otWins1 = score1 - 12 - (otNumber - 1) * 6;
            const otWins2 = score2 - 12 - (otNumber - 1) * 6;
            if (otWins1 >= 4 || otWins2 >= 4) return true;
            if ((score1 + score2) % 6 === 0 && otWins1 === 3 && otWins2 === 3) {
                otNumber++;
            }
        }
        return false;
    }

    function finishMap() {
        const totalRounds = score1 + score2;
        const winner = score1 > score2 ? team1Name : team2Name;
        const isWinnerTeam1 = score1 > score2;
        // Передаём флаг вероятности горячих матчей через глобальную переменную конфигурации — generatePlayerStats читает Math.random()
        const team1Stats = generatePlayerStats(team1Players, isWinnerTeam1, totalRounds);
        const team2Stats = generatePlayerStats(team2Players, !isWinnerTeam1, totalRounds);
        const allStats = [...team1Stats, ...team2Stats];
        const mvp = allStats.reduce((max, player) => parseFloat(player.rating2) > parseFloat(max.rating2) ? player : max, allStats[0]);

        const sortedTeam1Stats = team1Stats.sort((a, b) => parseFloat(b.rating2) - parseFloat(a.rating2));
        const sortedTeam2Stats = team2Stats.sort((a, b) => parseFloat(b.rating2) - parseFloat(a.rating2));

        if (statsDiv) {
            const mvpPhoto = mvp.photoUrl || '';
            const hasMvpPhoto = mvpPhoto && mvpPhoto.trim() !== '';
            const mvpPhotoHtml = hasMvpPhoto 
                ? `<img src="${mvpPhoto}" alt="${mvp.name}" class="mvp-photo" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }">`
                : '';
            const mvpPlaceholderHtml = `<div class="mvp-photo-placeholder" style="${hasMvpPhoto ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">🏆</div>`;
            
            const isTeam1Winner = winner === team1Name;
            const winnerClass1 = isTeam1Winner ? 'map-score-winner' : 'map-score-loser';
            const winnerClass2 = !isTeam1Winner ? 'map-score-winner' : 'map-score-loser';
            
            statsDiv.innerHTML += `
                <div class="map-result-header">
                <div class="map-result-title">Map ${mapNumber}: ${selectedMap}${isOvertime ? ` <span class="overtime-badge">Overtime ${otNumber}</span>` : ''}</div>
                    <div class="map-score-display">
                        <div class="map-score-team ${winnerClass1}">
                            ${team1Logo ? `<img src="${team1Logo}" alt="${team1Name}" class="map-score-logo">` : ''}
                            <span class="map-score-name">${team1Name}</span>
                            <span class="map-score-value">${score1}</span>
                        </div>
                        <span class="map-score-separator">-</span>
                        <div class="map-score-team ${winnerClass2}">
                            <span class="map-score-value">${score2}</span>
                            <span class="map-score-name">${team2Name}</span>
                            ${team2Logo ? `<img src="${team2Logo}" alt="${team2Name}" class="map-score-logo">` : ''}
                        </div>
                    </div>
                    <div class="map-result-mvp">MVP: ${mvp.name} (Rating: ${mvp.rating2})</div>
                </div>
                <table class="stats-table w-full text-left text-sm">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>K</th>
                            <th>D</th>
                            <th>A</th>
                            <th>ADR</th>
                            <th>Rating 2.0</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="team-header">
                            <td colspan="6">${team1Name} (${score1} rounds)</td>
                        </tr>
                        ${sortedTeam1Stats.map(p => {
                            const photo = p.photoUrl || '';
                            const hasPhoto = photo && photo.trim() !== '';
                            const photoHtml = hasPhoto 
                                ? `<img src="${photo}" alt="${p.name}" class="player-photo" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }">`
                                : '';
                            const placeholderHtml = `<div class="player-photo-placeholder" style="${hasPhoto ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">${p.name.charAt(0).toUpperCase()}</div>`;
                            return `
                            <tr>
                                <td class="player-cell">
                                    ${photoHtml}
                                    ${placeholderHtml}
                                    <span>${p.name}</span>
                                </td>
                                <td class="stat-value">${p.kills}</td>
                                <td class="stat-value">${p.deaths}</td>
                                <td class="stat-value">${p.assists}</td>
                                <td class="stat-value">${p.adr}</td>
                                <td class="rating-value">${p.rating2}</td>
                            </tr>
                        `;
                        }).join('')}
                        <tr class="team-header">
                            <td colspan="6">${team2Name} (${score2} rounds)</td>
                        </tr>
                        ${sortedTeam2Stats.map(p => {
                            const photo = p.photoUrl || '';
                            const hasPhoto = photo && photo.trim() !== '';
                            const photoHtml = hasPhoto 
                                ? `<img src="${photo}" alt="${p.name}" class="player-photo" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }">`
                                : '';
                            const placeholderHtml = `<div class="player-photo-placeholder" style="${hasPhoto ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">${p.name.charAt(0).toUpperCase()}</div>`;
                            return `
                            <tr>
                                <td class="player-cell">
                                    ${photoHtml}
                                    ${placeholderHtml}
                                    <span>${p.name}</span>
                                </td>
                                <td class="stat-value">${p.kills}</td>
                                <td class="stat-value">${p.deaths}</td>
                                <td class="stat-value">${p.assists}</td>
                                <td class="stat-value">${p.adr}</td>
                                <td class="rating-value">${p.rating2}</td>
                            </tr>
                        `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        callback({ score1, score2, winner, isOvertime, team1Stats, team2Stats, mapName: selectedMap });
    }

    if (isInstant) {
        while (!checkFinish()) simulateRound();
        finishMap();
    } else {
        const interval = setInterval(() => {
            simulateRound();
            if (checkFinish()) {
                clearInterval(interval);
                finishMap();
            }
        }, timeout);
    }
}

async function startLiveMatch() {
  console.log('🎮 startLiveMatch called');
  try {
    const team1Name = document.getElementById('team1Name').value.trim() || 'Team A';
    const team2Name = document.getElementById('team2Name').value.trim() || 'Team B';
    
    // 1) Берём шанс из ручного ввода, если пользователь задал
    const team1ChanceInput = document.getElementById('team1Chance');
    let team1Chance = team1ChanceInput ? parseInt(team1ChanceInput.value, 10) : NaN;

    // 2) Если ручной шанс некорректный — считаем автоматически
    if (isNaN(team1Chance)) {
      const calculatedChances = await calculateWinChances(team1Name, team2Name);
      team1Chance = calculatedChances.team1;
      if (isNaN(team1Chance)) team1Chance = 50;
    }
    const matchFormat = document.getElementById('matchFormat').value;
    const simSpeed = document.getElementById('simSpeed').value;
    const isInstant = simSpeed === 'instant';
    const isRated = document.getElementById('ratedMatch').checked;
    const team1Logo = getLogo('team1');
    const team2Logo = getLogo('team2');
    const resultDiv = document.getElementById('result');
    const statsDiv = document.getElementById('stats');
    const liveScoreDiv = document.getElementById('liveScore');

    console.log('📋 Match config:', { team1Name, team2Name, matchFormat, simSpeed, team1Chance });

    if (team1Chance < 0 || team1Chance > 100) {
      if (resultDiv) resultDiv.innerHTML = '<span class="text-red-500">Шанс 0-100!</span>';
      return;
    }

    const team1Players = [], team2Players = [];
    document.querySelectorAll('#team1Players > div').forEach(div => {
      const name = div.children[0].value.trim();
      const rating = parseFloat(div.children[1].value);
      const photoUrl = (div.children[2]?.value || '').trim();
      if (name && !isNaN(rating)) {
        let pl = { name, rating, photoUrl };
        if (!pl.id) pl = makePlayer(name, rating, photoUrl);
        team1Players.push(pl);
      }
    });
    document.querySelectorAll('#team2Players > div').forEach(div => {
      const name = div.children[0].value.trim();
      const rating = parseFloat(div.children[1].value);
      const photoUrl = (div.children[2]?.value || '').trim();
      if (name && !isNaN(rating)) {
        let pl = { name, rating, photoUrl };
        if (!pl.id) pl = makePlayer(name, rating, photoUrl);
        team2Players.push(pl);
      }
    });

    console.log(`👥 Players: Team1: ${team1Players.length}, Team2: ${team2Players.length}`);

    if (team1Players.length !== 5 || team2Players.length !== 5) {
      if (resultDiv) resultDiv.innerHTML = '<span class="text-red-500">Нужно 5 игроков! Team1: ' + team1Players.length + ', Team2: ' + team2Players.length + '</span>';
      console.warn('❌ Not enough players');
      return;
    }

    if (resultDiv) resultDiv.innerHTML = ''; 
    if (statsDiv) statsDiv.innerHTML = ''; 
    if (liveScoreDiv) liveScoreDiv.classList.add('hidden');

    console.log('✅ Validation passed, starting match...');

    const maxMaps = matchFormat === 'BO1' ? 1 : matchFormat === 'BO3' ? 3 : 5;
    const vetoData = simulateMapVeto(matchFormat, team1Name, team2Name);
    console.log('🗺️ Veto data:', vetoData);
    await renderVetoPanel(vetoData, team1Name, team2Name);
  let mapOrder = Array.isArray(vetoData.mapOrder) ? [...vetoData.mapOrder.slice(0, maxMaps)] : [];
  const fallbackPool = window.mapUtils?.getPool?.() || maps;
  let poolCursor = 0;
  while (mapOrder.length < maxMaps) {
    const candidate =
      fallbackPool.find(m => !mapOrder.includes(m)) ||
      maps[(poolCursor++) % maps.length] ||
      'Mirage';
    mapOrder.push(candidate);
  }

  const winsNeeded = Math.ceil(maxMaps / 2);
  let team1Wins = 0, team2Wins = 0, map = 1;
  let mvpMatch = null; // Глобальная переменная для MVP матча

  let scoreDisplay = document.getElementById('matchScore');
  if (!scoreDisplay) {
    scoreDisplay = document.createElement('div');
    scoreDisplay.id = 'matchScore';
    scoreDisplay.className = 'text-3xl font-bold text-center my-4 text-white';
    // вставляем перед resultDiv
    if (resultDiv && resultDiv.parentNode) {
      resultDiv.parentNode.insertBefore(scoreDisplay, resultDiv);
    } else {
      document.body.appendChild(scoreDisplay);
    }
  }
  scoreDisplay.textContent = '0 - 0';
  renderMapSquares(0, 0, maxMaps);

  // Собираем массив результатов карт чтобы формировать итоговый счёт и MVP если нужно
  const mapResults = [];

  // Гарантируем, что обе команды существуют в localStorage c актуальным составом и логотипом
  await (async function ensureTeamsExist() {
    const savedTeams = await readSavedTeams();
    function upsertTeam(name, logoUrl, players) {
      const idx = savedTeams.findIndex(t => t.name === name);
      const sanitizedPlayers = Array.isArray(players)
        ? players.map(p => ({ ...p, status: p.status || 'active' }))
        : [];
      if (idx !== -1) {
        const existing = savedTeams[idx];
        const mergedPlayers = mergePlayersWithBench(existing.players || [], sanitizedPlayers);
        savedTeams[idx] = {
          ...existing,
          logoUrl: logoUrl || existing.logoUrl || '',
          players: mergedPlayers
        };
      } else {
        savedTeams.push({
          name,
          logoUrl: logoUrl || '',
          players: sanitizedPlayers,
          rating: 1500,
          history: []
        });
      }
    }
    upsertTeam(team1Name, team1Logo, team1Players);
    upsertTeam(team2Name, team2Logo, team2Players);
    await writeSavedTeams(savedTeams);
  })();

  function playNextMap() {
    if (map <= maxMaps && team1Wins < winsNeeded && team2Wins < winsNeeded) {
      const currentMap = mapOrder[map - 1] || maps[(map - 1) % maps.length];
      simulateLiveMap(team1Name, team2Name, team1Chance, team1Players, team2Players, team1Logo, team2Logo, map, currentMap, simSpeed, (result) => {
        // Результат одной карты
        mapResults.push(result);
        if (result.winner === team1Name) team1Wins++; else team2Wins++;
        scoreDisplay.textContent = `${team1Wins} - ${team2Wins}`;

        // Если матч не закончен — следующая карта
        if (team1Wins < winsNeeded && team2Wins < winsNeeded) {
          map++;
          setTimeout(playNextMap, 1500); // пауза между картами для чтения счета
        } else {
          // Финализируем матч — итоговый победитель и счёт по картам
          const finalWinner = team1Wins > team2Wins ? team1Name : team2Name;
          const finalScore = `${team1Wins}-${team2Wins}`;

          // Вычисляем MVP матча сразу
          const allMatchStats = [];
          mapResults.forEach(mr => {
            if (mr.team1Stats) allMatchStats.push(...mr.team1Stats);
            if (mr.team2Stats) allMatchStats.push(...mr.team2Stats);
          });
          
          mvpMatch = null; // Присваиваем внешней переменной
          if (allMatchStats.length > 0) {
            // Группируем статистику по игрокам для вычисления среднего рейтинга
            const playerStatsMap = {};
            allMatchStats.forEach(p => {
              if (!playerStatsMap[p.name]) {
                playerStatsMap[p.name] = {
                  name: p.name,
                  photoUrl: p.photoUrl || '',
                  totalRating: 0,
                  maps: 0
                };
              }
              playerStatsMap[p.name].totalRating += parseFloat(p.rating2) || 0;
              playerStatsMap[p.name].maps += 1;
            });
            
            // Находим MVP по среднему рейтингу
            const playersWithAvg = Object.values(playerStatsMap).map(p => ({
              name: p.name,
              photoUrl: p.photoUrl,
              avgRating: (p.totalRating / p.maps).toFixed(2)
            }));
            
            mvpMatch = playersWithAvg.sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating))[0];
          }

          if (resultDiv) {
            let resultHtml = `<div class="text-center mb-6">
              <p class="text-green-400 text-3xl font-bold mb-2">🏆 Победа: <span class="text-white">${finalWinner}</span></p>
              <p class="text-2xl text-gray-300">Счёт: <span class="text-white font-bold">${finalScore}</span></p>
            </div>`;
            
            // Добавляем MVP если он есть
            if (mvpMatch) {
              const mvpPhoto = mvpMatch.photoUrl || '';
              const mvpPhotoHtml = mvpPhoto 
                ? `<img src="${mvpPhoto}" alt="${mvpMatch.name}" class="mvp-photo" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }">`
                : '';
              const hasMvpPhoto = mvpPhoto && mvpPhoto.trim() !== '';
              const mvpPlaceholderHtml = `<div class="mvp-photo-placeholder" style="${hasMvpPhoto ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">${mvpMatch.name.charAt(0).toUpperCase()}</div>`;
              
              resultHtml += `
                <div class="mvp-display">
                  <div class="mvp-badge">🏆 Match MVP</div>
                  ${mvpPhotoHtml}
                  ${mvpPlaceholderHtml}
                  <div class="mvp-name">${mvpMatch.name}</div>
                  <div class="mvp-rating">Rating: <span class="mvp-rating-value">${mvpMatch.avgRating}</span></div>
                </div>
              `;
            }
            
            resultDiv.innerHTML = resultHtml;
          }

          // Формируем итоговую таблицу матча (всегда, независимо от режима rated)
          (async () => {
            // Итоги по сериям для формирования итоговой таблицы
            const agg1 = {}, agg2 = {}, cnt1 = {}, cnt2 = {};
            // Одновременно собираем тоталы по K/D/A/ADR и тотал-раунды по командам
            const tot1 = { rounds: 0 };
            const tot2 = { rounds: 0 };
            const team1AggStat = {}; // name -> {kills,deaths,assists,adrSum,maps,sumRating}
            const team2AggStat = {};

                mapResults.forEach(mr => {
                  tot1.rounds += mr.score1 || 0;
                  tot2.rounds += mr.score2 || 0;

                  (mr.team1Stats || []).forEach(p => {
                    const r = parseFloat(p.rating2);
                    if (!isNaN(r)) {
                      agg1[p.name] = (agg1[p.name] || 0) + r;
                      cnt1[p.name] = (cnt1[p.name] || 0) + 1;
                    }
                    const rec = team1AggStat[p.name] || { id: p.id, name: p.name, photoUrl: p.photoUrl || '', kills: 0, deaths: 0, assists: 0, adrSum: 0, maps: 0, sumRating: 0 };
                    if (!rec.id && p.id) rec.id = p.id;
                    if (!rec.photoUrl && p.photoUrl) rec.photoUrl = p.photoUrl;
                    rec.kills += parseInt(p.kills) || 0;
                    rec.deaths += parseInt(p.deaths) || 0;
                    rec.assists += parseInt(p.assists) || 0;
                    rec.adrSum += parseFloat(p.adr) || 0;
                    rec.maps += 1;
                    rec.sumRating += parseFloat(p.rating2) || 0;
                    team1AggStat[p.name] = rec;
                  });

                  (mr.team2Stats || []).forEach(p => {
                    const r = parseFloat(p.rating2);
                    if (!isNaN(r)) {
                      agg2[p.name] = (agg2[p.name] || 0) + r;
                      cnt2[p.name] = (cnt2[p.name] || 0) + 1;
                    }
                    const rec = team2AggStat[p.name] || { id: p.id, name: p.name, photoUrl: p.photoUrl || '', kills: 0, deaths: 0, assists: 0, adrSum: 0, maps: 0, sumRating: 0 };
                    if (!rec.id && p.id) rec.id = p.id;
                    if (!rec.photoUrl && p.photoUrl) rec.photoUrl = p.photoUrl;
                    rec.kills += parseInt(p.kills) || 0;
                    rec.deaths += parseInt(p.deaths) || 0;
                    rec.assists += parseInt(p.assists) || 0;
                    rec.adrSum += parseFloat(p.adr) || 0;
                    rec.maps += 1;
                    rec.sumRating += parseFloat(p.rating2) || 0;
                    team2AggStat[p.name] = rec;
                  });
                });

                const playerSeriesRatings = {
                  team1: Object.fromEntries(Object.keys(agg1).map(k => [k, +(agg1[k] / (cnt1[k] || 1)).toFixed(2)])),
                  team2: Object.fromEntries(Object.keys(agg2).map(k => [k, +(agg2[k] / (cnt2[k] || 1)).toFixed(2)])),
                };

                // Формируем сводную таблицу по матчу в том же стиле
                const team1Rows = Object.values(team1AggStat).map(p => ({
                  id: p.id,
                  name: p.name,
                  photoUrl: p.photoUrl || '',
                  kills: p.kills,
                  deaths: p.deaths,
                  assists: p.assists,
                  adr: Math.round(p.adrSum / Math.max(1, p.maps)),
                  rating2: (p.sumRating / Math.max(1, p.maps)).toFixed(2)
                })).sort((a,b) => parseFloat(b.rating2) - parseFloat(a.rating2));

                const team2Rows = Object.values(team2AggStat).map(p => ({
                  id: p.id,
                  name: p.name,
                  photoUrl: p.photoUrl || '',
                  kills: p.kills,
                  deaths: p.deaths,
                  assists: p.assists,
                  adr: Math.round(p.adrSum / Math.max(1, p.maps)),
                  rating2: (p.sumRating / Math.max(1, p.maps)).toFixed(2)
                })).sort((a,b) => parseFloat(b.rating2) - parseFloat(a.rating2));

            let matchStatHtml = `
            <div class="map-result-header">
              <div class="map-result-title">Match Summary</div>
            </div>
            <table class="stats-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>K</th>
                  <th>D</th>
                  <th>A</th>
                  <th>ADR</th>
                  <th>Rating 2.0</th>
                </tr>
              </thead>
              <tbody>
                <tr class="team-header"><td colspan="6">${team1Name} (${tot1.rounds} rounds)</td></tr>
                ${team1Rows.map(p => {
                  const photo = p.photoUrl || '';
                  const photoHtml = photo 
                    ? `<img src="${photo}" alt="${p.name}" class="player-photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                    : '';
                  const placeholderHtml = `<div class="player-photo-placeholder" style="${photo ? 'display:none;' : ''}">${p.name.charAt(0).toUpperCase()}</div>`;
                  return `
                  <tr>
                    <td class="player-cell">
                      ${photoHtml}
                      ${placeholderHtml}
                      <span>${p.name}</span>
                    </td>
                    <td class="stat-value">${p.kills}</td>
                    <td class="stat-value">${p.deaths}</td>
                    <td class="stat-value">${p.assists}</td>
                    <td class="stat-value">${p.adr}</td>
                    <td class="rating-value">${p.rating2}</td>
                  </tr>
                `;
                }).join('')}
                <tr class="team-header"><td colspan="6">${team2Name} (${tot2.rounds} rounds)</td></tr>
                ${team2Rows.map(p => {
                  const photo = p.photoUrl || '';
                  const photoHtml = photo 
                    ? `<img src="${photo}" alt="${p.name}" class="player-photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                    : '';
                  const placeholderHtml = `<div class="player-photo-placeholder" style="${photo ? 'display:none;' : ''}">${p.name.charAt(0).toUpperCase()}</div>`;
                  return `
                  <tr>
                    <td class="player-cell">
                      ${photoHtml}
                      ${placeholderHtml}
                      <span>${p.name}</span>
                    </td>
                    <td class="stat-value">${p.kills}</td>
                    <td class="stat-value">${p.deaths}</td>
                    <td class="stat-value">${p.assists}</td>
                    <td class="stat-value">${p.adr}</td>
                    <td class="rating-value">${p.rating2}</td>
                  </tr>
                `;
                }).join('')}
              </tbody>
            </table>`;
            if (statsDiv) statsDiv.innerHTML += matchStatHtml;

            // === ВАЖНО: обновляем рейтинг ТОЛЬКО если включен режим rated ===
            if (isRated) {
              try {
                console.log('Updating ratings with:', { team1Name, team2Name, finalWinner, playerSeriesRatings, team1Rows, team2Rows, mvpMatch });
                await updateTeamRatings(team1Name, team2Name, finalWinner, finalScore, playerSeriesRatings, { team1: team1Rows, team2: team2Rows }, mvpMatch, mapResults);
                console.log('Ratings updated successfully');
                // Обновим таблицы/профили *после* гарантированного записи localStorage
                if (typeof window.updateRatingsTable === 'function') {
                  window.updateRatingsTable();
                }
                if (typeof window.refreshProfile === 'function') {
                  window.refreshProfile();
                }
              } catch (e) {
                console.error('Error updating ratings after match:', e);
              }
            } else {
              console.log('Match is NOT rated, skipping rating update');
            }
          })();
        }
      });
    }
  }

  playNextMap();
  } catch (error) {
    console.error('❌ Error in startLiveMatch:', error);
    const resultDiv = document.getElementById('result');
    if (resultDiv) {
      resultDiv.innerHTML = '<span class="text-red-500">❌ Ошибка: ' + error.message + '</span>';
    }
  }
}

// ---------- Misc ----------
function resetForms() {
    document.querySelectorAll('input[type="text"], input[type="url"], input[type="number"], input[type="file"]').forEach(input => {
        input.value = '';
    });
    document.querySelectorAll('select:not(#matchFormat):not(#simSpeed)').forEach(select => {
        select.selectedIndex = 0;
    });
    const rated = document.getElementById('ratedMatch');
    if (rated) rated.checked = true;
    const t1 = document.getElementById('team1LogoPreview');
    const t2 = document.getElementById('team2LogoPreview');
    if (t1) t1.src = '';
    if (t2) t2.src = '';
    const liveScore = document.getElementById('liveScore');
    if (liveScore) liveScore.classList.add('hidden');
    const result = document.getElementById('result');
    if (result) result.innerHTML = '';
    const stats = document.getElementById('stats');
    if (stats) stats.innerHTML = '';
}

// Инициализация окна
window.onload = async () => {
    await loadSavedTeams();
    const savedFormat = localStorage.getItem('cs_match_format');
    if (savedFormat) {
        const el = document.getElementById('matchFormat');
        if (el) el.value = savedFormat;
    }
    const savedSpeed = localStorage.getItem('cs_sim_speed');
    if (savedSpeed) {
        const el = document.getElementById('simSpeed');
        if (el) el.value = savedSpeed;
    } else {
      const el = document.getElementById('simSpeed');
      if (el) el.value = 'instant';
    }
};

// Автосинхронизация шансов при ручном редактировании (без пересчёта формулой)
function applyManualChances(fromInput) {
  const t1 = document.getElementById('team1Chance');
  const t2 = document.getElementById('team2Chance');
  if (!t1 || !t2) return;

  let v1 = parseInt(t1.value, 10);
  let v2 = parseInt(t2.value, 10);

  if (fromInput === 'team1' && !isNaN(v1) && v1 >= 0 && v1 <= 100) {
    v2 = 100 - v1;
    t2.value = v2;
  } else if (fromInput === 'team2' && !isNaN(v2) && v2 >= 0 && v2 <= 100) {
    v1 = 100 - v2;
    t1.value = v1;
  }

  if (isNaN(v1) || isNaN(v2)) return;

  const bar1 = document.getElementById('preMatchTeam1Bar');
  const bar2 = document.getElementById('preMatchTeam2Bar');
  const text = document.getElementById('preMatchChanceText');
  if (bar1) bar1.style.width = `${v1}%`;
  if (bar2) bar2.style.width = `${v2}%`;
  if (text) text.textContent = `${v1}% - ${v2}%`;
}

document.getElementById('team1Chance')?.addEventListener('input', function() {
  const val = parseInt(this.value, 10);
  if (!isNaN(val) && val >= 0 && val <= 100) {
    applyManualChances('team1');
  }
});
document.getElementById('team2Chance')?.addEventListener('input', function() {
  const val = parseInt(this.value, 10);
  if (!isNaN(val) && val >= 0 && val <= 100) {
    applyManualChances('team2');
  }
});

// Обновление предматчевой статистики при изменении названий команд или игроков
document.getElementById('team1Name')?.addEventListener('input', function() {
    updatePreMatchStats();
});
document.getElementById('team2Name')?.addEventListener('input', function() {
    updatePreMatchStats();
});

// Обновление при изменении игроков
['team1Players', 'team2Players'].forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) {
        container.addEventListener('input', function() {
            updatePreMatchStats();
        }, true); // Используем capture для перехвата событий от дочерних элементов
    }
});

// Preview логотипов
document.getElementById('team1LogoUrl')?.addEventListener('input', function() {
    const p = document.getElementById('team1LogoPreview');
    if (p) p.src = this.value;
});
document.getElementById('team1LogoFile')?.addEventListener('change', function() {
    const p = document.getElementById('team1LogoPreview');
    if (this.files[0] && p) p.src = URL.createObjectURL(this.files[0]);
});
document.getElementById('team2LogoUrl')?.addEventListener('input', function() {
    const p = document.getElementById('team2LogoPreview');
    if (p) p.src = this.value;
});
document.getElementById('team2LogoFile')?.addEventListener('change', function() {
    const p = document.getElementById('team2LogoPreview');
    if (this.files[0] && p) p.src = URL.createObjectURL(this.files[0]);
});

// Сохранение настроек
document.getElementById('matchFormat')?.addEventListener('change', function() {
    localStorage.setItem('cs_match_format', this.value);
});
document.getElementById('simSpeed')?.addEventListener('change', function() {
    localStorage.setItem('cs_sim_speed', this.value);
});
// === Initialize Country Selects ===
function initCountrySelects() {
    const team1Select = document.getElementById('team1Country');
    const team2Select = document.getElementById('team2Country');
    
    if (!team1Select || !team2Select) return;
    
    // Group countries by region
    const regions = Object.values(COUNTRIES_AND_REGIONS);
    
    regions.forEach(region => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `${region.flag} ${region.region}`;
        
        region.countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.name;
            option.textContent = `${country.flag} ${country.name}`;
            optgroup.appendChild(option);
        });
        
        team1Select.appendChild(optgroup.cloneNode(true));
        team2Select.appendChild(optgroup.cloneNode(true));
    });
    
    // Load saved values from localStorage
    const team1Country = localStorage.getItem('team1Country') || '';
    const team2Country = localStorage.getItem('team2Country') || '';
    
    if (team1Country) team1Select.value = team1Country;
    if (team2Country) team2Select.value = team2Country;
    
    // Save on change
    team1Select.addEventListener('change', function() {
        localStorage.setItem('team1Country', this.value);
    });
    
    team2Select.addEventListener('change', function() {
        localStorage.setItem('team2Country', this.value);
    });
}

// Load saved teams into search dropdowns and hidden selects
async function loadSavedTeams() {
  try {
    const teams = window.readSavedTeams ? await window.readSavedTeams() : JSON.parse(localStorage.getItem('cs_teams') || '[]');
    allTeamsCache = teams || [];
    console.log('✅ Teams loaded into cache:', allTeamsCache.length, 'teams', allTeamsCache);

    // Populate selects used across the UI
    ['quickTeam1','quickTeam2','team1Load','team2Load'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '<option value="">Select Team</option>' + (allTeamsCache || []).map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    });

    // Initialize search inputs/dropdowns for team1 and team2
    ['team1','team2'].forEach(teamPrefix => {
      const input = document.getElementById(teamPrefix + 'Search');
      const dropdown = document.getElementById(teamPrefix + 'Dropdown');
      console.log(`🔧 Initializing ${teamPrefix}: input=${!!input}, dropdown=${!!dropdown}`);
      if (!input || !dropdown) {
        console.error(`❌ Missing ${teamPrefix}: input=${teamPrefix + 'Search'}, dropdown=${teamPrefix + 'Dropdown'}`);
        return;
      }
      
      input.addEventListener('input', function(){
        const q = this.value.trim().toLowerCase();
        console.log(`🔍 Search "${q}" in ${allTeamsCache.length} teams`);
        const matches = (allTeamsCache || []).filter(t => t.name.toLowerCase().includes(q)).slice(0,50);
        console.log(`📊 Found ${matches.length} matches`);  
        if (matches.length === 0) {
          dropdown.innerHTML = '<div class="team-search-item-empty">No teams found</div>';
          dropdown.classList.remove('hidden');
          return;
        }
        dropdown.innerHTML = matches.map(team => `
              <div class="team-search-item" data-team-name="${team.name}">
                <img src="${team.logoUrl||'https://via.placeholder.com/32?text=🏆'}" class="team-search-item-logo" onerror="this.src='https://via.placeholder.com/32?text=🏆'">
                <div class="team-search-item-info">
                  <div class="team-search-item-name">${team.name}</div>
                  <div class="team-search-item-rating">Rating: ${typeof team.rating==='number'?team.rating:1500}</div>
                </div>
              </div>`).join('');
        dropdown.querySelectorAll('.team-search-item').forEach(item => {
          item.addEventListener('click', ()=>{ 
            selectTeam(teamPrefix==='team1'?1:2, item.getAttribute('data-team-name')); 
          });
        });
        dropdown.classList.remove('hidden');
      });
      
      input.addEventListener('focus', function(){ 
        console.log(`👁️ Focus on ${teamPrefix}Search`);
        this.dispatchEvent(new Event('input')); 
      });
      
      // Close dropdown when clicking outside
      input.addEventListener('blur', function(){ 
        setTimeout(() => dropdown.classList.add('hidden'), 200);
      });
    });
  } catch (e) {
    console.warn('loadSavedTeams failed', e);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initCountrySelects);
document.addEventListener('DOMContentLoaded', loadSavedTeams);







