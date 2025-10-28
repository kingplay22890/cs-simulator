// === АВТООБНОВЛЕНИЕ РЕЙТИНГА ===
function updateRatingsTable() {
    console.log('Updating ratings table...');
    const savedTeams = JSON.parse(localStorage.getItem('cs_teams') || '[]');
    console.log('Teams in storage:', savedTeams);
    
    const sorted = savedTeams.sort((a, b) => b.rating - a.rating);
    const tbody = document.querySelector('#ratingsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    sorted.forEach((team, i) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-600';
        row.innerHTML = `
            <td class="p-2">${i + 1}</td>
            <td class="p-2"><a href="team-profile.html?team=${encodeURIComponent(team.name)}" class="text-blue-400 hover:underline">${team.name}</a></td>
            <td class="p-2">${team.rating}</td>
            <td class="p-2">${team.logoUrl ? `<img src="${team.logoUrl}" class="team-logo">` : '—'}</td>
        `;
        tbody.appendChild(row);
    });
    console.log('Ratings table updated');
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', () => {
  updateRatingsTable();

  // Автообновление каждые 2 секунды
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      updateRatingsTable();
    }
  }, 2000);
});

// Делаем глобально
window.updateRatingsTable = updateRatingsTable;
