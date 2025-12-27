// api.js — Supabase API wrappers
// Требуется: подключён CDN @supabase/supabase-js v2 и файл js/config.js с window.SUPABASE_URL, window.SUPABASE_ANON_KEY

(function(){
  let client = null;
  // Показываем баннер с инструкциями пользователю
  function showSupabaseNotice(message, details) {
    try {
      const id = 'supabase-notice';
      if (document.getElementById(id)) return;
      const div = document.createElement('div');
      div.id = id;
      div.style.position = 'fixed';
      div.style.right = '16px';
      div.style.top = '16px';
      div.style.zIndex = 9999;
      div.style.maxWidth = '420px';
      div.style.background = 'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(31,41,55,0.95))';
      div.style.color = '#fff';
      div.style.border = '1px solid rgba(255,255,255,0.06)';
      div.style.padding = '12px';
      div.style.borderRadius = '8px';
      div.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
      div.innerHTML = `
        <div style="font-weight:600;margin-bottom:6px;">${message}</div>
        <div style="font-size:12px;margin-bottom:8px;color:#d1d5db;">${details}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="supabase-notice-load" style="background:#10b981;border:none;padding:6px 8px;border-radius:6px;color:white;cursor:pointer">Load local sample</button>
          <button id="supabase-notice-close" style="background:transparent;border:1px solid rgba(255,255,255,0.08);padding:6px 8px;border-radius:6px;color:#9ca3af;cursor:pointer">Close</button>
        </div>
      `;
      document.addEventListener('DOMContentLoaded', ()=> document.body.appendChild(div));
      // attach handlers if DOM already ready
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        if (!document.body.contains(div)) document.body.appendChild(div);
      }
      // handlers
      window.addEventListener('click', (ev)=>{
        if (ev.target && ev.target.id === 'supabase-notice-close') {
          const el = document.getElementById(id); if (el) el.remove();
        }
        if (ev.target && ev.target.id === 'supabase-notice-load') {
          // Попытка загрузить локальный JSON файл teams-local.json
          fetch('teams-local.json').then(r=>r.json()).then(data=>{
            if (Array.isArray(data) && data.length>0) {
              localStorage.setItem('cs_teams', JSON.stringify(data));
              console.log('Loaded teams-local.json into localStorage (cs_teams)');
              const el = document.getElementById(id); if (el) el.remove();
              // try to notify app
              if (window.updateRatingsTable) window.updateRatingsTable();
            } else {
              alert('teams-local.json loaded but has no teams');
            }
          }).catch(e=>{ alert('Failed to load teams-local.json: '+e); console.error(e); });
        }
      });
    } catch (e) {
      // ignore
    }
  }
  
  // Проверяем наличие Supabase SDK и конфигурацию
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    try {
      client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      // Тестовый запрос для проверки подключения (не блокируем выполнение)
      client.from('teams').select('count').limit(1).then(() => {
        console.log('Supabase connection: OK');
      }).catch(err => {
        console.warn('Supabase connection warning (will use localStorage):', err);
        showSupabaseNotice('Supabase: connection problem', 'Requests to Supabase failed — likely CORS, network or RLS issues. Click "Load local sample" to continue using a local teams file, or run the app via http://localhost:8000 and add that origin in Supabase settings.');
        client = null;
      });
    } catch (e) {
      console.warn('Failed to create Supabase client (will use localStorage):', e);
      showSupabaseNotice('Supabase: init failed', 'Could not create Supabase client. Check `js/config.js` for correct SUPABASE_URL and SUPABASE_ANON_KEY.');
      client = null;
    }
  } else {
    if (!window.supabase) {
      console.warn('Supabase SDK is not loaded. Using localStorage mode.');
      showSupabaseNotice('Supabase SDK missing', 'The Supabase JS SDK is not loaded. Ensure you have the script tag for @supabase/supabase-js in your HTML.');
    } else {
      console.warn('Supabase config is missing. Using localStorage mode. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY in js/config.js');
      showSupabaseNotice('Supabase config missing', 'Set `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY` in `js/config.js` or use localStorage fallback.');
    }
  }

  function normalizeTeam(t){
    return {
      name: t.name,
      logoUrl: t.logo_url || t.logoUrl || '',
      country: t.country || t.country_name || '',
      region: t.region || t.region_name || '',
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
      // Если localStorage пустой, попробуем подгрузить teams-local.json (удобно при локальной разработке)
      if ((!local || local.length === 0) && typeof fetch === 'function') {
        try {
          const res = await fetch('teams-local.json');
          if (res && res.ok) {
            const arr = await res.json();
            if (Array.isArray(arr) && arr.length>0) {
              localStorage.setItem('cs_teams', JSON.stringify(arr));
              console.log('Loaded teams-local.json into localStorage as fallback.');
              return arr.map(normalizeTeam);
            }
          }
        } catch (e) {
          // ignore fetch errors
        }
      }
      return local.map(normalizeTeam);
    }
    try {
      // Попытка выбрать с полями country/region. Если этих колонок нет — повторим без них.
      let res = await client
        .from('teams')
        .select('name,logo_url,country,region,rating,players,history,awards')
        .order('rating', { ascending: false });

      if (res.error) {
        const msg = (res.error && res.error.message) || '';
        if (res.error.code === '42703' || res.error.code === 'PGRST204' || /column .* does not exist/i.test(msg) || /Could not find the .* column of 'teams' in the schema cache/i.test(msg)) {
          const fallback = await client
            .from('teams')
            .select('name,logo_url,rating,players,history,awards')
            .order('rating', { ascending: false });
          if (fallback.error) {
            console.error('Supabase fetchTeams fallback error:', fallback.error);
            throw fallback.error;
          }
          // Если в БД нет колонок country/region, попробуем подмешать их из localStorage
          const localRaw = localStorage.getItem('cs_teams');
          const localArr = JSON.parse(localRaw || '[]');
          const localMap = {};
          (localArr || []).forEach(lt => { if (lt && lt.name) localMap[lt.name] = lt; });
          return (fallback.data || []).map(d => {
            const nt = normalizeTeam(d);
            const localMatch = localMap[nt.name];
            if ((!nt.country || nt.country === '') && localMatch && localMatch.country) nt.country = localMatch.country;
            if ((!nt.region || nt.region === '') && localMatch && localMatch.region) nt.region = localMatch.region;
            return nt;
          });
        }
        console.error('Supabase fetchTeams error:', res.error);
        throw res.error;
      }
      return (res.data || []).map(normalizeTeam);
    } catch (e) {
        console.error('Error fetching teams from Supabase:', e);
        // Если ошибка с сетью/CORS — отключаем Supabase client, чтобы избежать постоянных ошибок
        try {
          const msg = (e && e.message) ? e.message.toString().toLowerCase() : '';
          if (msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('cors')) {
            console.warn('Network/CORS error detected — falling back to localStorage and disabling Supabase client.');
            client = null;
          }
        } catch (ie) {
          // ignore
        }
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
      let res = await client
        .from('teams')
        .select('name,logo_url,country,region,rating,players,history,awards')
        .eq('name', name)
        .maybeSingle();

      if (res.error) {
        const msg = (res.error && res.error.message) || '';
        if (res.error.code === '42703' || res.error.code === 'PGRST204' || /column .* does not exist/i.test(msg) || /Could not find the .* column of 'teams' in the schema cache/i.test(msg)) {
          const fallback = await client
            .from('teams')
            .select('name,logo_url,rating,players,history,awards')
            .eq('name', name)
            .maybeSingle();
          if (fallback.error) {
            console.error('Supabase getTeamByName fallback error:', fallback.error);
            throw fallback.error;
          }
          if (!fallback.data) return null;
          const nt = normalizeTeam(fallback.data);
          if ((!nt.country || nt.country === '') ) {
            const localRaw = localStorage.getItem('cs_teams');
            const localArr = JSON.parse(localRaw || '[]');
            const localMatch = (localArr || []).find(l => l && l.name === nt.name);
            if (localMatch) {
              nt.country = nt.country || localMatch.country || '';
              nt.region = nt.region || localMatch.region || '';
            }
          }
          return nt;
        }
        console.error('Supabase getTeamByName error:', res.error);
        throw res.error;
      }
      return res.data ? normalizeTeam(res.data) : null;
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
        country: team.country || '',
        region: team.region || '',
        players: Array.isArray(team.players) ? team.players : [],
        rating: typeof team.rating === 'number' ? team.rating : 1500,
        history: Array.isArray(team.history) ? team.history : [],
        awards: Array.isArray(team.awards) ? team.awards : []
      };
      let { error } = await client.from('teams').upsert(payload, { onConflict: 'name' });
      if (error) {
        const msg = (error && error.message) || '';
        if (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist/i.test(msg) || /Could not find the .* column of 'teams' in the schema cache/i.test(msg)) {
          // Повторяем без country/region
          const payload2 = { ...payload };
          delete payload2.country; delete payload2.region;
          const retry = await client.from('teams').upsert(payload2, { onConflict: 'name' });
          if (retry.error) {
            console.error('Supabase upsertTeam retry error:', retry.error);
          }
        } else {
          console.error('Supabase upsertTeam error:', error);
        }
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
        country: t.country || '',
        region: t.region || '',
        players: Array.isArray(t.players) ? t.players : [],
        rating: typeof t.rating === 'number' ? t.rating : 1500,
        history: Array.isArray(t.history) ? t.history : [],
        awards: Array.isArray(t.awards) ? t.awards : []
      }));
      let { error } = await client.from('teams').upsert(payload, { onConflict: 'name' });
      if (error) {
        const msg = (error && error.message) || '';
        if (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist/i.test(msg) || /Could not find the .* column of 'teams' in the schema cache/i.test(msg)) {
          const payload2 = payload.map(p => { const c = { ...p }; delete c.country; delete c.region; return c; });
          const retry = await client.from('teams').upsert(payload2, { onConflict: 'name' });
          if (retry.error) {
            console.error('Supabase upsertTeamsBulk retry error:', retry.error);
          }
        } else {
          console.error('Supabase upsertTeamsBulk error:', error);
        }
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
      // Если статус не указан в БД, устанавливаем 'active' по умолчанию
      if (data && !data.status) {
        data.status = 'active';
      }
      // Если награды не указаны в БД, устанавливаем пустой массив
      if (data && !data.awards) {
        data.awards = [];
      }
      return data || null;
    } catch (e) {
      console.error('Error fetching player stats from Supabase:', e);
      return null;
    }
  }

  async function updatePlayerStats(playerName, stats){
    if (!client) {
      // Fallback to local-only mode when no client available
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
        status: stats.status || 'active',
        awards: Array.isArray(stats.awards) ? stats.awards : [],
        updated_at: new Date().toISOString()
      };
      const { data, error } = await client
        .from('player_stats')
        .upsert(payload, { onConflict: 'player_name' })
        .select();
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
      // Try insert; if the target DB doesn't have the `adr` column (schema mismatch), retry without it
      let attemptPayload = { ...payload };
      try {
        const { data, error } = await client.from('player_matches').insert([attemptPayload]);
        if (error) {
          // If error mentions missing 'adr' column in schema cache, retry without adr
          const msg = (error && error.message) ? error.message.toString() : '';
          console.warn('Error saving player match (first attempt):', error);
          if (msg.toLowerCase().includes('adr') || (error.code === 'PGRST204')) {
            // remove adr and retry
            delete attemptPayload.adr;
            console.log('Retrying player match insert without `adr` field...');
            const { data: data2, error: error2 } = await client.from('player_matches').insert([attemptPayload]);
            if (error2) {
              console.error('Error saving player match on retry (without adr):', error2);
              return null;
            }
            return data2 ? data2[0] : null;
          }
          return null;
        }
        return data ? data[0] : null;
      } catch (e) {
        console.error('Exception while saving player match:', e);
        return null;
      }
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
    savePlayerMatch,
    writeSavedTeams // expose compatibility helper
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
          country: t.country || '',
          region: t.region || '',
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


