// player-profile.js - Профиль игрока с интеграцией Supabase

let playerData = null;
let allTeams = [];
let currentPeriod = 'all'; // Текущий выбранный период
let showAllMatches = false; // Показывать все матчи или только 10

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

async function fetchPlayerStats(playerName, period = 'all') {
  // Сначала всегда пересчитываем статистику из локальных данных,
  // чтобы UI показывал актуальные цифры даже если в Supabase старые значения.
  const aggregatedStats = aggregatePlayerStats(playerName, period);

  try {
    if (window.csApi && window.csApi.fetchPlayerStats) {
      const supabaseStats = await window.csApi.fetchPlayerStats(playerName);
      if (supabaseStats) {
        // Объединяем награды: приоритет у наград из БД (созданных пользователем), затем добавляем награды команды
        const dbAwards = Array.isArray(supabaseStats.awards) ? supabaseStats.awards : [];
        const localAwards = Array.isArray(aggregatedStats.awards) ? aggregatedStats.awards : [];
        // Начинаем с наград из БД (они имеют приоритет)
        const mergedAwards = [...dbAwards];
        // Добавляем награды команды только если их нет в БД
        localAwards.forEach(award => {
          const exists = mergedAwards.some(a => a.name === award.name && a.img === award.img);
          if (!exists) {
            mergedAwards.push(award);
          }
        });
        
        return {
          ...supabaseStats,
          ...aggregatedStats,
          // Берём фото и команду из Supabase только если их нет в локальных данных
          photo_url: aggregatedStats.photo_url || supabaseStats.photo_url || null,
          current_team: aggregatedStats.current_team || supabaseStats.current_team || null,
          // Статус всегда берём из локальных данных (более актуальный)
          status: aggregatedStats.status || supabaseStats.status || 'active',
          // Объединённые награды (приоритет у наград из БД)
          awards: mergedAwards,
          match_history: aggregatedStats.match_history
        };
      }
    }
  } catch (error) {
    console.error('Error fetching player stats:', error);
  }

  return aggregatedStats;
}

function filterHistoryByPeriod(history, period) {
  if (!Array.isArray(history)) return [];
  if (!period || period === 'all') return history;
  if (period === 'last10') return history.slice(0, 10);
  const now = new Date();
  if (period === 'last3m' || period === 'last6m' || period === 'last12m') {
    const months = period === 'last3m' ? 3 : period === 'last6m' ? 6 : 12;
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - months);
    return history.filter(m => {
      const d = new Date(m.date || m.startedAt || m.matchDate || null);
      return !isNaN(d.getTime()) && d >= cutoff;
    });
  }
  if (period === 'year2025' || period === 'year2026') {
    const year = period === 'year2025' ? 2025 : 2026;
    return history.filter(m => {
      const d = new Date(m.date || m.startedAt || m.matchDate || null);
      return !isNaN(d.getTime()) && d.getFullYear() === year;
    });
  }
  return history;
}

function aggregatePlayerStats(playerName, period = 'all') {
  let totalMatches = 0;
  let wins = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let bestRating = 0;
  let matchHistory = [];
  let currentTeam = null;      // команда по данным матчей (где он играл)
  let rosterTeam = null;       // команда, в ростере которой он сейчас числится
  let photoUrl = null;
  let mvpCount = 0;
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAdr = 0;
  let adrCount = 0;
  let playerStatus = 'active'; // По умолчанию active
  let playerAwards = []; // Награды игрока
  let worstRating = Infinity;
  let totalAssists = 0;
  let totalRounds = 0;
  let roundsWithKillOrAssist = 0;

  allTeams.forEach(team => {
    if (!Array.isArray(team.history)) return;
    
    // Фильтруем историю по периоду
    const filteredHistory = filterHistoryByPeriod(team.history, period);
    
    filteredHistory.forEach(match => {
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
        worstRating = Math.min(worstRating, rating);

        // Собираем детальную статистику
        const kills = playerStat.kills || 0;
        const deaths = playerStat.deaths || 0;
        const adr = playerStat.adr || 0;
        const assists = playerStat.assists || 0;
        
        totalKills += kills;
        totalDeaths += deaths;
        totalAssists += assists;
        
        // Примерно 24 раунда за матч для расчета KAST
        const rounds = 24;
        totalRounds += rounds;
        
        // KAST: процент раундов с kill, assist, survived или traded
        // Упрощенная формула: если игрок сделал kill или assist, значит в этих раундах он был полезен
        // Также учитываем выживание - если deaths меньше kills, значит игрок часто выживал
        const kastRounds = Math.min(kills + assists, rounds); // Количество раундов с kill/assist (макс = rounds)
        roundsWithKillOrAssist += kastRounds;
        
        const adrValue = parseFloat(adr);
        if (!isNaN(adrValue) && adrValue > 0) {
          totalAdr += adrValue;
          adrCount++;
        }

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

        // Команда, за которую он играл в конкретном матче
        currentTeam = team.name;
      }
    });

    // Ищем фото игрока, статус и награды в составе команды
    if (team.players && Array.isArray(team.players)) {
      const player = team.players.find(p => 
        (p.name || '').toLowerCase().trim() === playerName.toLowerCase().trim()
      );
      if (player) {
        if (player.photoUrl && !photoUrl) {
          photoUrl = player.photoUrl;
        }
        // Фиксируем команду из текущего ростера (имеет приоритет над историей матчей)
        rosterTeam = team.name;
        // Определяем статус игрока (приоритет у последней найденной записи в ростере)
        if (player.status) {
          playerStatus = player.status;
        }
        // Если игрок в команде, добавляем награды команды
        if (team.awards && Array.isArray(team.awards) && team.awards.length > 0) {
          // Объединяем награды команды с уже собранными (избегаем дубликатов)
          team.awards.forEach(award => {
            const exists = playerAwards.some(a => a.name === award.name && a.img === award.img);
            if (!exists) {
              playerAwards.push({ ...award });
            }
          });
        }
      }
    }
  });

  if (window.playerAwardsStore) {
    const storedAwards = window.playerAwardsStore.getAwards(playerName);
    playerAwards = window.playerAwardsStore.mergeAwards(playerAwards, storedAwards);
  }

  const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(2) : 0;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const kdRatio = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills > 0 ? totalKills.toFixed(2) : '0.00';
  const avgAdr = adrCount > 0 ? (totalAdr / adrCount).toFixed(2) : '0.00';
  const worstRatingFinal = worstRating === Infinity ? parseFloat(avgRating) : worstRating;
  
  // KAST: процент раундов с kill, assist, survived или traded
  // Формула: (rounds с kills/assists + выживание) / totalRounds * 100
  // Выживание оцениваем через разницу между kills и deaths (если kills > deaths, больше выживаний)
  // Минимальный KAST = процент раундов с kill/assist, максимальный учитывает выживание
  const baseKast = totalRounds > 0 ? (roundsWithKillOrAssist / totalRounds) * 100 : 0;
  const survivalBonus = totalDeaths > 0 ? Math.min(((totalKills - totalDeaths) / totalRounds) * 50, 20) : 0;
  const kastPercentage = Math.min(baseKast + survivalBonus, 100);

  return {
    player_name: playerName,
    // Приоритет: команда из текущего ростера, затем — из истории матчей
    current_team: rosterTeam || currentTeam,
    total_matches: totalMatches,
    wins: wins,
    avg_rating: parseFloat(avgRating),
    best_rating: bestRating,
    worst_rating: worstRatingFinal,
    win_rate: winRate,
    photo_url: photoUrl,
    mvp_count: mvpCount,
    total_kills: totalKills,
    total_deaths: totalDeaths,
    total_assists: totalAssists,
    kd_ratio: parseFloat(kdRatio),
    avg_adr: parseFloat(avgAdr),
    kast_percentage: Math.min(kastPercentage, 100),
    status: playerStatus,
    awards: playerAwards,
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
  playerData = await fetchPlayerStats(playerName, currentPeriod);

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
      avg_adr: playerData.avg_adr,
      status: playerData.status || 'active',
      awards: playerData.awards || []
    });
  }

  // Обновляем UI
  const playerNameEl = document.getElementById('playerName');
  const playerStatus = playerData.status || 'active';
  if (playerStatus === 'benched') {
    playerNameEl.innerHTML = `${playerData.player_name} <span class="benched-badge ml-3">BENCHED</span>`;
  } else {
    playerNameEl.textContent = playerData.player_name;
  }
  document.getElementById('playerMatches').textContent = playerData.total_matches;
  document.getElementById('playerWins').textContent = playerData.wins;
  document.getElementById('playerWinRate').textContent = `${playerData.win_rate}%`;
  document.getElementById('playerBestRating').textContent = playerData.best_rating.toFixed(2);
  document.getElementById('playerMvp').textContent = playerData.mvp_count;

  // Новый стиль статистики HLTV
  const avgRating = playerData.avg_rating || 0;
  const matchesCountEl = document.getElementById('playerMatchesCount');
  if (matchesCountEl) {
    matchesCountEl.textContent = `${playerData.total_matches} maps`;
  }
  
  const avgRatingEl = document.getElementById('avgRating');
  if (avgRatingEl) {
    avgRatingEl.textContent = avgRating.toFixed(2);
  }
  
  // T и CT рейтинги - используем средний рейтинг с небольшими вариациями
  // В реальности T и CT рейтинги отличаются, так как игра на разных сторонах требует разных навыков
  // Упрощенная формула: T rating обычно немного ниже (игроки часто играют агрессивнее на T)
  const tRating = avgRating * 0.97; // Примерно на 3% ниже среднего
  const ctRating = avgRating * 1.03; // Примерно на 3% выше среднего
  const tRatingEl = document.getElementById('tRating');
  const ctRatingEl = document.getElementById('ctRating');
  if (tRatingEl) tRatingEl.textContent = tRating.toFixed(2);
  if (ctRatingEl) ctRatingEl.textContent = ctRating.toFixed(2);
  
  // Обновляем прогресс-бар рейтинга (полукруг) и цвет в зависимости от рейтинга
  const ratingPercent = Math.min((avgRating / 1.5) * 100, 100); // Максимум 1.5 = 100%
  const circumference = 251.2; // Примерная длина полукруга (π * 80)
  const offset = circumference - (ratingPercent / 100) * circumference;
  const ratingPath = document.getElementById('ratingCirclePath');
  if (ratingPath) {
    ratingPath.style.strokeDashoffset = offset;
    
    // Цвет в зависимости от рейтинга: красный до 1.0, желтый до 1.18, зеленый от 1.18
    if (avgRating >= 1.18) {
      ratingPath.style.stroke = '#10b981'; // Зеленый от 1.18
    } else if (avgRating >= 1.0) {
      ratingPath.style.stroke = '#fbbf24'; // Желтый от 1.0 до 1.18
    } else {
      ratingPath.style.stroke = '#ef4444'; // Красный до 1.0
    }
  }
  
  // Обновляем статус рейтинга
  const ratingLabel = document.getElementById('ratingLabel');
  if (ratingLabel) {
    if (avgRating >= 1.18) {
      ratingLabel.textContent = 'EXCELLENT';
      ratingLabel.style.color = '#10b981';
    } else if (avgRating >= 1.0) {
      ratingLabel.textContent = 'GOOD';
      ratingLabel.style.color = '#fbbf24';
    } else {
      ratingLabel.textContent = 'POOR';
      ratingLabel.style.color = '#ef4444';
    }
  }
  
  // Вычисляем дополнительные метрики
  const totalRounds = playerData.total_matches * 24; // Примерно 24 раунда за матч
  // Уменьшаем KPR на 5% для более консервативных значений
  const kpr = totalRounds > 0 ? (playerData.total_kills / totalRounds) * 0.95 : 0; // Kills per round
  const kd = playerData.kd_ratio || 0;
  const kast = playerData.kast_percentage || 0;
  
  // Round Swing - насколько игрок изменил шансы команды на победу в раунде
  // Формула основана на: kills, deaths, damage, assists, economy impact, side
  // Упрощенная формула: учитываем K/D, ADR, assists и стабильность рейтинга
  const kdImpact = kd > 1 ? Math.min((kd - 1) * 0.3, 0.5) : (kd < 1 ? (kd - 1) * 0.4 : 0);
  const adrImpact = playerData.avg_adr > 75 ? Math.min((playerData.avg_adr - 75) / 100, 0.2) : (playerData.avg_adr < 60 ? (playerData.avg_adr - 60) / 200 : 0);
  const assistImpact = playerData.total_assists && totalRounds > 0 ? Math.min((playerData.total_assists / totalRounds) * 0.1, 0.15) : 0;
  const stabilityImpact = (playerData.best_rating || avgRating) - (playerData.worst_rating || avgRating);
  // Swing показывает влияние на раунд: положительные факторы минус нестабильность
  // Меньше swing = лучше (игрок стабильно влияет на раунды)
  const swing = Math.max(0, Math.abs(kdImpact + adrImpact + assistImpact) - Math.min(stabilityImpact * 0.2, 0.3));
  
  // Обновляем значения
  const kprEl = document.getElementById('kprValue');
  const kdEl = document.getElementById('kdValue');
  const kastEl = document.getElementById('kastValue');
  const adrEl = document.getElementById('adrValue');
  const swingEl = document.getElementById('swingValue');
  const winrateEl = document.getElementById('winrateValue');
  
  if (kprEl) kprEl.textContent = kpr.toFixed(2);
  if (kdEl) kdEl.textContent = kd.toFixed(2);
  if (kastEl) kastEl.textContent = `${kast.toFixed(1)}%`;
  if (adrEl) adrEl.textContent = Math.round(playerData.avg_adr);
  if (swingEl) swingEl.textContent = swing.toFixed(2);
  if (winrateEl) winrateEl.textContent = `${playerData.win_rate}%`;
  
  // Обновляем статусы (GOOD/AVERAGE/POOR)
  function updateStatStatus(elementId, value, thresholds, reverse = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    let status;
    if (reverse) {
      status = value <= thresholds.good ? 'GOOD' : (value <= thresholds.average ? 'AVERAGE' : 'POOR');
    } else {
      status = value >= thresholds.good ? 'GOOD' : (value >= thresholds.average ? 'AVERAGE' : 'POOR');
    }
    element.textContent = status;
    if (status === 'GOOD') {
      element.className = 'player-stat-detail-status';
    } else if (status === 'AVERAGE') {
      element.className = 'player-stat-detail-status average';
    } else {
      element.className = 'player-stat-detail-status poor';
    }
  }
  
  // Увеличиваем пороги для статусов GOOD (сложнее получить GOOD)
  updateStatStatus('kprStatus', kpr, { good: 0.85, average: 0.75 });
  updateStatStatus('kdStatus', kd, { good: 1.25, average: 1.10 });
  updateStatStatus('kastStatus', kast, { good: 80, average: 70 });
  updateStatStatus('adrStatus', playerData.avg_adr, { good: 85, average: 75 });
  updateStatStatus('swingStatus', swing, { good: 0.3, average: 0.6 }, true); // Меньше swing = лучше
  updateStatStatus('winrateStatus', playerData.win_rate, { good: 65, average: 55 });
  
  // Обновляем модальное окно подробной статистики
  document.getElementById('detailedKills').textContent = playerData.total_kills;
  document.getElementById('detailedDeaths').textContent = playerData.total_deaths;
  document.getElementById('detailedKD').textContent = kd.toFixed(2);
  document.getElementById('detailedBestRating').textContent = (playerData.best_rating || avgRating).toFixed(2);
  document.getElementById('detailedWorstRating').textContent = (playerData.worst_rating || avgRating).toFixed(2);
  document.getElementById('detailedMVP').textContent = playerData.mvp_count || 0;
  
  // Скрытые элементы для совместимости
  document.getElementById('totalKills').textContent = playerData.total_kills;
  document.getElementById('totalDeaths').textContent = playerData.total_deaths;
  document.getElementById('kdRatio').textContent = playerData.kd_ratio.toFixed(2);
  document.getElementById('avgAdr').textContent = playerData.avg_adr.toFixed(2);

  // Награды
  renderPlayerAwards(playerData.awards || []);

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

  // История матчей - сбрасываем флаг показа всех матчей при загрузке
  showAllMatches = false;
  const toggleBtn = document.getElementById('toggleAllMatchesBtn');
  if (toggleBtn) {
    toggleBtn.textContent = 'Показать все матчи';
  }
  renderMatchHistory(playerData.match_history);

  // График рейтинга
  renderRatingChart(playerData.match_history);
}

function renderMatchHistory(matches) {
  const tbody = document.getElementById('matchesBody');
  tbody.innerHTML = '';

  if (!matches || matches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">Нет матчей</td></tr>';
    return;
  }

  // Убеждаемся, что матчи отсортированы от новых к старым (последние первые)
  const sortedMatches = [...matches].sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB - dateA; // От новых к старым
  });

  // Показываем только последние 10 матчей, если не включен режим "показать все"
  // Убеждаемся, что showAllMatches - это boolean
  const shouldShowAll = showAllMatches === true;
  const matchesToShow = shouldShowAll ? sortedMatches : sortedMatches.slice(0, 10);
  const totalMatches = sortedMatches.length;
  const displayedMatches = matchesToShow.length;

  matchesToShow.forEach(match => {
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

  // Добавляем строку с информацией о количестве матчей, если не все показаны
  if (!showAllMatches && totalMatches > 10) {
    const infoRow = document.createElement('tr');
    infoRow.className = 'border-t border-gray-700 bg-gray-700/30';
    infoRow.innerHTML = `
      <td colspan="8" class="px-4 py-3 text-center text-gray-400 text-sm">
        Показано ${displayedMatches} из ${totalMatches} матчей
      </td>
    `;
    tbody.appendChild(infoRow);
  }
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

// Функции для работы с наградами
function renderPlayerAwards(awards) {
  const container = document.getElementById('playerAwardsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!Array.isArray(awards) || awards.length === 0) {
    container.innerHTML = '<span class="text-gray-400">Нет наград</span>';
    return;
  }
  
  awards.forEach(award => {
    const el = document.createElement('div');
    el.className = 'flex flex-col items-center w-20';
    el.innerHTML = `
      <div class="text-4xl">${award.img ? `<img src='${award.img}' alt='${award.name}' class='w-14 h-14 object-contain'>` : '🏆'}</div>
      <div class="text-xs mt-1 text-center">${award.name || ''}</div>
    `;
    container.appendChild(el);
  });
}

let currentPlayerAwards = [];

function openEditAwardsModal() {
  const modal = document.getElementById('editAwardsModal');
  if (!modal) return;
  
  currentPlayerAwards = Array.isArray(playerData?.awards) ? [...playerData.awards] : [];
  renderAwardsEditList();
  modal.classList.remove('hidden');
}

function closeEditAwardsModal() {
  const modal = document.getElementById('editAwardsModal');
  if (modal) modal.classList.add('hidden');
}

function renderAwardsEditList() {
  const container = document.getElementById('awardsEditList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (currentPlayerAwards.length === 0) {
    currentPlayerAwards.push({ name: '', img: '🏆' });
  }
  
  currentPlayerAwards.forEach((award, idx) => {
    const div = document.createElement('div');
    div.className = 'bg-gray-700 p-3 rounded space-y-2';
    div.innerHTML = `
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-xs text-gray-400">Название</label>
          <input type="text" class="awardEditName w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" value="${award.name || ''}" placeholder="Название награды">
        </div>
        <div class="flex-1">
          <label class="text-xs text-gray-400">URL или эмодзи</label>
          <input type="text" class="awardEditImg w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm" value="${award.img || '🏆'}" placeholder="URL или эмодзи">
        </div>
        <div class="flex items-end">
          <button onclick="deleteAwardRow(${idx})" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition">
            ✕
          </button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function addAwardRow() {
  currentPlayerAwards.push({ name: '', img: '🏆' });
  renderAwardsEditList();
}

function deleteAwardRow(idx) {
  if (currentPlayerAwards.length > idx) {
    currentPlayerAwards.splice(idx, 1);
    renderAwardsEditList();
  }
}

async function savePlayerAwards() {
  const nameInputs = document.querySelectorAll('.awardEditName');
  const imgInputs = document.querySelectorAll('.awardEditImg');
  
  const awards = [];
  nameInputs.forEach((nameInput, idx) => {
    const name = nameInput.value.trim();
    if (name) {
      awards.push({
        name: name,
        img: imgInputs[idx]?.value.trim() || '🏆'
      });
    }
  });
  
  // Обновляем данные игрока
  if (playerData) {
    let updatedAwards = awards;

    if (window.playerAwardsStore && typeof window.playerAwardsStore.replaceAwards === 'function') {
      updatedAwards = await window.playerAwardsStore.replaceAwards(playerData.player_name, awards, playerData);
    } else if (window.csApi && window.csApi.updatePlayerStats) {
      const result = await window.csApi.updatePlayerStats(playerData.player_name, {
        current_team: playerData.current_team,
        total_matches: playerData.total_matches,
        wins: playerData.wins,
        avg_rating: playerData.avg_rating,
        best_rating: playerData.best_rating,
        win_rate: playerData.win_rate,
        total_kills: playerData.total_kills,
        total_deaths: playerData.total_deaths,
        kd_ratio: playerData.kd_ratio,
        avg_adr: playerData.avg_adr,
        status: playerData.status || 'active',
        awards
      });
      if (result && Array.isArray(result.awards)) {
        updatedAwards = result.awards;
      }
    }

    playerData.awards = updatedAwards;
    renderPlayerAwards(updatedAwards);
    closeEditAwardsModal();
    alert('Награды сохранены!');
  }
}

// Функции для модального окна подробной статистики
function openDetailedStatsModal() {
  const modal = document.getElementById('detailedStatsModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeDetailedStatsModal() {
  const modal = document.getElementById('detailedStatsModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Инициализация фильтров периода
function initPeriodFilters() {
  const group = document.getElementById('periodFilterGroup');
  if (!group) return;
  
  // Активируем кнопку "Все матчи" по умолчанию
  const defaultBtn = group.querySelector('[data-value="all"]');
  if (defaultBtn) {
    defaultBtn.classList.add('active');
  }

  // Обработчики кликов на кнопки
  group.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-value');
      
      // Убираем активность со всех кнопок в группе
      group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      
      // Активируем нажатую кнопку
      btn.classList.add('active');
      
      // Обновляем период и пересчитываем статистику
      currentPeriod = value;
      // Сбрасываем флаг показа всех матчей при изменении периода
      showAllMatches = false;
      const toggleBtn = document.getElementById('toggleAllMatchesBtn');
      if (toggleBtn) {
        toggleBtn.textContent = 'Показать все матчи';
      }
      const urlParams = new URLSearchParams(window.location.search);
      const playerName = urlParams.get('player');
      if (playerName) {
        playerData = await fetchPlayerStats(playerName, currentPeriod);
        await showPlayerProfile();
      }
    });
  });
}

// Инициализация кнопки переключения показа всех матчей
function initToggleMatchesButton() {
  const toggleBtn = document.getElementById('toggleAllMatchesBtn');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    showAllMatches = !showAllMatches;
    if (playerData && playerData.match_history) {
      renderMatchHistory(playerData.match_history);
    }
    // Обновляем текст кнопки
    toggleBtn.textContent = showAllMatches ? 'Показать 10 матчей' : 'Показать все матчи';
  });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  showPlayerProfile();
  
  // Инициализация фильтров периода
  initPeriodFilters();
  
  // Инициализация кнопки переключения показа всех матчей
  initToggleMatchesButton();
  
  // Инициализация кнопки редактирования наград
  const editBtn = document.getElementById('editAwardsBtn');
  if (editBtn) {
    editBtn.addEventListener('click', openEditAwardsModal);
  }
  
  const detailedStatsBtn = document.getElementById('detailedStatsBtn');
  if (detailedStatsBtn) {
    detailedStatsBtn.addEventListener('click', openDetailedStatsModal);
  }
});

