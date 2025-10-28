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
async function updateTeamRatings(team1Name, team2Name, winnerName, finalScore) {
    console.log('updateTeamRatings called', team1Name, team2Name, winnerName, finalScore);
    const savedTeams = await readSavedTeams();

    const idx1 = savedTeams.findIndex(t => t.name === team1Name);
    const idx2 = savedTeams.findIndex(t => t.name === team2Name);
    if (idx1 === -1 || idx2 === -1) {
        console.warn('One or both teams not found when updating ratings:', team1Name, team2Name);
        // если команда отсутствует — ничего не делаем
        return;
    }

    const t1 = { ...savedTeams[idx1], history: Array.isArray(savedTeams[idx1].history) ? [...savedTeams[idx1].history] : [] };
    const t2 = { ...savedTeams[idx2], history: Array.isArray(savedTeams[idx2].history) ? [...savedTeams[idx2].history] : [] };

    const kFactor = 32;
    const expected1 = 1 / (1 + Math.pow(10, (t2.rating - t1.rating) / 400));
    const expected2 = 1 - expected1;

    let delta1 = 0, delta2 = 0;
    if (winnerName === team1Name) {
        delta1 = Math.round(kFactor * (1 - expected1));
        delta2 = Math.round(kFactor * (0 - expected2));
    } else if (winnerName === team2Name) {
        delta1 = Math.round(kFactor * (0 - expected1));
        delta2 = Math.round(kFactor * (1 - expected2));
    } else {
        // ничья (на всякий случай)
        delta1 = Math.round(kFactor * (0.5 - expected1));
        delta2 = Math.round(kFactor * (0.5 - expected2));
    }

    t1.rating = Math.max(100, Math.round(t1.rating + delta1));
    t2.rating = Math.max(100, Math.round(t2.rating + delta2));

    const date = new Date().toISOString().split('T')[0];

    // Обеспечиваем корректный score строкой
    const scoreStr = typeof finalScore === 'string' ? finalScore : (finalScore && finalScore.score) ? finalScore.score : 'N/A';

    const entry1 = {
        date,
        opponent: team2Name,
        result: winnerName === team1Name ? 'Win' : (winnerName === team2Name ? 'Loss' : 'Draw'),
        score: scoreStr,
        ratingChange: delta1
    };
    const entry2 = {
        date,
        opponent: team1Name,
        result: winnerName === team2Name ? 'Win' : (winnerName === team1Name ? 'Loss' : 'Draw'),
        score: scoreStr.split('-').reverse().join('-'),
        ratingChange: delta2
    };

    // Добавляем в начало истории (новые сверху)
    t1.history = [entry1, ...t1.history];
    t2.history = [entry2, ...t2.history];

    // Сохраняем обратно только изменённые команды, чтобы не перезаписывать игроков
    if (window.csApi) {
        await window.csApi.upsertTeamsBulk([t1, t2]);
    } else {
        savedTeams[idx1] = t1;
        savedTeams[idx2] = t2;
        await writeSavedTeams(savedTeams);
    }

    console.log('Ratings updated and history appended for', team1Name, team2Name);
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
            statsDiv.innerHTML += `
                <h3 class="text-lg font-semibold mb-2">Map ${mapNumber} (${mapName}): ${winner} (${score1}-${score2})${isOvertime ? ` (Overtime ${otNumber})` : ''}</h3>
                <p class="text-yellow-400 mb-2">MVP: ${mvp.name} (Rating: ${mvp.rating2})</p>
                <table class="w-full text-left text-sm border-collapse mb-6">
                    <thead>
                        <tr class="bg-gray-700">
                            <th class="p-2">Player</th>
                            <th class="p-2">K</th>
                            <th class="p-2">D</th>
                            <th class="p-2">A</th>
                            <th class="p-2">ADR</th>
                            <th class="p-2">Rating 2.0</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="bg-gray-600">
                            <td class="p-2 font-bold" colspan="6">${team1Name} (${score1} rounds)</td>
                        </tr>
                        ${sortedTeam1Stats.map(p => `
                            <tr class="hover:bg-gray-500">
                                <td class="p-2">${p.name}</td>
                                <td class="p-2">${p.kills}</td>
                                <td class="p-2">${p.deaths}</td>
                                <td class="p-2">${p.assists}</td>
                                <td class="p-2">${p.adr}</td>
                                <td class="p-2">${p.rating2}</td>
                            </tr>
                        `).join('')}
                        <tr class="bg-gray-600">
                            <td class="p-2 font-bold" colspan="6">${team2Name} (${score2} rounds)</td>
                        </tr>
                        ${sortedTeam2Stats.map(p => `
                            <tr class="hover:bg-gray-500">
                                <td class="p-2">${p.name}</td>
                                <td class="p-2">${p.kills}</td>
                                <td class="p-2">${p.deaths}</td>
                                <td class="p-2">${p.assists}</td>
                                <td class="p-2">${p.adr}</td>
                                <td class="p-2">${p.rating2}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        callback({ score1, score2, winner, isOvertime });
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
    if (name && !isNaN(rating)) team1Players.push({ name, rating, photoUrl });
  });
  document.querySelectorAll('#team2Players > div').forEach(div => {
    const name = div.children[0].value.trim();
    const rating = parseFloat(div.children[1].value);
    const photoUrl = (div.children[2]?.value || '').trim();
    if (name && !isNaN(rating)) team2Players.push({ name, rating, photoUrl });
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

          if (resultDiv) {
            resultDiv.innerHTML += `<p class="text-green-400 text-2xl mt-4">Победа: <b>${finalWinner}</b> ${finalScore}!</p>`;
          }

          // === ВАЖНО: обновляем рейтинг ТОЛЬКО один раз после полного матча ===
          if (isRated) {
            try {
              (async () => { await updateTeamRatings(team1Name, team2Name, finalWinner, finalScore); })();
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
window.onload = () => {
    loadSavedTeams();
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
