// api.js — Supabase API wrappers
// Требуется: подключён CDN @supabase/supabase-js v2 и файл js/config.js с window.SUPABASE_URL, window.SUPABASE_ANON_KEY

(function(){
  let client = null;
  
  // Проверяем наличие Supabase SDK и конфигурацию
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    try {
      client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      // Тестовый запрос для проверки подключения (не блокируем выполнение)
      client.from('teams').select('count').limit(1).then(() => {
        console.log('Supabase connection: OK');
      }).catch(err => {
        console.warn('Supabase connection warning (will use localStorage):', err);
        client = null;
      });
    } catch (e) {
      console.warn('Failed to create Supabase client (will use localStorage):', e);
      client = null;
    }
  } else {
    if (!window.supabase) {
      console.warn('Supabase SDK is not loaded. Using localStorage mode.');
    } else {
      console.warn('Supabase config is missing. Using localStorage mode. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY in js/config.js');
    }
  }

  function normalizeTeam(t){
    return {
      name: t.name,
      logoUrl: t.logo_url || t.logoUrl || '',
      players: Array.isArray(t.players) ? t.players : [],
      rating: typeof t.rating === 'number' ? t.rating : 1500,
      history: Array.isArray(t.history) ? t.history : [],
      awards: Array.isArray(t.awards) ? t.awards : []
    };
  }

  async function fetchTeams(){
    if (!client) {
      // Fallback to localStorage
      const raw = localStorage.getItem('cs_teams');
      const local = JSON.parse(raw || '[]');
      return local.map(normalizeTeam);
    }
    try {
      const { data, error } = await client
        .from('teams')
        .select('name,logo_url,rating,players,history,awards')
        .order('rating', { ascending: false });
      if (error) {
        console.error('Supabase fetchTeams error:', error);
        throw error;
      }
      return (data || []).map(normalizeTeam);
    } catch (e) {
      console.error('Error fetching teams from Supabase:', e);
      // Fallback to localStorage
      const raw = localStorage.getItem('cs_teams');
      const local = JSON.parse(raw || '[]');
      return local.map(normalizeTeam);
    }
  }

  async function getTeamByName(name){
    if (!client) {
      // Fallback to localStorage
      const raw = localStorage.getItem('cs_teams');
      const local = JSON.parse(raw || '[]');
      const team = local.find(t => t.name === name);
      return team ? normalizeTeam(team) : null;
    }
    try {
      const { data, error } = await client
        .from('teams')
        .select('name,logo_url,rating,players,history,awards')
        .eq('name', name)
        .maybeSingle();
      if (error) {
        console.error('Supabase getTeamByName error:', error);
        throw error;
      }
      return data ? normalizeTeam(data) : null;
    } catch (e) {
      console.error('Error getting team from Supabase:', e);
      // Fallback to localStorage
      const raw = localStorage.getItem('cs_teams');
      const local = JSON.parse(raw || '[]');
      const team = local.find(t => t.name === name);
      return team ? normalizeTeam(team) : null;
    }
  }

  async function upsertTeam(team){
    // Всегда сохраняем в localStorage
    const raw = localStorage.getItem('cs_teams');
    const local = JSON.parse(raw || '[]');
    const idx = local.findIndex(t => t.name === team.name);
    if (idx !== -1) {
      local[idx] = team;
    } else {
      local.push(team);
    }
    localStorage.setItem('cs_teams', JSON.stringify(local));
    
    // Пытаемся сохранить в Supabase если доступно
    if (!client) {
      return;
    }
    try {
      const payload = {
        name: team.name,
        logo_url: team.logoUrl || '',
        players: Array.isArray(team.players) ? team.players : [],
        rating: typeof team.rating === 'number' ? team.rating : 1500,
        history: Array.isArray(team.history) ? team.history : [],
        awards: Array.isArray(team.awards) ? team.awards : []
      };
      const { error } = await client.from('teams').upsert(payload, { onConflict: 'name' });
      if (error) {
        console.error('Supabase upsertTeam error:', error);
      }
    } catch (e) {
      console.error('Error upserting team to Supabase:', e);
    }
  }

  async function upsertTeamsBulk(teams){
    if (!Array.isArray(teams) || teams.length === 0) return;
    
    // Всегда сохраняем в localStorage
    localStorage.setItem('cs_teams', JSON.stringify(teams));
    
    // Пытаемся сохранить в Supabase если доступно
    if (!client) {
      return;
    }
    try {
      const payload = teams.map(t => ({
        name: t.name,
        logo_url: t.logoUrl || '',
        players: Array.isArray(t.players) ? t.players : [],
        rating: typeof t.rating === 'number' ? t.rating : 1500,
        history: Array.isArray(t.history) ? t.history : [],
        awards: Array.isArray(t.awards) ? t.awards : []
      }));
      const { error } = await client.from('teams').upsert(payload, { onConflict: 'name' });
      if (error) {
        console.error('Supabase upsertTeamsBulk error:', error);
      }
    } catch (e) {
      console.error('Error upserting teams to Supabase:', e);
    }
  }

  // Функции для работы с профилями игроков
  async function fetchPlayerStats(playerName){
    if (!client) {
      return null;
    }
    try {
      const { data, error } = await client
        .from('player_stats')
        .select('*')
        .eq('player_name', playerName)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching player stats:', error);
      }
      return data || null;
    } catch (e) {
      console.error('Error fetching player stats from Supabase:', e);
      return null;
    }
  }

  async function updatePlayerStats(playerName, stats){
    if (!client) {
      return null;
    }
    try {
      const payload = {
        player_name: playerName,
        current_team: stats.current_team || null,
        total_matches: stats.total_matches || 0,
        wins: stats.wins || 0,
        avg_rating: stats.avg_rating || 1.0,
        best_rating: stats.best_rating || 1.0,
        win_rate: stats.win_rate || 0,
        total_kills: stats.total_kills || 0,
        total_deaths: stats.total_deaths || 0,
        kd_ratio: stats.kd_ratio || 0,
        avg_adr: stats.avg_adr || 0,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await client
        .from('player_stats')
        .upsert(payload, { onConflict: 'player_name' });
      if (error) {
        console.error('Error updating player stats:', error);
      }
      return data ? data[0] : null;
    } catch (e) {
      console.error('Error updating player stats in Supabase:', e);
      return null;
    }
  }

  async function fetchPlayerMatches(playerName){
    if (!client) {
      return [];
    }
    try {
      const { data, error } = await client
        .from('player_matches')
        .select('*')
        .eq('player_name', playerName)
        .order('match_date', { ascending: false });
      if (error) {
        console.error('Error fetching player matches:', error);
      }
      return data || [];
    } catch (e) {
      console.error('Error fetching player matches from Supabase:', e);
      return [];
    }
  }

  async function savePlayerMatch(match){
    if (!client) {
      return null;
    }
    try {
      const payload = {
        player_name: match.player_name,
        team_name: match.team_name,
        opponent: match.opponent,
        match_date: match.match_date,
        result: match.result,
        score: match.score,
        rating: match.rating || 1.0,
        kills: match.kills || 0,
        deaths: match.deaths || 0,
        adr: match.adr || 0
      };
      const { data, error } = await client
        .from('player_matches')
        .insert([payload]);
      if (error) {
        console.error('Error saving player match:', error);
      }
      return data ? data[0] : null;
    } catch (e) {
      console.error('Error saving player match to Supabase:', e);
      return null;
    }
  }

  // Совместимость: замена localStorage функций на API
  async function readSavedTeams(){
    return await fetchTeams();
  }

  async function writeSavedTeams(arr){
    await upsertTeamsBulk(arr || []);
  }

  // Экспорт в глобальную область
  window.csApi = { 
    client, 
    fetchTeams, 
    getTeamByName, 
    upsertTeam, 
    upsertTeamsBulk,
    fetchPlayerStats,
    updatePlayerStats,
    fetchPlayerMatches,
    savePlayerMatch
  };
  window.readSavedTeams = readSavedTeams;
  window.writeSavedTeams = writeSavedTeams;
  
  // Одноразовая миграция из localStorage -> Supabase
  (async function migrateLocalToSupabaseIfNeeded(){
    try {
      const flag = localStorage.getItem('cs_migrated_to_supabase');
      if (flag === '1') return;
      const raw = localStorage.getItem('cs_teams');
      const local = JSON.parse(raw || '[]');
      if (Array.isArray(local) && local.length > 0) {
        const normalized = local.map(t => ({
          name: t.name,
          logoUrl: t.logoUrl || '',
          players: Array.isArray(t.players) ? t.players : [],
          rating: typeof t.rating === 'number' ? t.rating : 1500,
          history: Array.isArray(t.history) ? t.history : [],
          awards: Array.isArray(t.awards) ? t.awards : []
        }));
        await upsertTeamsBulk(normalized);
      }
      localStorage.setItem('cs_migrated_to_supabase', '1');
    } catch (e) {
      console.warn('Local->Supabase migration skipped:', e);
    }
  })();
})();


