// script.js - исправленная версия

// Функции для работы с командами (совместимость)
async function writeSavedTeams(teams) {
  if (window.csApi) {
    await window.csApi.writeSavedTeams(teams);
  } else {
    localStorage.setItem('cs_teams', JSON.stringify(teams));
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
const PLAYER_HOT_PROB_GLOBAL = 0.005; // 0.5% шанс на "матч жизни" (уменьшено)
const PLAYER_COLD_PROB_GLOBAL = 0.002; // 0.2% шанс на провал у игрока (уменьшено)

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

    if (window.csApi) {
        const currentTeams = await readSavedTeams();
        const existing = currentTeams.find(t => t.name === teamName);
        const teamData = existing 
            ? { ...existing, logoUrl: logoUrl || existing.logoUrl || '', players, country, region } 
            : { name: teamName, logoUrl: logoUrl || '', players, country, region, rating: 1500, history: [] };
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
              players,
              country,
              region
            };
            savedTeams[existingIndex] = teamData;
        } else {
            teamData = { 
              id: 'team_' + teamName.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now(),
              name: teamName, 
              logoUrl: logoUrl || '', 
              players, 
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
    let team1Chance = parseInt(document.getElementById('team1Chance').value);
    if (isNaN(team1Chance)) team1Chance = 50;
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

// Автосинхронизация шансов
document.getElementById('team1Chance')?.addEventListener('input', function() {
    const val = parseInt(this.value);
    if (!isNaN(val) && val >= 0 && val <= 100) {
        const el = document.getElementById('team2Chance');
        if (el) el.value = 100 - val;
    }
});
document.getElementById('team2Chance')?.addEventListener('input', function() {
    const val = parseInt(this.value);
    if (!isNaN(val) && val >= 0 && val <= 100) {
        const el = document.getElementById('team1Chance');
        if (el) el.value = 100 - val;
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