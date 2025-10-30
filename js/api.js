// api.js — Supabase API wrappers
// Требуется: подключён CDN @supabase/supabase-js v2 и файл js/config.js с window.SUPABASE_URL, window.SUPABASE_ANON_KEY

(function(){
  if (!window.supabase) {
    console.error('Supabase SDK is not loaded. Include @supabase/supabase-js before api.js');
    return;
  }
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.warn('Supabase config is missing. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY in js/config.js');
  }

  const client = supabase.createClient(window.SUPABASE_URL || '', window.SUPABASE_ANON_KEY || '');

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
    const { data, error } = await client
      .from('teams')
      .select('name,logo_url,rating,players,history,awards')
      .order('rating', { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizeTeam);
  }

  async function getTeamByName(name){
    const { data, error } = await client
      .from('teams')
      .select('name,logo_url,rating,players,history,awards')
      .eq('name', name)
      .maybeSingle();
    if (error) throw error;
    return data ? normalizeTeam(data) : null;
  }

  async function upsertTeam(team){
    const payload = {
      name: team.name,
      logo_url: team.logoUrl || '',
      players: Array.isArray(team.players) ? team.players : [],
      rating: typeof team.rating === 'number' ? team.rating : 1500,
      history: Array.isArray(team.history) ? team.history : [],
      awards: Array.isArray(team.awards) ? team.awards : []
    };
    const { error } = await client.from('teams').upsert(payload, { onConflict: 'name' });
    if (error) throw error;
  }

  async function upsertTeamsBulk(teams){
    if (!Array.isArray(teams) || teams.length === 0) return;
    const payload = teams.map(t => ({
      name: t.name,
      logo_url: t.logoUrl || '',
      players: Array.isArray(t.players) ? t.players : [],
      rating: typeof t.rating === 'number' ? t.rating : 1500,
      history: Array.isArray(t.history) ? t.history : [],
      awards: Array.isArray(t.awards) ? t.awards : []
    }));
    const { error } = await client.from('teams').upsert(payload, { onConflict: 'name' });
    if (error) throw error;
  }

  // Совместимость: замена localStorage функций на API
  async function readSavedTeams(){
    return await fetchTeams();
  }

  async function writeSavedTeams(arr){
    await upsertTeamsBulk(arr || []);
  }

  // Экспорт в глобальную область
  window.csApi = { client, fetchTeams, getTeamByName, upsertTeam, upsertTeamsBulk };
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


