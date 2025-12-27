// team-profile.js - исправленная версия
let allTeams = []; // Локальная версия readSavedTeams, чтобы не зависеть от script.js на этой странице
let editMode = false; // глобальный флаг
let currentAwards = []; // глобальный массив для наград в editMode
let originalTeamName = '';

function normalizeName(name) {
  return (name || '').toLowerCase().trim();
}

function readSavedTeams() {
  try {
    const raw = localStorage.getItem('cs_teams');
    const parsed = JSON.parse(raw || '[]');
    return parsed.map(t => ({
      name: t.name,
      logoUrl: t.logoUrl || '',
      country: t.country || '',
      region: t.region || '',
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
        country: t.country || '',
        region: t.region || '',
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
  // Не показываем, если нет наград и не editMode — скрыть весь родительский div
  const awardsWrapper = container.closest('.bg-gray-800');
  if (!editMode && (!Array.isArray(team.awards) || team.awards.length === 0)) {
    if (awardsWrapper) awardsWrapper.style.display = 'none';
    return;
  } else {
    if (awardsWrapper) awardsWrapper.style.display = '';
  }
  container.innerHTML = '';
  container.className = 'flex flex-wrap gap-6 w-full min-h-[80px] py-2';
  if (!Array.isArray(team.awards) || team.awards.length === 0) {
    if (editMode) {
      container.innerHTML = '<span class="text-gray-400">Нет наград</span>';
    } else {
      container.innerHTML = '';
    }
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
      // Не изменяем классы/инлайновые стили — это ломало верстку в модальном окне.
      // Просто вешаем обработчик клика, сохраняя оригинальный внешний вид.
      editBtn.addEventListener('click', openEditTeamModal);
    }
  });
}

async function openEditTeamModal() {
  const select = document.getElementById('teamSelect');
  if (!select || !select.value) {
    alert('Выберите команду');
    return;
  }

  const teamName = select.value;
  const team = allTeams.find(t => t.name === teamName);
  if (!team) return;

  // Заполняем форму
  document.getElementById('editTeamName').value = team.name || '';
  document.getElementById('editTeamLogo').value = team.logoUrl || '';

  // Инициализируем селект страны
  initEditCountrySelect();
  const countrySelect = document.getElementById('editTeamCountry');
  if (countrySelect && team.country) {
    countrySelect.value = team.country;
  }

  // Прелюдия логотипа
  const logoInput = document.getElementById('editTeamLogo');
  logoInput.addEventListener('input', (e) => {
    const img = document.getElementById('logoPreviewImg');
    if (e.target.value) {
      img.src = e.target.value;
      img.onerror = () => {
        document.getElementById('logoPreview').innerHTML = '<span class="text-red-400">❌ Неверный URL</span>';
      };
    }
  });
  logoInput.dispatchEvent(new Event('input'));

  // Игроки
  renderEditPlayersList(team);

  // Трофеи
  renderEditTrophiesList(team);

  // Показываем модаль
  document.getElementById('editTeamModal').classList.remove('hidden');
  window.currentEditingTeam = team;
}

function closeEditTeamModal() {
  document.getElementById('editTeamModal').classList.add('hidden');
  window.currentEditingTeam = null;
}

function initEditCountrySelect() {
  const countrySelect = document.getElementById('editTeamCountry');
  if (!countrySelect || !window.COUNTRIES_AND_REGIONS) return;
  
  // Проверяем, был ли уже инициализирован
  if (countrySelect.dataset.initialized === 'true') return;
  countrySelect.dataset.initialized = 'true';
  
  // Очищаем существующие опции (кроме первой)
  countrySelect.innerHTML = '<option value="">Выберите страну</option>';
  
  // Добавляем все страны, сгруппированные по регионам
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
    
    countrySelect.appendChild(optgroup);
  });
}

function renderEditPlayersList(team) {
  const container = document.getElementById('playersList');
  container.innerHTML = '';

  const players = team.players && Array.isArray(team.players) ? team.players : [];

  players.forEach((player, idx) => {
    const div = document.createElement('div');
    div.className = 'bg-gray-700 p-3 rounded space-y-2';
    div.innerHTML = `
      <div class="flex gap-3">
        <div class="flex-1">
          <label class="text-xs text-gray-400">Имя</label>
          <input type="text" class="playerEditName w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" value="${player.name || ''}" placeholder="Имя игрока">
        </div>
        <div class="w-20">
          <label class="text-xs text-gray-400">Рейтинг</label>
          <input type="number" class="playerEditRating w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" value="${player.rating || 1.0}" placeholder="1.0" step="0.1" min="0">
        </div>
      </div>
      <div>
        <label class="text-xs text-gray-400">URL фото</label>
        <input type="text" class="playerEditPhoto w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" value="${player.photoUrl || ''}" placeholder="https://...">
      </div>
      <div>
        <label class="text-xs text-gray-400">Статус</label>
        <select class="playerEditStatus w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm">
          <option value="active" ${player.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="benched" ${player.status === 'benched' ? 'selected' : ''}>BENCHED</option>
        </select>
      </div>
      <div class="flex gap-2">
        <button onclick="deletePlayerRow(${idx})" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm transition">
          ✕ Удалить
        </button>
        <button onclick="openTransferModal('${team.name}', ${idx})" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-sm transition">
          🔄 Трансфер
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

function addPlayerRow() {
  const container = document.getElementById('playersList');
  const div = document.createElement('div');
  div.className = 'bg-gray-700 p-3 rounded space-y-2';
  const idx = container.children.length;
  div.innerHTML = `
    <div class="flex gap-3">
      <div class="flex-1">
        <label class="text-xs text-gray-400">Имя</label>
        <input type="text" class="playerEditName w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" placeholder="Имя игрока">
      </div>
      <div class="w-20">
        <label class="text-xs text-gray-400">Рейтинг</label>
        <input type="number" class="playerEditRating w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" placeholder="1.0" value="1.0" step="0.1" min="0">
      </div>
    </div>
    <div>
      <label class="text-xs text-gray-400">URL фото</label>
      <input type="text" class="playerEditPhoto w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" placeholder="https://...">
    </div>
    <button onclick="deletePlayerRow(${idx})" class="w-full bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm transition">
      ✕ Удалить
    </button>
  `;
  container.appendChild(div);
}

function deletePlayerRow(idx) {
  const container = document.getElementById('playersList');
  if (container.children[idx]) {
    container.children[idx].remove();
  }
}

function renderEditTrophiesList(team) {
  const container = document.getElementById('trophiesList');
  container.innerHTML = '';

  const awards = team.awards && Array.isArray(team.awards) ? team.awards : [];

  awards.forEach((award, idx) => {
    const div = document.createElement('div');
    div.className = 'flex gap-3 items-end bg-gray-700 p-3 rounded';
    div.innerHTML = `
      <div class="flex-1">
        <input type="text" class="trophyEditName w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" value="${award.name || ''}" placeholder="Название трофея">
      </div>
      <div class="flex-1">
        <input type="text" class="trophyEditImg w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" value="${award.img || '🏆'}" placeholder="URL или эмодзи">
      </div>
      <button onclick="deleteTrophyRow(${idx})" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm transition">
        ✕
      </button>
    `;
    container.appendChild(div);
  });
}

function addTrophyRow() {
  const container = document.getElementById('trophiesList');
  const div = document.createElement('div');
  div.className = 'flex gap-3 items-end bg-gray-700 p-3 rounded';
  const idx = container.children.length;
  div.innerHTML = `
    <div class="flex-1">
      <input type="text" class="trophyEditName w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" placeholder="Название трофея">
    </div>
    <div class="flex-1">
      <input type="text" class="trophyEditImg w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" placeholder="URL или эмодзи (🏆 по умолчанию)" value="🏆">
    </div>
    <button onclick="deleteTrophyRow(${idx})" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm transition">
      ✕
    </button>
  `;
  container.appendChild(div);
}

function deleteTrophyRow(idx) {
  const container = document.getElementById('trophiesList');
  if (container.children[idx]) {
    container.children[idx].remove();
  }
}

async function propagateTeamAwardsToPlayers(team) {
  if (
    !team ||
    !Array.isArray(team.awards) ||
    team.awards.length === 0 ||
    !Array.isArray(team.players) ||
    team.players.length === 0 ||
    !window.playerAwardsStore ||
    typeof window.playerAwardsStore.addAwards !== 'function'
  ) {
    return;
  }

  for (const player of team.players) {
    if (!player || !player.name) continue;
    try {
      await window.playerAwardsStore.addAwards(player.name, team.awards);
    } catch (error) {
      console.warn(`Не удалось обновить награды для ${player.name}`, error);
    }
  }
}

async function saveTeamEdit() {
  const team = window.currentEditingTeam;
  if (!team) return;

  // Название
  const nameInput = document.getElementById('editTeamName');
  if (nameInput.value.trim()) {
    team.name = nameInput.value.trim();
  }

  // Логотип
  const logoInput = document.getElementById('editTeamLogo');
  team.logoUrl = logoInput.value.trim();

  // Страна и регион
  const countrySelect = document.getElementById('editTeamCountry');
  if (countrySelect) {
    team.country = countrySelect.value || '';
    team.region = team.country ? getRegionByCountry(team.country) : '';
  }

  // Игроки
  team.players = [];
  document.querySelectorAll('#playersList > div').forEach(row => {
    const nameInput = row.querySelector('.playerEditName');
    const ratingInput = row.querySelector('.playerEditRating');
    const photoInput = row.querySelector('.playerEditPhoto');
    const statusInput = row.querySelector('.playerEditStatus');
    if (nameInput.value.trim()) {
      team.players.push({
        id: `player_${Date.now()}_${Math.random()}`,
        name: nameInput.value.trim(),
        rating: parseFloat(ratingInput.value) || 1.0,
        photoUrl: photoInput.value.trim() || '',
        status: statusInput.value || 'active'
      });
    }
  });

  // Трофеи
  team.awards = [];
  document.querySelectorAll('#trophiesList > div').forEach(row => {
    const nameInput = row.querySelector('.trophyEditName');
    const imgInput = row.querySelector('.trophyEditImg');
    if (nameInput.value.trim()) {
      team.awards.push({
        name: nameInput.value.trim(),
        img: imgInput.value.trim() || '🏆'
      });
    }
  });

  await propagateTeamAwardsToPlayers(team);

  // Сохраняем
  try {
    if (window.csApi && window.csApi.upsertTeam) {
      await window.csApi.upsertTeam(team);
    } else {
      const saved = await readSavedTeams();
      const idx = saved.findIndex(t => t.name === team.name);
      if (idx !== -1) {
        saved[idx] = team;
      } else {
        saved.push(team);
      }
      await writeSavedTeams(saved);
    }

    await loadAllTeams();
    closeEditTeamModal();
    await showTeamProfile();
    alert('✓ Команда сохранена!');
  } catch (error) {
    console.error('Error saving team:', error);
    alert('❌ Ошибка при сохранении');
  }
}

// ===== ТРАНСФЕРНАЯ СИСТЕМА =====

let transferData = {
  sourceTeam: null,
  playerIdx: null,
  action: null
};

function openTransferModal(teamName, playerIdx) {
  const team = allTeams.find(t => t.name === teamName);
  if (!team || !team.players[playerIdx]) return;

  const player = team.players[playerIdx];
  
  transferData = {
    sourceTeam: teamName,
    playerIdx: playerIdx,
    action: null
  };

  document.getElementById('transferPlayerName').textContent = player.name;
  document.getElementById('transferTeamSelect').classList.add('hidden');
  document.getElementById('actionBench').classList.remove('opacity-50', 'cursor-not-allowed');
  document.getElementById('actionTransfer').classList.remove('opacity-50', 'cursor-not-allowed');
  document.getElementById('destinationTeam').value = '';

  document.getElementById('transferModal').classList.remove('hidden');
}

function closeTransferModal() {
  document.getElementById('transferModal').classList.add('hidden');
  transferData = { sourceTeam: null, playerIdx: null, action: null };
}

function selectTransferAction(action) {
  transferData.action = action;
  
  document.getElementById('actionBench').classList.remove('bg-yellow-700');
  document.getElementById('actionTransfer').classList.remove('bg-purple-700');
  
  if (action === 'bench') {
    document.getElementById('actionBench').classList.add('bg-yellow-700');
    document.getElementById('transferTeamSelect').classList.add('hidden');
  } else if (action === 'transfer') {
    document.getElementById('actionTransfer').classList.add('bg-purple-700');
    document.getElementById('transferTeamSelect').classList.remove('hidden');
    fillTransferTeamSelect();
  }
}

function fillTransferTeamSelect() {
  const select = document.getElementById('destinationTeam');
  select.innerHTML = '<option value="">-- Выберите команду --</option>';
  
  allTeams.forEach(team => {
    // Не показываем текущую команду
    if (team.name !== transferData.sourceTeam) {
      const option = document.createElement('option');
      option.value = team.name;
      option.textContent = team.name;
      select.appendChild(option);
    }
  });
}

async function confirmTransfer() {
  if (!transferData.sourceTeam || transferData.playerIdx === null || !transferData.action) {
    alert('Выберите действие');
    return;
  }

  const sourceTeam = allTeams.find(t => t.name === transferData.sourceTeam);
  if (!sourceTeam || !sourceTeam.players[transferData.playerIdx]) return;

  const player = sourceTeam.players[transferData.playerIdx];

  try {
    if (transferData.action === 'bench') {
      // Отправляем в BENCHED
      player.status = 'benched';
      
      if (window.csApi && window.csApi.upsertTeam) {
        await window.csApi.upsertTeam(sourceTeam);
      } else {
        const saved = await readSavedTeams();
        const idx = saved.findIndex(t => t.name === sourceTeam.name);
        if (idx !== -1) saved[idx] = sourceTeam;
        await writeSavedTeams(saved);
      }
      
      await loadAllTeams();
      closeTransferModal();
      closeEditTeamModal();
      await showTeamProfile();
      alert(`✓ ${player.name} отправлен в BENCHED`);
    } 
    else if (transferData.action === 'transfer') {
      const destTeamName = document.getElementById('destinationTeam').value;
      if (!destTeamName) {
        alert('Выберите команду для трансфера');
        return;
      }

      const destTeam = allTeams.find(t => t.name === destTeamName);
      if (!destTeam) return;

      // Удаляем игрока из исходной команды
      sourceTeam.players.splice(transferData.playerIdx, 1);

      // Добавляем в целевую команду
      if (!destTeam.players) destTeam.players = [];
      player.status = 'active'; // Когда переводим - статус active
      destTeam.players.push(player);

      // Сохраняем обе команды
      if (window.csApi && window.csApi.upsertTeam) {
        await window.csApi.upsertTeam(sourceTeam);
        await window.csApi.upsertTeam(destTeam);
      } else {
        const saved = await readSavedTeams();
        const idx1 = saved.findIndex(t => t.name === sourceTeam.name);
        const idx2 = saved.findIndex(t => t.name === destTeam.name);
        if (idx1 !== -1) saved[idx1] = sourceTeam;
        if (idx2 !== -1) saved[idx2] = destTeam;
        await writeSavedTeams(saved);
      }

      await loadAllTeams();
      closeTransferModal();
      closeEditTeamModal();
      await showTeamProfile();
      alert(`✓ ${player.name} переведен в ${destTeamName}`);
    }
  } catch (error) {
    console.error('Transfer error:', error);
    alert('❌ Ошибка при трансфере');
  }
}

// Глобальные переменные для редактирования
let currentTeamEdit = null;
let currentEditingTeam = null;

// Подготовка режима редактирования (старая система, оставляем для наград)
window._prepProfileEditMode = (team) => {
  // Оставляем пустой для совместимости
};

// Очистка режима редактирования (старая система)
window._cleanProfileEditMode = () => {
  // Оставляем пустой для совместимости
};

function initializeProfileEditOld() {
  // Старая система больше не используется
}

initializeProfileEdit();

async function showTeamProfile(teamNameParam) {
  try {
    await loadAllTeams();
    
    // Определяем имя команды: из параметра, из select, или из URL
    let teamName = teamNameParam;
    if (!teamName) {
      const select = document.getElementById('teamSelect');
      if (select) {
        teamName = select.value;
      }
    }
    if (!teamName) {
      const urlParams = new URLSearchParams(window.location.search);
      teamName = urlParams.get('team');
    }
    
    const profileContainer = document.getElementById('profile');
    if (!teamName) {
      if (profileContainer) profileContainer.classList.add('hidden');
      return;
    }
    
    if (!Array.isArray(allTeams) || allTeams.length === 0) {
      console.error('allTeams is empty or not an array');
      if (profileContainer) profileContainer.classList.add('hidden');
      return;
    }
    
    const team = allTeams.find(t => normalizeName(t.name) === normalizeName(teamName));
    if (!team) {
      console.error(`Team "${teamName}" not found in allTeams`);
      if (profileContainer) profileContainer.classList.add('hidden');
      return;
    }
    
    // 1. Миграция/инициализация id для игроков
  let teamModified = false;
  if (team.players) {
    team.players = team.players.map(p => {
      if (!p.id) {
        teamModified = true;
        return { ...p, id: 'p'+Date.now()+Math.floor(Math.random()*1e6) };
      }
      return p;
    });
  }
  // Если хоть один id добавили — сохраняем команду (это обязательно до статистики!)
  if(teamModified) {
    if(window.csApi) await window.csApi.upsertTeam(team);
    else {
      const all = await readSavedTeams();
      const idx = all.findIndex(t=>t.name===team.name);
      if(idx!==-1){ all[idx]=team; await writeSavedTeams(all); }
    }
  }
  // 2. Агрегация статистики rating2Avg/rating2Matches по всей истории
  let playerStatMap = {};
  if (Array.isArray(team.players) && Array.isArray(team.history)) {
    team.players.forEach(p => {
      playerStatMap[p.id] = { sum:0, count:0, name:p.name };
    });
    team.history.forEach(h => {
      if (!h.playerStats || !Array.isArray(h.playerStats)) return;
      h.playerStats.forEach(ps => {
        let key = ps.id && playerStatMap[ps.id] ? ps.id : null;
        if (!key) {
          for (let pid in playerStatMap) {
            if (normalizeName(playerStatMap[pid].name) === normalizeName(ps.name)) {
              key = pid; break;
            }
          }
        }
        if (key && typeof ps.rating2 === 'number') {
          playerStatMap[key].sum += ps.rating2;
          playerStatMap[key].count += 1;
        } else if (key && typeof ps.rating2 === 'string') {
          let val = parseFloat(ps.rating2); if(!isNaN(val)) {playerStatMap[key].sum+=val; playerStatMap[key].count+=1;}
        }
      });
    });
    team.players = team.players.map(p => {
      const stat = playerStatMap[p.id]||{};
      const avg = stat.count ? +(stat.sum/stat.count).toFixed(2) : (typeof p.rating === 'number'?p.rating:1.0);
      return { ...p, rating2Avg: avg, rating2Matches: stat.count||0 };
    });
  }
  
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
    
    // Win Rate за последние 15 матчей
    const last15Matches = history.slice(0, 15);
    const winsLast15 = last15Matches.filter(m => m.result === 'Win').length;
    const winRateLast15 = last15Matches.length > 0 ? Math.round((winsLast15 / last15Matches.length) * 100) : 0;
    
    const last5 = history.slice(0, 5);
    const ratingChange5 = last5.reduce((sum, m) => sum + (m.ratingChange || 0), 0);
    // Обновляем DOM безопасно
    const logoEl = document.getElementById('teamLogo');
    if (logoEl) {
      logoEl.src = team.logoUrl || 'https://via.placeholder.com/64';
      logoEl.onerror = function() { this.src = 'https://via.placeholder.com/64'; };
    }
    const nameEl = document.getElementById('teamName');
    if (nameEl) {
      nameEl.textContent = team.name;
      document.getElementById('editProfileBtn').style.display = 'inline';
    }
    const countryEl = document.getElementById('teamCountry');
    if (countryEl) {
      if (team.country) {
        // Показываем флаг (если доступен) и название страны
        const flagImg = (typeof window.getFlagImgTag === 'function') ? window.getFlagImgTag(team.country, 18, 'inline-flag') : (team.country ? getFlagByCountry(team.country) : '');
        countryEl.innerHTML = `${flagImg} <span class="font-medium text-gray-200">${team.country}</span>${team.region ? ` • <span class="text-sm text-gray-400">${team.region}</span>` : ''}`;
      } else if (team.region) {
        const regionFlag = (typeof window.getFlagByRegion === 'function') ? getFlagByRegion(team.region) : '🌍';
        countryEl.innerHTML = `${regionFlag} <span class="font-medium text-gray-200">${team.region}</span>`;
      } else {
        countryEl.textContent = '';
      }
    }
    const rankEl = document.getElementById('teamRank');
    if (rankEl) rankEl.textContent = `#${rank}`;
    // Compute weekly rank change for this team
    try {
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const recentDeltaByName = {};
      allTeams.forEach(t => {
        let sumRecent = 0;
        if (Array.isArray(t.history)) {
          t.history.forEach(h => {
            const d = new Date(h.date).getTime();
            if (!isNaN(d) && (now - d) <= weekMs) {
              const rc = typeof h.ratingChange === 'number' ? h.ratingChange : parseFloat(h.ratingChange) || 0;
              sumRecent += rc;
            }
          });
        }
        recentDeltaByName[t.name] = sumRecent;
      });
      const teamsWithPast = allTeams.map(t => ({ name: t.name, ratingNow: t.rating || 0, ratingPast: (t.rating || 0) - (recentDeltaByName[t.name] || 0) }));
      const byPast = teamsWithPast.sort((a,b)=>b.ratingPast - a.ratingPast).map((t,i)=>({ name: t.name, rank: i+1 }));
      const pastRankMap = {};
      byPast.forEach(r=> pastRankMap[r.name] = r.rank);
      const pastRank = pastRankMap[team.name] || null;
      const change = (pastRank === null) ? 0 : (pastRank - rank);
      const rankChangeEl = document.getElementById('teamCountry');
      if (rankChangeEl && typeof change === 'number' && change !== 0) {
        const el = document.createElement('div');
        el.className = 'text-sm mt-1';
        el.innerHTML = change > 0 ? `<span class="rating-change-badge up">▲${Math.abs(change)}</span> <span class="text-gray-400">this week</span>` : `<span class="rating-change-badge down">▼${Math.abs(change)}</span> <span class="text-gray-400">this week</span>`;
        rankChangeEl.appendChild(el);
      }
    } catch (e) {
      console.warn('Could not compute weekly rank change:', e);
    }
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
    const wrRecentEl = document.getElementById('winRateRecent');
    if (wrRecentEl) wrRecentEl.textContent = `${winRateLast15}%`;
    
    // Win Rate-слайдер отключён
    
    // Состав
    const roster = document.getElementById('roster');
    const banner = document.getElementById('playerBanner');
    if (roster) {
      roster.innerHTML = '';
      if (team.players && team.players.length > 0) {
        if (banner) banner.innerHTML = '';
        
        // Разделяем игроков на активных и BENCHED
        const activePlayers = team.players.filter(p => p.status !== 'benched');
        const benchedPlayers = team.players.filter(p => p.status === 'benched');
        
        // Отображаем всех игроков в списке состава
        team.players.forEach(p => {
          // Элемент состава (как было раньше, но с улучшенным дизайном)
          const div = document.createElement('div');
          div.className = 'flex items-center justify-between py-2 roster-item cursor-pointer hover:bg-gray-700/50 rounded px-2 transition';
          const stat = (typeof p.rating2Avg === 'number') ? p.rating2Avg.toFixed(2) : (!isNaN(parseFloat(p.rating)) ? String(parseFloat(p.rating)) : '1.00');
          const matchesInfo = (typeof p.rating2Matches === 'number' && p.rating2Matches > 0) ? ` <span class=\"text-xs text-gray-400\">(${p.rating2Matches})</span>` : '';
          const img = p.photoUrl ? `<img src="${p.photoUrl}" class="w-8 h-8 rounded mr-2" alt="${p.name}">` : '';
          const statusBadge = p.status === 'benched' ? '<span class="ml-3 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-bold rounded-lg shadow-lg animate-pulse border-2 border-yellow-400">BENCHED</span>' : '';
          const playerLink = `player-profile.html?player=${encodeURIComponent(p.name)}`;
          div.innerHTML = `
            <a href="${playerLink}" class="flex items-center flex-1 hover:text-blue-400 transition">${img} <span>${p.name}</span>${statusBadge}</a>
            <span>${stat}${matchesInfo}</span>
          `;
          roster.appendChild(div);
        });
        
        // Баннер: приоритет активных игроков, затем BENCHED, затем пустые слоты
        if (banner) {
          const PLACEHOLDER_IMAGE = 'https://www.hltv.org/img/static/player/player_silhouette.png';
          const MAX_BANNER_PLAYERS = 5;
          
          const bannerPlayers = [...activePlayers];
          if (bannerPlayers.length < MAX_BANNER_PLAYERS && benchedPlayers.length > 0) {
            bannerPlayers.push(...benchedPlayers.slice(0, MAX_BANNER_PLAYERS - bannerPlayers.length));
          }
          
          const displayedPlayers = bannerPlayers.slice(0, MAX_BANNER_PLAYERS);
          displayedPlayers.forEach(p => {
            const isBenched = p.status === 'benched';
            const b = document.createElement('div');
            b.className = `player-banner-item flex flex-col items-center${isBenched ? ' benched' : ''}`;
            const photo = p.photoUrl || '';
            const hasPhoto = photo && photo.trim() !== '';
            const playerLink = `player-profile.html?player=${encodeURIComponent(p.name)}`;
            const photoHtml = hasPhoto 
              ? `<a href="${playerLink}"><img src="${photo}" class="player-banner-photo mb-2" alt="${p.name}" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }"></a>`
              : '';
            const placeholderHtml = `<a href="${playerLink}"><div class="player-banner-photo-placeholder mb-2" style="${hasPhoto ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">${p.name.charAt(0).toUpperCase()}</div></a>`;
            const playerLinkStart = `<a href="${playerLink}" class="text-blue-400 hover:text-blue-300 hover:underline">`;
            const playerLinkEnd = `</a>`;
            const benchedFlag = isBenched ? '<span class="benched-flag">BENCHED</span>' : '';
            b.innerHTML = `
              <div class="player-banner-photo-wrapper flex flex-col items-center">
                ${photoHtml}
                ${placeholderHtml}
              </div>
              <div class="player-banner-name text-center w-full">${playerLinkStart}${p.name}${playerLinkEnd}</div>
              ${benchedFlag}
            `;
            banner.appendChild(b);
          });
          
          const emptySlots = Math.max(0, MAX_BANNER_PLAYERS - displayedPlayers.length);
          for (let i = 0; i < emptySlots; i++) {
            const b = document.createElement('div');
            b.className = 'player-banner-item flex flex-col items-center';
            b.innerHTML = `
              <div class="player-banner-photo-wrapper flex flex-col items-center">
                <img src="${PLACEHOLDER_IMAGE}" class="player-banner-photo mb-2" alt="?" style="opacity: 0.6;">
              </div>
              <div class="player-banner-name text-center w-full text-gray-500">?</div>
            `;
            banner.appendChild(b);
          }
        }
      } else {
        roster.innerHTML = '<p class="text-gray-500 col-span-2">Нет данных о составе</p>';
        if (banner) {
          banner.innerHTML = '';
          // Если нет игроков, показываем 5 пустых слотов
          const PLACEHOLDER_IMAGE = 'https://www.hltv.org/img/static/player/player_silhouette.png';
          for (let i = 0; i < 5; i++) {
            const b = document.createElement('div');
            b.className = 'player-banner-item flex flex-col items-center';
            b.innerHTML = `
              <div class="player-banner-photo-wrapper flex flex-col items-center">
                <img src="${PLACEHOLDER_IMAGE}" class="player-banner-photo mb-2" alt="?" style="opacity: 0.6;">
              </div>
              <div class="player-banner-name text-center w-full text-gray-500">?</div>
            `;
            banner.appendChild(b);
          }
        }
      }
    }
    renderMapStats(team);
    // История матчей с логотипами соперников
    const tbody = document.getElementById('historyBody');
    const historyToggleBtn = document.getElementById('toggleHistoryBtn');
    const historyToggleText = document.getElementById('historyToggleText');
    const HISTORY_SHOW_INITIAL = 5;
    
    if (tbody) {
      tbody.innerHTML = '';
      if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-3 text-center text-gray-500">Нет матчей</td></tr>';
        if (historyToggleBtn) historyToggleBtn.style.display = 'none';
      } else {
        history.forEach((m, index) => {
          const row = document.createElement('tr');
          row.className = `history-row ${index >= HISTORY_SHOW_INITIAL ? 'history-hidden' : ''} cursor-pointer hover:bg-gray-700/50 transition`;
          row.setAttribute('data-match-index', index);
          
          // Находим соперника для получения логотипа
          const opponentTeam = allTeams.find(t => normalizeName(t.name) === normalizeName(m.opponent || ''));
          const opponentLogo = opponentTeam?.logoUrl || '';
          const opponentLogoHtml = opponentLogo 
            ? `<img src="${opponentLogo}" class="w-4 h-4 rounded" alt="${m.opponent || ''}" onerror="this.style.display='none';">`
            : '';
          
          const changeColor = m.ratingChange >= 0 ? 'text-green-400' : 'text-red-400';
          const resultClass = m.result === 'Win' ? 'history-result-win' : (m.result === 'Loss' ? 'history-result-loss' : 'history-result-draw');
          const dateDisplay = (m.date || '').toString().slice(0,10) || 'N/A';
          
          row.innerHTML = `
            <td class="p-3 text-gray-400">${dateDisplay}</td>
            <td class="p-3">
              <div class="flex items-center gap-2">
                ${opponentLogoHtml}
                <span class="font-semibold">${m.opponent || 'N/A'}</span>
              </div>
            </td>
            <td class="p-3"><span class="history-result-badge ${resultClass}">${m.result === 'Win' ? 'Победа' : (m.result === 'Loss' ? 'Поражение' : 'Ничья')}</span></td>
            <td class="p-3 font-mono font-semibold">${m.score || 'N/A'}</td>
            <td class="p-3 ${changeColor} font-bold">${m.ratingChange >= 0 ? '+' : ''}${m.ratingChange || 0}</td>
          `;
          
          // Добавляем обработчик клика
          row.addEventListener('click', () => {
            showMatchDetails(m, team, opponentTeam);
          });
          
          tbody.appendChild(row);
        });
        
        // Настройка кнопки показать/скрыть
        if (historyToggleBtn && history.length > HISTORY_SHOW_INITIAL) {
          historyToggleBtn.style.display = 'block';
          // Удаляем старый обработчик если есть
          const newBtn = historyToggleBtn.cloneNode(true);
          historyToggleBtn.parentNode.replaceChild(newBtn, historyToggleBtn);
          
          newBtn.addEventListener('click', () => {
            const hiddenRows = tbody.querySelectorAll('.history-hidden');
            if (hiddenRows.length > 0) {
              // Показываем все
              hiddenRows.forEach(row => row.classList.remove('history-hidden'));
              if (historyToggleText) historyToggleText.textContent = 'Скрыть';
            } else {
              // Скрываем лишние
              for (let i = HISTORY_SHOW_INITIAL; i < tbody.children.length; i++) {
                tbody.children[i].classList.add('history-hidden');
              }
              if (historyToggleText) historyToggleText.textContent = 'Показать все';
            }
          });
          if (historyToggleText) historyToggleText.textContent = 'Показать все';
        } else if (historyToggleBtn) {
          historyToggleBtn.style.display = 'none';
        }
      }
    }
    // Новый график
    buildRankingChart(team);
    renderAwards(team);
    
    if (profileContainer) profileContainer.classList.remove('hidden');
    
    // Инициализируем слайдер Win Rate после загрузки профиля
    if (typeof window.initWinRateSlider === 'function') {
      setTimeout(() => {
        try {
          window.initWinRateSlider();
        } catch (e) {
          console.error('Error initializing win rate slider:', e);
        }
      }, 500);
    }
  } catch (error) {
    console.error('Error rendering team profile:', error);
    const profileContainer = document.getElementById('profile');
    if (profileContainer) profileContainer.classList.add('hidden');
  }
}

function calculateMapStatsFromHistory(history) {
  const stats = {};
  let totalMaps = 0;
  (history || []).forEach(match => {
    if (!Array.isArray(match.mapDetails)) return;
    match.mapDetails.forEach(detail => {
      if (!detail || !detail.name) return;
      const key = detail.name;
      if (!stats[key]) {
        stats[key] = {
          name: detail.name,
          wins: 0,
          losses: 0,
          played: 0,
          roundsFor: 0,
          roundsAgainst: 0,
          biggestWin: null,
          biggestLoss: null,
          biggestWinDiff: null,
          biggestLossDiff: null
        };
      }
      const entry = stats[key];
      entry.played += 1;
      totalMaps += 1;
      const teamScore = typeof detail.teamScore === 'number' ? detail.teamScore : 0;
      const opponentScore = typeof detail.opponentScore === 'number' ? detail.opponentScore : 0;
      entry.roundsFor += teamScore;
      entry.roundsAgainst += opponentScore;
      const diff = teamScore - opponentScore;
      if (detail.result === 'Win') {
        entry.wins += 1;
        if (entry.biggestWinDiff === null || diff > entry.biggestWinDiff) {
          entry.biggestWinDiff = diff;
          entry.biggestWin = `${teamScore}-${opponentScore}`;
          entry.biggestWinOpponent = match.opponent || '';
        }
      } else {
        entry.losses += 1;
        if (entry.biggestLossDiff === null || diff < entry.biggestLossDiff) {
          entry.biggestLossDiff = diff;
          entry.biggestLoss = `${teamScore}-${opponentScore}`;
          entry.biggestLossOpponent = match.opponent || '';
        }
      }
    });
  });

  const list = Object.values(stats).map(item => ({
    ...item,
    winRate: item.played ? +(item.wins / item.played * 100).toFixed(1) : 0,
    pickRate: totalMaps ? +(item.played / totalMaps * 100).toFixed(1) : 0,
    avgRounds: item.played ? +((item.roundsFor + item.roundsAgainst) / item.played).toFixed(1) : 0
  }));
  return { totalMaps, list };
}

function renderMapStats(teamLike) {
  const section = document.getElementById('mapStatsSection');
  if (!section) return;
  const highlightsContainer = document.getElementById('mapHighlights');
  const cardsContainer = document.getElementById('mapCards');
  const totalLabel = document.getElementById('mapTotalCount');

  const { totalMaps, list } = calculateMapStatsFromHistory(teamLike?.history || []);
  
  // Фильтруем старые карты (Anubis и Vertigo)
  const activeMapPool = window.mapUtils?.getPool?.() || ['Mirage', 'Dust2', 'Ancient', 'Overpass', 'Train', 'Nuke', 'Inferno'];
  let filteredList = list.filter(item => {
    const mapName = item.name || '';
    // Проверяем, есть ли карта в активном маппуле
    return activeMapPool.some(activeMap => 
      activeMap.toLowerCase() === mapName.toLowerCase() ||
      (activeMap === 'Dust2' && (mapName === 'Dust II' || mapName === 'Dust 2'))
    );
  });
  
  // Пересчитываем totalMaps только для активных карт
  const filteredTotalMaps = filteredList.reduce((sum, item) => sum + (item.played || 0), 0);
  
  // Пересчитываем pickRate на основе отфильтрованных данных
  filteredList = filteredList.map(item => ({
    ...item,
    pickRate: filteredTotalMaps ? +((item.played || 0) / filteredTotalMaps * 100).toFixed(1) : 0
  }));
  
  if (!filteredTotalMaps || filteredList.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  if (totalLabel) totalLabel.textContent = `Всего карт: ${filteredTotalMaps}`;

  const sortedByWinRate = [...filteredList].sort((a, b) => (b.winRate || 0) - (a.winRate || 0)).slice(0, 8);
  if (highlightsContainer) {
    highlightsContainer.className = 'map-bar-chart';
    highlightsContainer.innerHTML = sortedByWinRate.map(item => {
      const theme = window.mapUtils?.getTheme?.(item.name) || {};
      const winRate = Math.max(0, Math.min(100, item.winRate || 0));
      const winRateDisplay = (item.winRate || 0).toFixed(1);
      return `
        <div class="map-bar-chart-item">
          <div class="map-bar-chart-bar-wrapper">
            <div class="map-bar-chart-bar" style="height: ${winRate}%; background: ${theme.gradient};">
              <span class="map-bar-chart-value">${winRateDisplay}%</span>
            </div>
          </div>
          <div class="map-bar-chart-label">${item.name || 'Unknown'}</div>
        </div>
      `;
    }).join('');
  }

  if (cardsContainer) {
    cardsContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
    cardsContainer.innerHTML = filteredList.sort((a, b) => b.played - a.played).map(item => {
      const theme = window.mapUtils?.getTheme?.(item.name) || {};
      const mapImage = window.mapUtils?.getMapImage?.(item.name);
      return `
        <div class="map-card cursor-pointer transition hover:shadow-lg hover:border-blue-500/50" onclick="openMapHistoryModal('${item.name}')">
          <div class="map-card-image-wrapper">
            ${mapImage ? `<img src="${mapImage}" alt="${item.name}" class="map-card-image" onerror="this.style.display='none';">` : ''}
            <div class="map-card-overlay"></div>
          </div>
          <div class="map-card-content">
            <div class="map-card-header">
              <div>
                <div class="text-2xl font-bold mb-1">${item.name}</div>
                <div class="text-sm text-gray-300">${item.played} карт · ${item.pickRate.toFixed(1)}% pick</div>
              </div>
              <span class="map-pill" style="background:${theme.gradient};color:#0f172a;font-weight:700;">${item.winRate.toFixed(1)}% WR</span>
            </div>
            <div class="map-card-stats">
              <div class="map-card-metric">
                <span class="metric-label">Победы / Поражения</span>
                <span class="metric-value">
                  <span style="color: #4ade80; font-weight: 800;">${item.wins}</span>
                  <span style="color: #64748b; margin: 0 0.25rem;">/</span>
                  <span style="color: #f87171; font-weight: 800;">${item.losses}</span>
                </span>
              </div>
              <div class="map-card-metric">
                <span class="metric-label">Сред. раундов</span>
                <span class="metric-value">${item.avgRounds.toFixed(1)}</span>
              </div>
              <div class="map-card-metric">
                <span class="metric-label">Раунды (за/против)</span>
                <span class="metric-value">
                  <span style="color: #60a5fa;">${item.roundsFor}</span>
                  <span style="color: #64748b; margin: 0 0.25rem;">-</span>
                  <span style="color: #f87171;">${item.roundsAgainst}</span>
                </span>
              </div>
              <div class="map-card-metric metric-biggest-win">
                <span class="metric-label">Biggest win</span>
                <span class="metric-value">${item.biggestWin || '—'} ${item.biggestWinOpponent ? `<span style="color: #94a3b8; font-size: 0.8125rem; font-weight: 600;">vs ${item.biggestWinOpponent}</span>` : ''}</span>
              </div>
              <div class="map-card-metric metric-biggest-loss">
                <span class="metric-label">Biggest loss</span>
                <span class="metric-value">${item.biggestLoss || '—'} ${item.biggestLossOpponent ? `<span style="color: #94a3b8; font-size: 0.8125rem; font-weight: 600;">vs ${item.biggestLossOpponent}</span>` : ''}</span>
              </div>
            </div>
            <div class="mt-4 text-center text-xs text-blue-400 font-semibold">Нажми чтобы просмотреть историю матчей</div>
          </div>
        </div>
      `;
    }).join('');
  }
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
  
  // Запускаем автоматический скролл Win Rate слайдера
  startWinRateAutoScroll();
  
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

// Функция переключения слайдера Win Rate (если не определена в winrate-slider.js)
if (typeof window.switchWinRateSlide !== 'function') {
  function switchWinRateSlide(slide) {
    const slides = document.querySelectorAll('.winrate-slide');
    slides.forEach(s => s.classList.remove('winrate-slide-active'));
    const targetSlide = document.querySelector(`.winrate-slide[data-slide="${slide}"]`);
    if (targetSlide) {
      targetSlide.classList.add('winrate-slide-active');
    }
  }
  window.switchWinRateSlide = switchWinRateSlide;
}

// debug helper
async function debugTeamData() {
  const savedTeams = await readSavedTeams();
  console.log('=== DEBUG TEAM DATA ===');
  if (!Array.isArray(savedTeams)) {
    console.error('savedTeams is not an array:', savedTeams);
    return;
  }
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

  // Берём историю в стабильном порядке: в storage новые в начале, значит для графика берём reverse() — от старых к новым
  const historyArr = (Array.isArray(team.history) ? team.history : []).slice().reverse();

  // Формируем массивы для графика: X = номер матча (1..N), Y = rank или null
  // Также собираем рейтинги для tooltip
  const labels = [];
  const ranks = [];
  const ratings = [];
  const n = historyArr.length;
  
  if (n === 0) {
    // Нет истории - показываем только текущий рейтинг
    labels.push('Текущий');
    ranks.push(null);
    ratings.push(team.rating || 1500);
  } else {
    // Вычисляем рейтинг для каждого матча
    // История в historyArr отсортирована от старых к новым (после reverse)
    // Текущий рейтинг команды = team.rating (это рейтинг ПОСЛЕ всех матчей)
    
    // Вычисляем рейтинг до первого матча: из текущего рейтинга вычитаем все изменения
    let ratingBeforeFirstMatch = Number(team.rating) || 1500;
    const originalHistory = Array.isArray(team.history) ? [...team.history] : [];
    
    // Суммируем все изменения из истории
    let totalChange = 0;
    originalHistory.forEach(m => {
      if (m && typeof m.ratingChange === 'number' && !isNaN(m.ratingChange)) {
        totalChange += m.ratingChange;
      }
    });
    
    // Рейтинг до первого матча = текущий рейтинг - сумма всех изменений
    ratingBeforeFirstMatch = ratingBeforeFirstMatch - totalChange;
    
    // Теперь идем по historyArr (старые в начале) и прибавляем изменения
    // Показываем рейтинг ПОСЛЕ каждого матча
    let currentRating = ratingBeforeFirstMatch;
    for (let i = 0; i < n; i++) {
      labels.push(`Матч ${i + 1}`);
      const m = historyArr[i];
      
      // Ранг
      const r = (m && m.rank !== undefined && m.rank !== null) ? Number(m.rank) : null;
      ranks.push(isFinite(r) && !isNaN(r) && r > 0 ? r : null);
      
      // Вычисляем рейтинг ПОСЛЕ этого матча
      if (m && typeof m.ratingChange === 'number' && !isNaN(m.ratingChange)) {
        currentRating += m.ratingChange;
      }
      // Ограничиваем рейтинг разумными значениями
      currentRating = Math.max(100, Math.min(3000, Math.round(currentRating)));
      ratings.push(currentRating);
    }
  }

  // Собираем только валидные значения для расчётов
  const validRanks = ranks.filter(v => typeof v === 'number' && !isNaN(v));

  if (validRanks.length === 0) {
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

  // Расчёт пика по валидным значениям
  const peakRank = Math.min(...validRanks);
  const totalPeak = validRanks.reduce((acc, r) => acc + (r === peakRank ? 1 : 0), 0);

  const peakEl = document.getElementById('peakInfo');
  if (peakEl) peakEl.textContent = `Пик: #${peakRank} (на пике: ${totalPeak} игр)`;

  window._rankingChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Позиция в рейтинге',
        data: ranks,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        tension: 0.4,
        spanGaps: false,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#f97316',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.5,
      scales: {
        y: {
          reverse: true,
          min: 1,
          max: validRanks.length > 0 ? Math.min(Math.max(Math.max(...validRanks), allTeams.length || 1), Math.max(allTeams.length || 10, 50)) : Math.max(allTeams.length || 10, 10),
          title: { 
            display: true, 
            text: 'Место в рейтинге',
            color: '#cbd5e1',
            font: { size: 14, weight: 'bold' }
          },
          ticks: {
            color: '#94a3b8',
            font: { size: 12 }
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)'
          }
        },
        x: {
          title: { 
            display: true, 
            text: 'Матч',
            color: '#cbd5e1',
            font: { size: 14, weight: 'bold' }
          },
          ticks: {
            color: '#94a3b8',
            font: { size: 12 }
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)'
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#e2e8f0',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(96, 165, 250, 0.3)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: function(context) {
              return context[0].label;
            },
            label: function(context) {
              const index = context.dataIndex;
              const rank = ranks[index];
              const rating = ratings[index];
              const lines = [];
              if (rank !== null && rank !== undefined) {
                lines.push(`Место: #${rank}`);
              }
              if (rating !== null && rating !== undefined) {
                lines.push(`MMR: ${Math.round(rating)}`);
              }
              return lines;
            }
          }
        }
      }
    }
  });
}

function showMatchDetails(match, team, opponentTeam) {
  const modal = document.getElementById('matchDetailsModal');
  const content = document.getElementById('matchDetailsContent');
  if (!modal || !content) return;

  const teamLogo = team?.logoUrl || '';
  const opponentLogo = opponentTeam?.logoUrl || '';
  const dateDisplay = (match.date || '').toString().slice(0,10) || 'N/A';
  
  // Получаем статистику по картам
  const mapDetails = Array.isArray(match.mapDetails) ? match.mapDetails : [];
  const playerStats = Array.isArray(match.playerStats) ? match.playerStats : [];
  const mvp = match.mvp || null;

  // Получаем статистику соперника (нужно найти его команду)
  let opponentPlayerStats = [];
  if (opponentTeam && Array.isArray(opponentTeam.history)) {
    const opponentMatch = opponentTeam.history.find(m => 
      normalizeName(m.opponent) === normalizeName(team.name) &&
      m.date === match.date
    );
    if (opponentMatch && Array.isArray(opponentMatch.playerStats)) {
      opponentPlayerStats = opponentMatch.playerStats;
    }
  }

  // Функция для получения фото игрока из команды
  function getPlayerPhoto(playerName, teamPlayers) {
    if (!Array.isArray(teamPlayers)) return '';
    const player = teamPlayers.find(p => normalizeName(p.name) === normalizeName(playerName));
    return player?.photoUrl || '';
  }

  // Функция для рендеринга строки игрока в стиле главного экрана
  function renderPlayerRow(player, teamPlayers) {
    const photo = getPlayerPhoto(player.name, teamPlayers);
    const hasPhoto = photo && photo.trim() !== '';
    const photoHtml = hasPhoto 
      ? `<img src="${photo}" alt="${player.name}" class="player-photo" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }">`
      : '';
    const placeholderHtml = `<div class="player-photo-placeholder" style="${hasPhoto ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">${(player.name || '?').charAt(0).toUpperCase()}</div>`;
    
    return `
      <tr>
        <td class="player-cell">
          ${photoHtml}
          ${placeholderHtml}
          <span>${player.name || 'Unknown'}</span>
        </td>
        <td class="stat-value">${player.kills || 0}</td>
        <td class="stat-value">${player.deaths || 0}</td>
        <td class="stat-value">${player.assists || 0}</td>
        <td class="stat-value">${player.adr || 0}</td>
        <td class="rating-value">${(player.rating2 || 0).toFixed(2)}</td>
      </tr>
    `;
  }

  // Рендерим статистику для каждой карты в стиле главного экрана
  let mapsStatsHtml = '';
  mapDetails.forEach((map, mapIndex) => {
    const isWin = map.result === 'Win';
    const winnerClass1 = isWin ? 'map-score-winner' : 'map-score-loser';
    const winnerClass2 = !isWin ? 'map-score-winner' : 'map-score-loser';
    
    // Используем статистику конкретной карты, если она есть, иначе общую статистику
    const mapTeamStats = Array.isArray(map.playerStats) && map.playerStats.length > 0 
        ? map.playerStats 
        : playerStats;
    
    // Получаем статистику соперника для этой карты
    let mapOpponentStats = [];
    if (opponentTeam && Array.isArray(opponentTeam.history)) {
      const opponentMatch = opponentTeam.history.find(m => 
        normalizeName(m.opponent) === normalizeName(team.name) &&
        m.date === match.date
      );
      if (opponentMatch && Array.isArray(opponentMatch.mapDetails)) {
        const opponentMap = opponentMatch.mapDetails.find(m => m.name === map.name && m.order === map.order);
        if (opponentMap && Array.isArray(opponentMap.playerStats)) {
          mapOpponentStats = opponentMap.playerStats;
        }
      }
    }
    if (mapOpponentStats.length === 0) {
      mapOpponentStats = opponentPlayerStats;
    }
    
    // Сортируем статистику по рейтингу
    const sortedTeamStats = [...mapTeamStats].sort((a, b) => (b.rating2 || 0) - (a.rating2 || 0));
    const sortedOpponentStats = [...mapOpponentStats].sort((a, b) => (b.rating2 || 0) - (a.rating2 || 0));
    
    mapsStatsHtml += `
      <div class="map-result-header">
        <div class="map-result-title">Map ${mapIndex + 1}: ${map.name}</div>
        <div class="map-score-display">
          <div class="map-score-team ${winnerClass1}">
            ${teamLogo ? `<img src="${teamLogo}" alt="${team.name}" class="map-score-logo">` : ''}
            <span class="map-score-name">${team.name}</span>
            <span class="map-score-value">${map.teamScore}</span>
          </div>
          <span class="map-score-separator">-</span>
          <div class="map-score-team ${winnerClass2}">
            <span class="map-score-value">${map.opponentScore}</span>
            <span class="map-score-name">${match.opponent}</span>
            ${opponentLogo ? `<img src="${opponentLogo}" alt="${match.opponent}" class="map-score-logo">` : ''}
          </div>
        </div>
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
            <td colspan="6">${team.name} (${map.teamScore} rounds)</td>
          </tr>
          ${sortedTeamStats.length > 0 ? sortedTeamStats.map(p => renderPlayerRow(p, team.players || [])).join('') : '<tr><td colspan="6" class="text-center text-gray-500">Нет данных</td></tr>'}
          <tr class="team-header">
            <td colspan="6">${match.opponent} (${map.opponentScore} rounds)</td>
          </tr>
          ${sortedOpponentStats.length > 0 ? sortedOpponentStats.map(p => renderPlayerRow(p, opponentTeam?.players || [])).join('') : '<tr><td colspan="6" class="text-center text-gray-500">Нет данных</td></tr>'}
        </tbody>
      </table>
    `;
  });

  // Итоговая статистика - сортируем по рейтингу
  const sortedTeamStats = [...playerStats].sort((a, b) => (b.rating2 || 0) - (a.rating2 || 0));
  const sortedOpponentStats = [...opponentPlayerStats].sort((a, b) => (b.rating2 || 0) - (a.rating2 || 0));
  
  // Подсчитываем общее количество раундов
  const totalTeamRounds = mapDetails.reduce((sum, map) => sum + (map.teamScore || 0), 0);
  const totalOpponentRounds = mapDetails.reduce((sum, map) => sum + (map.opponentScore || 0), 0);

  // MVP отображение в стиле главного экрана
  let mvpHtml = '';
  if (mvp) {
    const mvpPhoto = mvp.photoUrl || '';
    const hasMvpPhoto = mvpPhoto && mvpPhoto.trim() !== '';
    const mvpPhotoHtml = hasMvpPhoto 
      ? `<img src="${mvpPhoto}" alt="${mvp.name}" class="mvp-photo" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }">`
      : '';
    const mvpPlaceholderHtml = `<div class="mvp-photo-placeholder" style="${hasMvpPhoto ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">${(mvp.name || '?').charAt(0).toUpperCase()}</div>`;
    
    mvpHtml = `
      <div class="mvp-display">
        <div class="mvp-badge">🏆 Match MVP</div>
        ${mvpPhotoHtml}
        ${mvpPlaceholderHtml}
        <div class="mvp-name">${mvp.name || 'Unknown'}</div>
        <div class="mvp-rating">Rating: <span class="mvp-rating-value">${mvp.avgRating || '0.00'}</span></div>
      </div>
    `;
  }

  content.innerHTML = `
    <div class="match-details-header">
      <div class="match-details-teams">
        <div class="match-details-team">
          ${teamLogo ? `<img src="${teamLogo}" alt="${team.name}" class="match-team-logo">` : ''}
          <span>${team.name}</span>
        </div>
        <div class="match-details-vs">VS</div>
        <div class="match-details-team">
          ${opponentLogo ? `<img src="${opponentLogo}" alt="${match.opponent}" class="match-team-logo">` : ''}
          <span>${match.opponent}</span>
        </div>
      </div>
      <div class="match-details-score">${match.score || 'N/A'}</div>
      <div class="match-details-date">${dateDisplay}</div>
      ${mvpHtml}
    </div>
    
    ${mapsStatsHtml}

    <div class="match-summary-section">
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
          <tr class="team-header">
            <td colspan="6">${team.name} (${totalTeamRounds} rounds)</td>
          </tr>
          ${sortedTeamStats.length > 0 ? sortedTeamStats.map(p => renderPlayerRow(p, team.players || [])).join('') : '<tr><td colspan="6" class="text-center text-gray-500">Нет данных</td></tr>'}
          <tr class="team-header">
            <td colspan="6">${match.opponent} (${totalOpponentRounds} rounds)</td>
          </tr>
          ${sortedOpponentStats.length > 0 ? sortedOpponentStats.map(p => renderPlayerRow(p, opponentTeam?.players || [])).join('') : '<tr><td colspan="6" class="text-center text-gray-500">Нет данных</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closeMatchDetailsModal() {
  const modal = document.getElementById('matchDetailsModal');
  if (modal) modal.classList.add('hidden');
}

// Делаем функцию глобальной
window.closeMatchDetailsModal = closeMatchDetailsModal;

// Закрытие по клику на фон
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('matchDetailsModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeMatchDetailsModal();
      }
    });
  }
});

// ===== ФУНКЦИИ ДЛЯ ИСТОРИИ МАТЧЕЙ ПО КАРТЕ =====

let mapHistoryState = {
  currentMap: null,
  matches: [],
  currentIndex: 0,
  autoScrollInterval: null,
  isAutoScrolling: false,
  winRateAutoScrollInterval: null,
  winRateCurrentSlide: 'recent'
};

function closeMapHistoryModal() {
  const modal = document.getElementById('mapHistoryModal');
  if (modal) modal.classList.add('hidden');
}

function openMapHistoryModal(mapName) {
  const teamName = document.getElementById('teamSelect').value;
  const team = allTeams.find(t => normalizeName(t.name) === normalizeName(teamName));
  if (!team) return;

  // Получаем все матчи с этой картой
  const matches = [];
  if (Array.isArray(team.history)) {
    team.history.forEach(match => {
      if (Array.isArray(match.mapDetails)) {
        match.mapDetails.forEach(mapDetail => {
          if (mapDetail && mapDetail.name === mapName) {
            // Определяем результат на этой карте на основе счёта
            const teamScore = typeof mapDetail.teamScore === 'number' ? mapDetail.teamScore : 0;
            const opponentScore = typeof mapDetail.opponentScore === 'number' ? mapDetail.opponentScore : 0;
            const mapResult = teamScore > opponentScore ? 'Win' : 'Loss';
            
            matches.push({
              ...match,
              mapDetail: mapDetail,
              mapResult: mapResult
            });
          }
        });
      }
    });
  }

  // Сортируем по дате (новые сверху)
  matches.sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return db - da;
  });

  mapHistoryState.currentMap = mapName;
  mapHistoryState.matches = matches;
  mapHistoryState.currentIndex = 0;
  mapHistoryState.isAutoScrolling = false;

  // Обновляем заголовок и статистику
  const title = document.getElementById('mapHistoryTitle');
  const stats = document.getElementById('mapHistoryStats');
  if (title) title.textContent = `История матчей на ${mapName}`;
  
  if (stats) {
    const wins = matches.filter(m => m.mapResult === 'Win').length;
    const losses = matches.filter(m => m.mapResult === 'Loss').length;
    const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;
    stats.textContent = `${wins} побед / ${losses} поражений · Win Rate: ${winRate}%`;
  }

  // Отрисовываем таблицу
  renderMapHistoryTable();

  // Открываем модаль
  const modal = document.getElementById('mapHistoryModal');
  if (modal) modal.classList.remove('hidden');
}

function startWinRateAutoScroll() {
  // Остановить предыдущий интервал если существует
  if (mapHistoryState.winRateAutoScrollInterval) {
    clearInterval(mapHistoryState.winRateAutoScrollInterval);
  }
  
  // Начинаем с 'recent'
  mapHistoryState.winRateCurrentSlide = 'recent';
  if (typeof window.switchWinRateSlide === 'function') {
    window.switchWinRateSlide('recent');
  }
  
  // Переключаем слайд каждые 4 секунды
  mapHistoryState.winRateAutoScrollInterval = setInterval(() => {
    if (mapHistoryState.winRateCurrentSlide === 'recent') {
      mapHistoryState.winRateCurrentSlide = 'all';
    } else {
      mapHistoryState.winRateCurrentSlide = 'recent';
    }
    
    if (typeof window.switchWinRateSlide === 'function') {
      window.switchWinRateSlide(mapHistoryState.winRateCurrentSlide);
    }
  }, 3000);
}

function renderMapHistoryTable() {
  const container = document.getElementById('mapHistoryTable');
  if (!container) return;

  container.innerHTML = '';

  if (mapHistoryState.matches.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-400 py-8">Нет матчей на этой карте</p>';
    return;
  }

  const html = mapHistoryState.matches.map((match, idx) => {
    const mapDetail = match.mapDetail || {};
    const teamScore = typeof mapDetail.teamScore === 'number' ? mapDetail.teamScore : 0;
    const opponentScore = typeof mapDetail.opponentScore === 'number' ? mapDetail.opponentScore : 0;
    const mapResult = match.mapResult || (teamScore > opponentScore ? 'Win' : 'Loss');
    const resultClass = mapResult === 'Win' ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500';
    const resultColor = mapResult === 'Win' ? 'text-green-400' : 'text-red-400';
    const isActive = idx === mapHistoryState.currentIndex ? 'border-2 border-blue-500 bg-blue-500/10' : `border border-gray-600 ${resultClass}`;

    return `
      <div class="p-4 rounded ${isActive} transition cursor-pointer hover:bg-gray-700/50" onclick="mapHistoryState.currentIndex=${idx}; renderMapHistoryTable();">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="text-gray-400 text-sm mb-1">${match.date || 'N/A'}</p>
            <p class="text-white font-bold text-lg mb-2">${match.opponent || 'Unknown'}</p>
            <div class="inline-block px-3 py-1 rounded font-bold ${resultColor} text-sm">${mapResult || '?'}</div>
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold text-white mb-2">${teamScore}-${opponentScore}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

window.closeMapHistoryModal = closeMapHistoryModal;
window.openMapHistoryModal = openMapHistoryModal;
window.startWinRateAutoScroll = startWinRateAutoScroll;

// Закрытие по клику на фон
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('mapHistoryModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeMapHistoryModal();
      }
    });
  }
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllTeams();
  
  // Заполняем select
  const teamSelect = document.getElementById('teamSelect');
  if (teamSelect) {
    teamSelect.addEventListener('change', showTeamProfile);
    if (allTeams.length > 0) {
      allTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.name;
        option.textContent = team.name;
        teamSelect.appendChild(option);
      });
    }
  }
  
  // Показываем профиль если передан параметр в URL
  const urlParams = new URLSearchParams(window.location.search);
  const teamParam = urlParams.get('team');
  if (teamParam) {
    teamSelect.value = teamParam;
    await showTeamProfile();
  }

  // Инициализируем редактирование
  initializeProfileEdit();
});
