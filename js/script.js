// script.js - исправленная версия

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

const maps = ['Mirage', 'Inferno', 'Dust2', 'Nuke', 'Vertigo', 'Ancient', 'Anubis'];

// ---------- Utilities (Supabase-aware) ----------
async function readSavedTeams() {
    try {
        if (window.csApi) {
            return await window.csApi.fetchTeams();
        }
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
        console.error('Error reading teams:', e);
        return [];
    }
}
async function writeSavedTeams(arr) {
    if (window.csApi) {
        await window.csApi.upsertTeamsBulk(arr || []);
    } else {
        localStorage.setItem('cs_teams', JSON.stringify(arr));
    }
}

// ---------- Load/Save Teams ----------
async function loadSavedTeams() {
    let savedTeams = await readSavedTeams();

    const team1Select = document.getElementById('team1Load');
    const team2Select = document.getElementById('team2Load');
    if (team1Select) {
        team1Select.innerHTML = '<option value="">Select a saved team</option>';
    }
    if (team2Select) {
        team2Select.innerHTML = '<option value="">Select a saved team</option>';
    }

    savedTeams.forEach(team => {
        const optionHtml = `<option value="${team.name}">${team.name}</option>`;
        if (team1Select) team1Select.insertAdjacentHTML('beforeend', optionHtml);
        if (team2Select) team2Select.insertAdjacentHTML('beforeend', optionHtml);
    });

    // Для локального режима синхронизируем структуру
    if (!window.csApi) await writeSavedTeams(savedTeams);
    
    // Инициализируем поиск команд
    initTeamSearch();
}

// ---------- Team Search Functionality ----------
let allTeamsCache = [];
let selectedTeamIndex = { team1: -1, team2: -1 };

async function initTeamSearch() {
    // Загружаем все команды (включая HLTV) в кэш
    const savedTeams = await readSavedTeams();
    allTeamsCache = [...savedTeams];
    
    // Добавляем HLTV команды
    hltvTeams.forEach(hltvTeam => {
        if (!allTeamsCache.find(t => t.name === hltvTeam.name)) {
            allTeamsCache.push({
                name: hltvTeam.name,
                logoUrl: hltvTeam.logoUrl || '',
                players: hltvTeam.players || [],
                rating: 1500,
                history: [],
                isHltv: true
            });
        }
    });
    
    // Инициализируем поиск для обеих команд
    setupTeamSearch(1);
    setupTeamSearch(2);
}

function setupTeamSearch(teamNum) {
    const searchInput = document.getElementById(`team${teamNum}Search`);
    const dropdown = document.getElementById(`team${teamNum}Dropdown`);
    
    if (!searchInput || !dropdown) return;
    
    // Проверяем, были ли уже добавлены обработчики
    if (searchInput.dataset.searchInitialized === 'true') return;
    searchInput.dataset.searchInitialized = 'true';
    
    // Обработчик ввода
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length === 0) {
            dropdown.classList.add('hidden');
            return;
        }
        
        filterAndShowTeams(teamNum, query);
    });
    
    // Обработчик фокуса
    searchInput.addEventListener('focus', () => {
        const query = searchInput.value.toLowerCase().trim();
        if (query.length > 0) {
            filterAndShowTeams(teamNum, query);
        } else {
            // Показываем все команды при фокусе на пустом поле
            showAllTeams(teamNum);
        }
    });
    
    // Закрытие при клике вне (один глобальный обработчик для всех поисков)
    if (!window.teamSearchClickHandler) {
        window.teamSearchClickHandler = (e) => {
            const allSearchInputs = document.querySelectorAll('[id$="Search"]');
            const allDropdowns = document.querySelectorAll('[id$="Dropdown"]');
            
            let clickedInside = false;
            allSearchInputs.forEach(input => {
                if (input.contains(e.target)) clickedInside = true;
            });
            allDropdowns.forEach(drop => {
                if (drop.contains(e.target)) clickedInside = true;
            });
            
            if (!clickedInside) {
                allDropdowns.forEach(drop => drop.classList.add('hidden'));
            }
        };
        document.addEventListener('click', window.teamSearchClickHandler);
    }
    
    // Навигация клавиатурой
    searchInput.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.team-search-item:not(.team-search-item-empty)');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedTeamIndex[`team${teamNum}`] = Math.min(
                selectedTeamIndex[`team${teamNum}`] + 1,
                items.length - 1
            );
            updateSelectedItem(teamNum, items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedTeamIndex[`team${teamNum}`] = Math.max(
                selectedTeamIndex[`team${teamNum}`] - 1,
                -1
            );
            updateSelectedItem(teamNum, items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedTeamIndex[`team${teamNum}`] >= 0 && items[selectedTeamIndex[`team${teamNum}`]]) {
                items[selectedTeamIndex[`team${teamNum}`]].click();
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
        }
    });
}

function filterAndShowTeams(teamNum, query) {
    const dropdown = document.getElementById(`team${teamNum}Dropdown`);
    const filtered = allTeamsCache.filter(team => 
        team.name.toLowerCase().includes(query)
    );
    
    renderTeamDropdown(teamNum, filtered);
    selectedTeamIndex[`team${teamNum}`] = -1;
}

function showAllTeams(teamNum) {
    renderTeamDropdown(teamNum, allTeamsCache);
    selectedTeamIndex[`team${teamNum}`] = -1;
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

async function loadTeamByName(teamNum, teamName) {
    const savedTeams = await readSavedTeams();
    const team = savedTeams.find(t => t.name === teamName);
    if (!team) return;
    
    document.getElementById(`team${teamNum}Name`).value = team.name;
    document.getElementById(`team${teamNum}LogoUrl`).value = team.logoUrl || '';
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
    // собираем игроков (включая фото)
    const players = [];
    document.querySelectorAll(`#team${teamNum}Players > div`).forEach(div => {
        const name = div.children[0].value.trim();
        const rating = parseFloat(div.children[1].value);
        const photoUrl = (div.children[2]?.value || '').trim();
        if (name && !isNaN(rating)) players.push({ name, rating, photoUrl });
    });

    if (players.length !== 5) {
        alert('Each team must have exactly 5 players with valid names and ratings!');
        return;
    }

    if (window.csApi) {
        const currentTeams = await readSavedTeams();
        const existing = currentTeams.find(t => t.name === teamName);
        const teamData = existing ? { ...existing, logoUrl: logoUrl || existing.logoUrl || '', players } : { name: teamName, logoUrl: logoUrl || '', players, rating: 1500, history: [] };
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
            teamData = { ...existing, name: teamName, logoUrl: logoUrl || existing.logoUrl || '', players };
            savedTeams[existingIndex] = teamData;
        } else {
            teamData = { name: teamName, logoUrl: logoUrl || '', players, rating: 1500, history: [] };
            savedTeams.push(teamData);
        }
        await writeSavedTeams(savedTeams);
    }
    await loadSavedTeams();
    // Обновляем кэш команд для поиска
    await initTeamSearch();
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

function normalizeName(name) {
  return (name||'').toLowerCase().trim();
}

async function updateTeamRatings(team1Name, team2Name, winnerName, finalScore, playerSeriesRatings, playerSeriesStats) {
    const savedTeams = await readSavedTeams();
    const idx1 = savedTeams.findIndex(t => t.name === team1Name);
    const idx2 = savedTeams.findIndex(t => t.name === team2Name);
    if (idx1 === -1 || idx2 === -1) {
        console.warn('One or both teams not found when updating ratings:', team1Name, team2Name);
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
    const mvpData = mvpMatch ? { name: mvpMatch.name, photoUrl: mvpMatch.photoUrl, avgRating: mvpMatch.avgRating } : null;
    const entry1 = { date, opponent: team2Name, result: winnerName === team1Name ? 'Win' : (winnerName === team2Name ? 'Loss' : 'Draw'), score: scoreStr, ratingChange: delta1, rank: t1Rank, mvp: mvpData, playerStats: Array.isArray(playerSeriesStats?.team1) ? playerSeriesStats.team1.map(p=>({id:p.id,name:p.name,rating2:parseFloat(p.rating2)})) : [] };
    const entry2 = { date, opponent: team1Name, result: winnerName === team2Name ? 'Win' : (winnerName === team1Name ? 'Loss' : 'Draw'), score: scoreStr.split('-').reverse().join('-'), ratingChange: delta2, rank: t2Rank, mvp: mvpData, playerStats: Array.isArray(playerSeriesStats?.team2) ? playerSeriesStats.team2.map(p=>({id:p.id,name:p.name,rating2:parseFloat(p.rating2)})) : [] };

    t1.history = [entry1, ...t1.history];
    t2.history = [entry2, ...t2.history];

    if (window.csApi) {
        await window.csApi.upsertTeamsBulk([t1, t2]);
        
        // Сохраняем статистику игроков в Supabase
        if (playerSeriesStats?.team1 && Array.isArray(playerSeriesStats.team1)) {
            for (const player of playerSeriesStats.team1) {
                const stat = entry1.playerStats.find(p => p.id === player.id);
                if (stat) {
                    await window.csApi.savePlayerMatch({
                        player_name: stat.name,
                        team_name: t1.name,
                        opponent: t2.name,
                        match_date: date,
                        result: entry1.result,
                        score: scoreStr,
                        rating: parseFloat(stat.rating2),
                        kills: player.kills || 0,
                        deaths: player.deaths || 0,
                        adr: parseFloat(player.adr) || 0
                    });
                }
            }
        }
        if (playerSeriesStats?.team2 && Array.isArray(playerSeriesStats.team2)) {
            for (const player of playerSeriesStats.team2) {
                const stat = entry2.playerStats.find(p => p.id === player.id);
                if (stat) {
                    await window.csApi.savePlayerMatch({
                        player_name: stat.name,
                        team_name: t2.name,
                        opponent: t1.name,
                        match_date: date,
                        result: entry2.result,
                        score: entry2.score,
                        rating: parseFloat(stat.rating2),
                        kills: player.kills || 0,
                        deaths: player.deaths || 0,
                        adr: parseFloat(player.adr) || 0
                    });
                }
            }
        }
    } else {
        savedTeams[idx1] = t1;
        savedTeams[idx2] = t2;
        await writeSavedTeams(savedTeams);
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
        const kills = Math.floor((Math.random() * 5 + baseKills + (isWinner ? 3 : -3)) * ratingFactor);
        const deaths = Math.floor((Math.random() * 5 + baseKills - (isWinner ? 3 : -3)) / Math.max(0.5, ratingFactor));
        const assists = Math.floor(Math.random() * Math.max(0, kills) * 0.4);
        const adr = (Math.random() * 30 + 60 * (player.rating || 1)).toFixed(0);
        const rating2 = (player.rating + (isWinner ? Math.random() * 0.4 : -Math.random() * 0.3)).toFixed(2);
        return { ...player, kills: Math.max(0, kills), deaths: Math.max(0, deaths), assists, adr, rating2 };
    });
}

function simulateLiveMap(team1Name, team2Name, team1Chance, team1Players, team2Players, team1Logo, team2Logo, mapNumber, simSpeed, callback) {
    const mapName = maps[Math.floor(Math.random() * maps.length)];
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
            <h3 class="text-lg font-semibold mb-2">Map ${mapNumber} (${mapName}) (Live)</h3>
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

    let timeout = simSpeed === 'fast' ? 500 : 1800;
    const isInstant = simSpeed === 'instant';

    function simulateRound() {
        const random = Math.random() * 100;
        if (random < team1Chance) score1++; else score2++;
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
                    <div class="map-result-title">Map ${mapNumber}: ${mapName}${isOvertime ? ` <span class="overtime-badge">Overtime ${otNumber}</span>` : ''}</div>
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

        callback({ score1, score2, winner, isOvertime, team1Stats, team2Stats });
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
  const team1Name = document.getElementById('team1Name').value.trim() || 'Team A';
  const team2Name = document.getElementById('team2Name').value.trim() || 'Team B';
  let team1Chance = parseInt(document.getElementById('team1Chance').value);
  if (isNaN(team1Chance)) team1Chance = 50;
  const matchFormat = document.getElementById('matchFormat').value;
  const simSpeed = document.getElementById('simSpeed').value;
  const isRated = document.getElementById('ratedMatch').checked;
  const team1Logo = getLogo('team1');
  const team2Logo = getLogo('team2');
  const resultDiv = document.getElementById('result');
  const statsDiv = document.getElementById('stats');
  const liveScoreDiv = document.getElementById('liveScore');

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
      if (!pl.id) pl = makePlayer(name, rating, photoUrl); // всегда присваиваем id если нет
      team1Players.push(pl);
    }
  });
  document.querySelectorAll('#team2Players > div').forEach(div => {
    const name = div.children[0].value.trim();
    const rating = parseFloat(div.children[1].value);
    const photoUrl = (div.children[2]?.value || '').trim();
    if (name && !isNaN(rating)) {
      let pl = { name, rating, photoUrl };
      if (!pl.id) pl = makePlayer(name, rating, photoUrl); // всегда присваиваем id если нет
      team2Players.push(pl);
    }
  });

  if (team1Players.length !== 5 || team2Players.length !== 5) {
    if (resultDiv) resultDiv.innerHTML = '<span class="text-red-500">5 игроков!</span>';
    return;
  }

  if (resultDiv) resultDiv.innerHTML = ''; 
  if (statsDiv) statsDiv.innerHTML = ''; 
  if (liveScoreDiv) liveScoreDiv.classList.add('hidden');

  const maxMaps = matchFormat === 'BO1' ? 1 : matchFormat === 'BO3' ? 3 : 5;
  const winsNeeded = Math.ceil(maxMaps / 2);
  let team1Wins = 0, team2Wins = 0, map = 1;

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
      if (idx !== -1) {
        const existing = savedTeams[idx];
        savedTeams[idx] = {
          ...existing,
          logoUrl: logoUrl || existing.logoUrl || '',
          players: Array.isArray(players) && players.length === 5 ? players : existing.players
        };
      } else {
        savedTeams.push({
          name,
          logoUrl: logoUrl || '',
          players: Array.isArray(players) ? players : [],
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
      simulateLiveMap(team1Name, team2Name, team1Chance, team1Players, team2Players, team1Logo, team2Logo, map, simSpeed, (result) => {
        // Результат одной карты
        mapResults.push(result);
        if (result.winner === team1Name) team1Wins++; else team2Wins++;
        scoreDisplay.textContent = `${team1Wins} - ${team2Wins}`;

        // Если матч не закончен — следующая карта
        if (team1Wins < winsNeeded && team2Wins < winsNeeded) {
          map++;
          setTimeout(playNextMap, 800); // небольшая пауза между картами
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
          
          let mvpMatch = null;
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
                await updateTeamRatings(team1Name, team2Name, finalWinner, finalScore, playerSeriesRatings, { team1: team1Rows, team2: team2Rows });
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
            }
          })();
        }
      });
    }
  }

  playNextMap();
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
