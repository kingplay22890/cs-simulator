// player-profile.js - Профиль игрока с интеграцией Supabase

let playerData = null;
let allTeams = [];

async function loadAllTeams() {
  try {
    if (window.csApi) {
      allTeams = await window.csApi.fetchTeams();
    } else {
      const saved = localStorage.getItem('cs_teams');
      allTeams = JSON.parse(saved || '[]');
    }
  } catch (error) {
    console.error('Error loading teams:', error);
  }
}

async function fetchPlayerStats(playerName) {
  try {
    // Сначала пытаемся получить из Supabase
    if (window.csApi && window.csApi.fetchPlayerStats) {
      const supabaseStats = await window.csApi.fetchPlayerStats(playerName);
      if (supabaseStats) {
        return supabaseStats;
      }
    }
    
    // Fallback: собираем статистику из localStorage
    return aggregatePlayerStats(playerName);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return aggregatePlayerStats(playerName);
  }
}

function aggregatePlayerStats(playerName) {
  let totalMatches = 0;
  let wins = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let bestRating = 0;
  let matchHistory = [];
  let currentTeam = null;
  let photoUrl = null;
  let mvpCount = 0;
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAdr = 0;
  let adrCount = 0;

  allTeams.forEach(team => {
    if (!Array.isArray(team.history)) return;
    
    team.history.forEach(match => {
      if (!Array.isArray(match.playerStats)) return;
      
      const playerStat = match.playerStats.find(p => 
        (p.name || '').toLowerCase().trim() === playerName.toLowerCase().trim()
      );

      if (playerStat) {
        totalMatches++;
        const rating = typeof playerStat.rating2 === 'number' ? playerStat.rating2 : 1.0;
        ratingSum += rating;
        ratingCount++;
        bestRating = Math.max(bestRating, rating);

        // Собираем детальную статистику
        const kills = playerStat.kills || 0;
        const deaths = playerStat.deaths || 0;
        const adr = playerStat.adr || 0;
        
        totalKills += kills;
        totalDeaths += deaths;
        totalAdr += parseFloat(adr) || 0;
        adrCount++;

        if (match.result === 'Win') wins++;

        // Проверяем, является ли игрок MVP
        const isMvp = match.mvp && (match.mvp.name || '').toLowerCase().trim() === playerName.toLowerCase().trim();
        if (isMvp) mvpCount++;

        matchHistory.push({
          date: match.date,
          team: team.name,
          opponent: match.opponent,
          result: match.result,
          score: match.score,
          rating: rating,
          is_mvp: isMvp,
          kills: kills,
          deaths: deaths,
          adr: adr
        });

        currentTeam = team.name;
      }
    });

    // Ищем фото игрока в составе команды
    if (team.players && Array.isArray(team.players)) {
      const player = team.players.find(p => 
        (p.name || '').toLowerCase().trim() === playerName.toLowerCase().trim()
      );
      if (player && player.photoUrl && !photoUrl) {
        photoUrl = player.photoUrl;
      }
    }
  });

  const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(2) : 0;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const kdRatio = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills > 0 ? totalKills.toFixed(2) : '0.00';
  const avgAdr = adrCount > 0 ? (totalAdr / adrCount).toFixed(2) : '0.00';

  return {
    player_name: playerName,
    current_team: currentTeam,
    total_matches: totalMatches,
    wins: wins,
    avg_rating: parseFloat(avgRating),
    best_rating: bestRating,
    win_rate: winRate,
    photo_url: photoUrl,
    mvp_count: mvpCount,
    total_kills: totalKills,
    total_deaths: totalDeaths,
    kd_ratio: parseFloat(kdRatio),
    avg_adr: parseFloat(avgAdr),
    match_history: matchHistory.sort((a, b) => new Date(b.date) - new Date(a.date))
  };
}

async function showPlayerProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const playerName = urlParams.get('player');

  if (!playerName) {
    document.querySelector('.container').innerHTML = '<div class="text-center text-gray-400 mt-10">Игрок не указан</div>';
    return;
  }

  await loadAllTeams();
  playerData = await fetchPlayerStats(playerName);

  // Если есть API, сохраняем статистику в Supabase
  if (window.csApi && window.csApi.updatePlayerStats) {
    await window.csApi.updatePlayerStats(playerName, {
      current_team: playerData.current_team,
      total_matches: playerData.total_matches,
      wins: playerData.wins,
      avg_rating: playerData.avg_rating,
      best_rating: playerData.best_rating,
      win_rate: playerData.win_rate,
      total_kills: playerData.total_kills,
      total_deaths: playerData.total_deaths,
      kd_ratio: playerData.kd_ratio,
      avg_adr: playerData.avg_adr
    });
  }

  // Обновляем UI
  document.getElementById('playerName').textContent = playerData.player_name;
  document.getElementById('playerMatches').textContent = playerData.total_matches;
  document.getElementById('avgRating').textContent = playerData.avg_rating.toFixed(2);
  document.getElementById('playerWins').textContent = playerData.wins;
  document.getElementById('playerWinRate').textContent = `${playerData.win_rate}%`;
  document.getElementById('playerBestRating').textContent = playerData.best_rating.toFixed(2);
  document.getElementById('playerMvp').textContent = playerData.mvp_count;

  // Подробная статистика
  document.getElementById('totalKills').textContent = playerData.total_kills;
  document.getElementById('totalDeaths').textContent = playerData.total_deaths;
  document.getElementById('kdRatio').textContent = playerData.kd_ratio.toFixed(2);
  document.getElementById('avgAdr').textContent = playerData.avg_adr.toFixed(2);

  // Ссылка на команду
  const teamLink = document.getElementById('playerTeam');
  if (playerData.current_team) {
    teamLink.href = `team-profile.html?team=${encodeURIComponent(playerData.current_team)}`;
    teamLink.textContent = playerData.current_team;
  } else {
    teamLink.textContent = 'Нет';
  }

  // Фото игрока
  const photo = document.getElementById('playerPhoto');
  const placeholder = document.getElementById('playerPhotoPlaceholder');
  placeholder.textContent = playerName.charAt(0).toUpperCase();
  
  if (playerData.photo_url && playerData.photo_url.trim() !== '') {
    photo.src = playerData.photo_url;
    photo.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    photo.style.display = 'none';
    placeholder.style.display = 'flex';
  }
  
  photo.onerror = () => {
    photo.style.display = 'none';
    placeholder.style.display = 'flex';
  };

  // История матчей
  renderMatchHistory(playerData.match_history);

  // График рейтинга
  renderRatingChart(playerData.match_history);
}

function renderMatchHistory(matches) {
  const tbody = document.getElementById('matchesBody');
  tbody.innerHTML = '';

  if (matches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">Нет матчей</td></tr>';
    return;
  }

  matches.forEach(match => {
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-700 hover:bg-gray-700 transition';
    
    const resultClass = match.result === 'Win' ? 'text-green-400' : (match.result === 'Loss' ? 'text-red-400' : 'text-yellow-400');
    const dateDisplay = new Date(match.date).toLocaleDateString('ru-RU');
    const mvpBadge = match.is_mvp ? '<span class="bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold">🏆</span>' : '—';
    
    const kills = match.kills || 0;
    const deaths = match.deaths || 0;
    const kdDisplay = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
    const adrDisplay = match.adr || '0.00';

    row.innerHTML = `
      <td class="px-4 py-3 text-gray-400">${dateDisplay}</td>
      <td class="px-4 py-3"><a href="team-profile.html?team=${encodeURIComponent(match.team)}" class="text-blue-400 hover:text-blue-300">${match.team}</a></td>
      <td class="px-4 py-3">${match.opponent}</td>
      <td class="px-4 py-3 ${resultClass} font-semibold">${match.result}</td>
      <td class="px-4 py-3 text-blue-300">${match.rating.toFixed(2)}</td>
      <td class="px-4 py-3 text-cyan-400"><span class="text-red-400">${kills}</span>/<span class="text-gray-400">${deaths}</span> <span class="text-cyan-400">(${kdDisplay})</span></td>
      <td class="px-4 py-3 text-lime-400">${adrDisplay}</td>
      <td class="px-4 py-3">${mvpBadge}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderRatingChart(matches) {
  const ctx = document.getElementById('ratingChart').getContext('2d');
  
  if (window._playerRatingChart) {
    window._playerRatingChart.destroy();
  }

  // Сортируем от старых к новым (для графика)
  const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sortedMatches.map((_, i) => `Матч ${i + 1}`);
  const ratings = sortedMatches.map(m => parseFloat(m.rating));

  window._playerRatingChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Рейтинг игрока',
        data: ratings,
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#60a5fa',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.5,
      scales: {
        y: {
          title: { display: true, text: 'Рейтинг' },
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', showPlayerProfile);
