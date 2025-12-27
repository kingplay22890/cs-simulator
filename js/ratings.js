// === РЕЙТИНГИ ИЗ SUPABASE + REALTIME ===
let currentViewMode = localStorage.getItem('ratingsViewMode') || 'cards';
let currentRegionFilter = localStorage.getItem('ratingsRegionFilter') || '';

async function getTeams() {
  let teams = [];
  if (window.csApi) {
    teams = await window.csApi.fetchTeams();
  } else {
    // Fallback для локального режима
    const raw = localStorage.getItem('cs_teams');
    teams = JSON.parse(raw || '[]');
  }
  console.log('📊 Loaded teams:', teams.length, 'teams');
  return teams.sort((a, b) => b.rating - a.rating);
}

// Compute rank changes over the last 7 days for all teams.
function computeWeeklyRankChanges(teams) {
  // Prefer using archive snapshots (two latest) when available — this ensures weekly-aligned changes.
  try {
    if (window.ratingArchive && typeof window.ratingArchive.getArchive === 'function') {
      const arr = window.ratingArchive.getArchive() || [];
      if (Array.isArray(arr) && arr.length >= 2) {
        const newest = arr[0];
        const prev = arr[1];
        // build rank maps from snapshots (use ordering by rating in snapshot)
        const sortAndRank = snap => {
          const items = (snap.teams || []).map(t => ({ name: t.name, rating: t.rating || 0 }));
          items.sort((a,b)=>b.rating - a.rating);
          const map = {};
          items.forEach((it,i)=> map[it.name] = i+1);
          return map;
        };
        const nowRankMap = sortAndRank(newest);
        const pastRankMap = sortAndRank(prev);
        const changeMap = {};
        teams.forEach(t => {
          const past = pastRankMap[t.name] || null;
          const current = nowRankMap[t.name] || null;
          if (past === null || current === null) changeMap[t.name] = 0;
          else changeMap[t.name] = past - current;
        });
        return changeMap;
      }
    }
  } catch (e) {
    console.warn('Archive based weekly change failed, falling back to history-based:', e);
  }

  // Fallback: compute from history (7 days window) as before
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recentDeltaByName = {};
  teams.forEach(team => {
    let sumRecent = 0;
    if (Array.isArray(team.history)) {
      team.history.forEach(h => {
        try {
          const d = new Date(h.date).getTime();
          if (!isNaN(d) && (now - d) <= weekMs) {
            const rc = typeof h.ratingChange === 'number' ? h.ratingChange : parseFloat(h.ratingChange) || 0;
            sumRecent += rc;
          }
        } catch (e) {
          // ignore
        }
      });
    }
    recentDeltaByName[team.name] = sumRecent;
  });
  const teamsWithPast = teams.map(t => ({ name: t.name, ratingNow: t.rating || 0, ratingPast: (t.rating || 0) - (recentDeltaByName[t.name] || 0) }));
  const byNow = [...teamsWithPast].sort((a,b)=>b.ratingNow - a.ratingNow).map((t,i)=>({ name: t.name, rank: i+1 }));
  const byPast = [...teamsWithPast].sort((a,b)=>b.ratingPast - a.ratingPast).map((t,i)=>({ name: t.name, rank: i+1 }));
  const nowRankMap = {};
  byNow.forEach(r=> nowRankMap[r.name] = r.rank);
  const pastRankMap = {};
  byPast.forEach(r=> pastRankMap[r.name] = r.rank);
  const changeMap = {};
  teams.forEach(t => {
    const past = pastRankMap[t.name] || null;
    const current = nowRankMap[t.name] || null;
    if (past === null || current === null) changeMap[t.name] = 0;
    else changeMap[t.name] = past - current;
  });
  return changeMap;
}

function filterTeamsByRegion(teams, region) {
  console.log('🔍 filterTeamsByRegion called:', { totalTeams: teams.length, region: region || 'ALL' });
  
  // Если нет фильтра - показываем все команды
  if (!region) {
    console.log('✅ Showing all teams (no filter)');
    return teams;
  }
  
  const filtered = teams.filter(team => {
    // Если нет страны и нет региона - НЕ показываем (команда неполная)
    if (!team.region && !team.country) return false;
    
    // Если есть регион - проверяем совпадение
    if (team.region === region) return true;
    
    // Если только страна, но нет региона - вычисляем регион
    if (team.country && !team.region) {
      const computedRegion = getRegionByCountry(team.country);
      return computedRegion === region;
    }
    
    return false;
  });
  
  console.log(`🎯 Filtered ${filtered.length} teams for region: ${region}`);
  return filtered;
}

function renderCards(teams, container, rankChanges = {}) {
  const filteredTeams = filterTeamsByRegion(teams, currentRegionFilter);
  container.className = 'ratings-cards-view';
  container.innerHTML = '';
  
  if (filteredTeams.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 py-8">No teams in this region</div>';
    return;
  }
  
  filteredTeams.forEach((team, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : 'rank-normal';
    const countryFlagImg = team.country && typeof window.getFlagImgTag === 'function' ? window.getFlagImgTag(team.country, 16, 'rating-flag') : (team.country ? getFlagByCountry(team.country) : '');
    const countryText = team.country ? ` • ${countryFlagImg} ${team.country}` : '';
    const rankChange = rankChanges[team.name] || 0;
    const rankChangeHtml = rankChange === 0 ? '' : `<div class="rating-change-badge ${rankChange>0?'up':'down'}">${rankChange>0? '▲':'▼'}${Math.abs(rankChange)}</div>`;
    
    const card = document.createElement('a');
    card.href = `team-profile.html?team=${encodeURIComponent(team.name)}`;
    card.className = 'rating-card';
    card.innerHTML = `
      <div class="rating-card-rank ${rankClass}">#${rank}</div>
      <div class="rating-card-logo">
        ${team.logoUrl ? `<img src="${team.logoUrl}" alt="${team.name}" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }">` : ''}
        <div class="rating-card-logo-placeholder" style="${team.logoUrl ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">${team.name.charAt(0).toUpperCase()}</div>
      </div>
      <div class="rating-card-info">
        <div class="rating-card-name">${team.name}</div>
        <div class="rating-card-country" style="font-size: 0.85em; color: #9ca3af;">${countryText}</div>
        <div class="rating-card-rating">
          <span class="rating-label">Rating</span>
          <span class="rating-value">${team.rating}</span>
          ${rankChangeHtml}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderTable(teams, container, rankChanges = {}) {
  const filteredTeams = filterTeamsByRegion(teams, currentRegionFilter);
  container.className = 'ratings-table-view';
  container.innerHTML = '';
  
  if (filteredTeams.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 py-8">No teams in this region</div>';
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'ratings-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Rank</th>
        <th>Logo</th>
        <th>Team Name</th>
        <th>Country</th>
        <th>Δ (7d)</th>
        <th>Rating</th>
      </tr>
    </thead>
    <tbody>
      ${filteredTeams.map((team, i) => {
        const rank = i + 1;
        const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : 'rank-normal';
        const profileUrl = `team-profile.html?team=${encodeURIComponent(team.name)}`;
        
        // Get flag by country, or fallback to region flag
        let countryDisplay = '-';
        if (team.country && team.country !== '') {
          // Debug: log what we're getting
          console.log(`DEBUG renderTable: team=${team.name}, country="${team.country}"`);
          
          // Try using getFlagImgTag for actual PNG flags from flagcdn
          let flagHtml = '';
          try {
            // First try the country name directly
            flagHtml = (typeof getFlagImgTag === 'function') ? getFlagImgTag(team.country, 24, 'rating-flag-img') : '';
            console.log(`  getFlagImgTag(${team.country}) = "${flagHtml.substring(0, 50)}..."`);
          } catch (e) {
            console.log(`  getFlagImgTag error: ${e.message}`);
            flagHtml = '';
          }
          
          // If that didn't work, try parsing variations like "RU Russia"
          if (!flagHtml || flagHtml.includes('undefined')) {
            const parts = team.country.split(/\s+|,/).filter(Boolean);
            console.log(`  Parts: ${JSON.stringify(parts)}`);
            for (const part of parts) {
              if (part.length > 1) {
                try {
                  flagHtml = (typeof getFlagImgTag === 'function') ? getFlagImgTag(part, 24, 'rating-flag-img') : '';
                  if (flagHtml && !flagHtml.includes('undefined')) {
                    console.log(`  Found via part "${part}"`);
                    break;
                  }
                } catch(e) {
                  console.log(`  Part ${part} error: ${e.message}`);
                }
              }
            }
          }
          
          // If still no flag, fall back to emoji
          if (!flagHtml || flagHtml.includes('undefined')) {
            let emojiFlag = '';
            try {
              emojiFlag = (typeof getFlagByCountry === 'function') ? getFlagByCountry(team.country) : '🏳';
              console.log(`  Using emoji: ${emojiFlag}`);
            } catch(e) {
              emojiFlag = '🏳';
            }
            countryDisplay = `${emojiFlag} ${team.country}`;
          } else {
            countryDisplay = `${flagHtml} ${team.country}`;
          }
        } else if (team.region && team.region !== '') {
          // If no country, show region with emoji
          const regionEmojis = {
            'Europe': '🇪🇺',
            'North America': '🇺🇸',
            'South America': '🇧🇷',
            'Asia': '🇯🇵',
            'Middle East': '🕌',
            'Africa': '🇪🇹',
            'Oceania': '🇦🇺'
          };
          const regionFlag = regionEmojis[team.region] || '🌍';
          countryDisplay = `${regionFlag} ${team.region}`;
        }
        
        const change = rankChanges[team.name] || 0;
        const changeHtml = change === 0 ? '' : `<span class="rank-change ${change>0?'up':'down'}">${change>0? '▲':'▼'}${Math.abs(change)}</span>`;
        return `
          <tr class="rating-table-row" data-href="${profileUrl}">
            <td class="rating-table-rank">
              <span class="rank-badge ${rankClass}">#${rank}</span>
            </td>
            <td class="rating-table-logo">
              ${team.logoUrl ? `<img src="${team.logoUrl}" alt="${team.name}" class="rating-table-logo-img" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) { placeholder.style.display='flex'; placeholder.style.visibility='visible'; }">` : ''}
              <div class="rating-table-logo-placeholder" style="${team.logoUrl ? 'display:none; visibility:hidden;' : 'display:flex; visibility:visible;'}">${team.name.charAt(0).toUpperCase()}</div>
            </td>
            <td class="rating-table-name">
              <span class="rating-table-link">${team.name}</span>
            </td>
            <td class="rating-table-country">
              <div style="display: flex; align-items: center; gap: 4px; white-space: nowrap;">${countryDisplay}</div>
            </td>
            <td class="rating-table-change">
              ${changeHtml || '<span class="rating-table-value">-</span>'}
            </td>
            <td class="rating-table-rating">
              <span class="rating-table-value">${team.rating}</span>
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;
  container.appendChild(table);
  
  // Добавляем обработчики клика на строки
  const rows = table.querySelectorAll('.rating-table-row');
  rows.forEach(row => {
    row.addEventListener('click', (e) => {
      // Не переходим, если кликнули на ссылку внутри (если она есть)
      if (e.target.tagName === 'A') return;
      const href = row.getAttribute('data-href');
      if (href) {
        window.location.href = href;
      }
    });
  });
}

async function updateRatingsTable() {
  try {
    const container = document.querySelector('#ratingsContainer');
    if (!container) {
      console.error('❌ ratingsContainer not found!');
      return;
    }
    
    console.log('🔄 Updating ratings table...');
    const teams = await getTeams();
    console.log('📊 Total teams fetched:', teams.length);

    // Attempt to create weekly snapshot (archive)
    try {
      if (window.ratingArchive && typeof window.ratingArchive.maybeCreateSnapshot === 'function') {
        window.ratingArchive.maybeCreateSnapshot(teams);
      }
    } catch (e) {
      console.warn('Archive snapshot error', e);
    }
    
    if (!teams || teams.length === 0) {
      console.warn('⚠️ No teams found in storage!');
      container.innerHTML = '<div class="text-center text-gray-400 py-8">Нет команд. Создайте команду на главной странице.</div>';
      return;
    }
    
    if (currentViewMode === 'cards') {
      console.log('🃏 Rendering cards view');
      const changes = computeWeeklyRankChanges(teams);
      renderCards(teams, container, changes);
    } else {
      console.log('📊 Rendering table view');
      const changes = computeWeeklyRankChanges(teams);
      renderTable(teams, container, changes);
    }
  } catch (e) {
    console.error('Failed to update ratings table:', e);
    const container = document.querySelector('#ratingsContainer');
    if (container) {
      container.innerHTML = '<div class="text-center text-red-400 py-8">Ошибка загрузки: ' + e.message + '</div>';
    }
  }
}

function setViewMode(mode) {
  currentViewMode = mode;
  localStorage.setItem('ratingsViewMode', mode);
  
  const cardsBtn = document.getElementById('viewCardsBtn');
  const tableBtn = document.getElementById('viewTableBtn');
  
  if (cardsBtn && tableBtn) {
    if (mode === 'cards') {
      cardsBtn.classList.add('active');
      tableBtn.classList.remove('active');
    } else {
      tableBtn.classList.add('active');
      cardsBtn.classList.remove('active');
    }
  }
  
  updateRatingsTable();
}

function initRegionFilter() {
  const filterSelect = document.getElementById('regionFilter');
  if (!filterSelect) return;
  
  // Add "All Regions" option
  filterSelect.innerHTML = '<option value="">All Regions</option>';
  
  // Add region options grouped by name
  const regions = Object.values(COUNTRIES_AND_REGIONS);
  regions.forEach(region => {
    const option = document.createElement('option');
    option.value = region.region;
    option.textContent = `${region.flag} ${region.region}`;
    filterSelect.appendChild(option);
  });
  
  // Set saved filter value
  filterSelect.value = currentRegionFilter;
  
  // Add change listener
  filterSelect.addEventListener('change', (e) => {
    currentRegionFilter = e.target.value;
    localStorage.setItem('ratingsRegionFilter', currentRegionFilter);
    updateRatingsTable();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOMContentLoaded - initializing ratings page...');
  
  // Инициализация фильтра регионов
  initRegionFilter();
  
  // Инициализация режима просмотра
  console.log('🎨 Setting view mode to:', currentViewMode);
  setViewMode(currentViewMode);
  
  // Обработчики переключения режима
  const cardsBtn = document.getElementById('viewCardsBtn');
  const tableBtn = document.getElementById('viewTableBtn');
  
  if (cardsBtn) {
    cardsBtn.addEventListener('click', () => {
      console.log('🃏 Cards view clicked');
      setViewMode('cards');
    });
  }
  if (tableBtn) {
    tableBtn.addEventListener('click', () => {
      console.log('📊 Table view clicked');
      setViewMode('table');
    });
  }
  
  // Realtime подписка на любые изменения таблицы teams
  if (window.csApi?.client) {
    console.log('🔄 Setting up Supabase realtime subscription');
    const channel = window.csApi.client
      .channel('ratings-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        if (document.visibilityState === 'visible') updateRatingsTable();
      })
      .subscribe();
    // На всякий случай периодическое обновление
    setInterval(() => document.visibilityState === 'visible' && updateRatingsTable(), 5000);
  } else {
    console.log('ℹ️ Supabase not available, using localStorage only');
  }
});

window.updateRatingsTable = updateRatingsTable;
  
