// === РЕЙТИНГИ ИЗ SUPABASE + REALTIME ===
async function updateRatingsTable() {
  try {
    const tbody = document.querySelector('#ratingsTable tbody');
    if (!tbody || !window.csApi) return;
    const teams = await window.csApi.fetchTeams();
    const sorted = teams.sort((a, b) => b.rating - a.rating);
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
  } catch (e) {
    console.error('Failed to update ratings table:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateRatingsTable();
  // Realtime подписка на любые изменения таблицы teams
  if (window.csApi?.client) {
    const channel = window.csApi.client
      .channel('ratings-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        if (document.visibilityState === 'visible') updateRatingsTable();
      })
      .subscribe();
    // На всякий случай периодическое обновление
    setInterval(() => document.visibilityState === 'visible' && updateRatingsTable(), 5000);
  }
});

window.updateRatingsTable = updateRatingsTable;
