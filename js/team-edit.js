// team-edit.js - Система редактирования команд и трансферов

let currentEditingTeam = null;
let currentTransferPlayer = null;

// ==================== РЕДАКТИРОВАНИЕ КОМАНДЫ ====================

async function openEditTeamModal() {
  console.log('openEditTeamModal вызвана');
  const select = document.getElementById('teamSelect');
  if (!select || !select.value) {
    alert('Выберите команду');
    return;
  }

  const teamName = select.value;
  console.log('Выбрана команда:', teamName);
  
  // Используем глобальную переменную allTeams из team-profile.js
  if (!window.allTeams || window.allTeams.length === 0) {
    console.error('allTeams не найдена или пуста');
    alert('Команды не загружены');
    return;
  }

  console.log('Найдено команд:', window.allTeams.length);
  const team = window.allTeams.find(t => t.name === teamName);
  if (!team) {
    console.error('Команда не найдена:', teamName);
    alert('Команда не найдена');
    return;
  }

  currentEditingTeam = JSON.parse(JSON.stringify(team)); // Глубокая копия

  // Заполняем форму
  document.getElementById('editTeamName').value = team.name;
  document.getElementById('editTeamLogo').value = team.logoUrl || '';

  // Генерируем строки для игроков
  renderEditPlayersList();

  // Показываем модальное окно
  const modal = document.getElementById('editTeamModal');
  console.log('Modal element:', modal);
  modal.classList.remove('hidden');
  console.log('Modal now visible');
}

function closeEditTeamModal() {
  const modal = document.getElementById('editTeamModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  currentEditingTeam = null;
}

function renderEditPlayersList() {
  const container = document.getElementById('editPlayersList');
  container.innerHTML = '';

  if (!currentEditingTeam.players) currentEditingTeam.players = [];

  currentEditingTeam.players.forEach((player, idx) => {
    const row = document.createElement('div');
    row.className = 'bg-gray-700 rounded p-3 flex gap-2 items-end';
    row.innerHTML = `
      <div class="flex-1">
        <label class="text-sm text-gray-300">Имя</label>
        <input type="text" class="playerEditName w-full px-2 py-1 bg-gray-600 rounded text-white border border-gray-500" 
               value="${player.name || ''}" data-idx="${idx}">
      </div>
      <div class="w-24">
        <label class="text-sm text-gray-300">Рейтинг</label>
        <input type="number" class="playerEditRating w-full px-2 py-1 bg-gray-600 rounded text-white border border-gray-500" 
               value="${player.rating || 1.0}" step="0.1" data-idx="${idx}">
      </div>
      <div class="w-24">
        <label class="text-sm text-gray-300">Статус</label>
        <select class="playerEditStatus w-full px-2 py-1 bg-gray-600 rounded text-white border border-gray-500" data-idx="${idx}">
          <option value="active" ${(player.status === 'active' || !player.status) ? 'selected' : ''}>Active</option>
          <option value="benched" ${player.status === 'benched' ? 'selected' : ''}>Benched</option>
        </select>
      </div>
      <button onclick="removePlayerFromEdit(${idx})" class="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm">✕</button>
      <button onclick="openTransferModal(${idx})" class="px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-white text-sm">Трансфер</button>
    `;
    container.appendChild(row);
  });
}

function addNewPlayerRow() {
  if (!currentEditingTeam.players) currentEditingTeam.players = [];
  currentEditingTeam.players.push({ name: '', rating: 1.0, status: 'active' });
  renderEditPlayersList();
}

function removePlayerFromEdit(idx) {
  if (confirm('Удалить игрока из команды?')) {
    currentEditingTeam.players.splice(idx, 1);
    renderEditPlayersList();
  }
}

async function saveTeamEdit() {
  const nameInput = document.getElementById('editTeamName');
  const logoInput = document.getElementById('editTeamLogo');

  if (!nameInput.value.trim()) {
    alert('Введите название команды');
    return;
  }

  currentEditingTeam.name = nameInput.value.trim();
  currentEditingTeam.logoUrl = logoInput.value.trim();

  // Собираем данные игроков из input'ов
  const nameInputs = document.querySelectorAll('.playerEditName');
  const ratingInputs = document.querySelectorAll('.playerEditRating');
  const statusInputs = document.querySelectorAll('.playerEditStatus');

  currentEditingTeam.players = [];
  nameInputs.forEach((nameInput, idx) => {
    const name = nameInput.value.trim();
    if (name) { // Добавляем только непустые имена
      const rating = parseFloat(ratingInputs[idx].value) || 1.0;
      const status = statusInputs[idx].value;
      currentEditingTeam.players.push({
        id: `player_${Date.now()}_${idx}`,
        name,
        rating,
        status,
        photoUrl: currentEditingTeam.players[idx]?.photoUrl || ''
      });
    }
  });

  // Сохраняем в БД/localStorage
  if (window.csApi && window.csApi.upsertTeam) {
    await window.csApi.upsertTeam(currentEditingTeam);
  } else if (window.writeSavedTeams) {
    const saved = await window.readSavedTeams();
    const idx = saved.findIndex(t => t.name === currentEditingTeam.name);
    if (idx !== -1) {
      saved[idx] = currentEditingTeam;
    } else {
      saved.push(currentEditingTeam);
    }
    await window.writeSavedTeams(saved);
  }

  // Перезагружаем и закрываем
  if (window.loadAllTeams) {
    await window.loadAllTeams();
  }
  if (window.showTeamProfile) {
    await window.showTeamProfile();
  }
  closeEditTeamModal();
  alert('Команда сохранена!');
}

// ==================== СИСТЕМА ТРАНСФЕРОВ ====================

function openTransferModal(playerIdx) {
  if (!currentEditingTeam.players || !currentEditingTeam.players[playerIdx]) return;

  currentTransferPlayer = {
    playerIdx: playerIdx,
    player: currentEditingTeam.players[playerIdx]
  };

  // Отображаем информацию об игроке
  const info = document.getElementById('transferPlayerInfo');
  info.innerHTML = `<strong>${currentTransferPlayer.player.name}</strong><br><span class="text-gray-400">Текущая команда: ${currentEditingTeam.name}</span>`;

  // Обработчик изменения действия
  const actionSelect = document.getElementById('transferAction');
  const teamSelectDiv = document.getElementById('teamSelectDiv');

  actionSelect.onchange = () => {
    if (actionSelect.value === 'move') {
      teamSelectDiv.classList.remove('hidden');
      fillTransferTeamSelect();
    } else {
      teamSelectDiv.classList.add('hidden');
    }
  };

  // По умолчанию "bench"
  actionSelect.value = 'bench';
  teamSelectDiv.classList.add('hidden');

  document.getElementById('transferModal').classList.remove('hidden');
}

function closeTransferModal() {
  const modal = document.getElementById('transferModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  currentTransferPlayer = null;
}

function fillTransferTeamSelect() {
  const select = document.getElementById('transferTeamSelect');
  select.innerHTML = '<option value="">-- Выберите команду --</option>';

  if (!window.allTeams || !Array.isArray(window.allTeams)) return;

  window.allTeams.forEach(team => {
    if (team.name !== currentEditingTeam.name) {
      const option = document.createElement('option');
      option.value = team.name;
      option.textContent = team.name;
      select.appendChild(option);
    }
  });
}

async function confirmTransfer() {
  const action = document.getElementById('transferAction').value;

  if (!currentTransferPlayer) return;

  if (action === 'bench') {
    // Отправляем в запас
    currentEditingTeam.players[currentTransferPlayer.playerIdx].status = 'benched';
  } else if (action === 'move') {
    // Переводим в другую команду
    const targetTeamName = document.getElementById('transferTeamSelect').value;
    if (!targetTeamName) {
      alert('Выберите целевую команду');
      return;
    }

    const targetTeam = window.allTeams.find(t => t.name === targetTeamName);
    if (!targetTeam) return;

    // Добавляем игрока в целевую команду
    if (!targetTeam.players) targetTeam.players = [];
    const movedPlayer = { ...currentEditingTeam.players[currentTransferPlayer.playerIdx] };
    movedPlayer.status = 'active';
    targetTeam.players.push(movedPlayer);

    // Удаляем из текущей команды
    currentEditingTeam.players.splice(currentTransferPlayer.playerIdx, 1);

    // Сохраняем обе команды
    if (window.csApi && window.csApi.upsertTeamsBulk) {
      await window.csApi.upsertTeamsBulk([currentEditingTeam, targetTeam]);
    } else if (window.writeSavedTeams) {
      const saved = await window.readSavedTeams();
      const idx1 = saved.findIndex(t => t.name === currentEditingTeam.name);
      const idx2 = saved.findIndex(t => t.name === targetTeam.name);
      if (idx1 !== -1) saved[idx1] = currentEditingTeam;
      if (idx2 !== -1) saved[idx2] = targetTeam;
      await window.writeSavedTeams(saved);
    }

    if (window.loadAllTeams) {
      await window.loadAllTeams();
    }
    renderEditPlayersList();
    closeTransferModal();
    alert(`${currentTransferPlayer.player.name} переведён в ${targetTeamName}`);
    return;
  }

  // Для "bench" просто обновляем состав
  renderEditPlayersList();
  closeTransferModal();
  alert(`${currentTransferPlayer.player.name} отправлен в запас`);
}
