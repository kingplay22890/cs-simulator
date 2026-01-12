/**
 * Tournament Manager v2 - Clean and Simple
 */

class TournamentManagerV2 {
  constructor() {
    this.tournaments = [];
    this.allTeams = [];
    this.currentTournament = null;
  }

  /**
   * Load all teams from API or localStorage
   */
  async loadTeams() {
    console.log('🔵 loadTeams() called!');
    try {
      console.log('🔵 Checking csApi...');
      if (window.csApi) {
        console.log('🔵 Using csApi.fetchTeams()');
        let teams = await window.csApi.fetchTeams();
        console.log('🔵 Fetched teams from csApi:', teams.length, 'teams');
        
        // Миграция для команд из API - добавляем ID если нету
        let needsSave = false;
        teams = teams.map((t, idx) => {
          console.log(`🔵 Processing API team ${idx}: ${t.name}, has id: ${!!t.id}`);
          if (!t.id) {
            needsSave = true;
            const id = 'team_' + (t.name || `team${idx}`).replace(/\s+/g, '_').toLowerCase() + '_' + idx;
            console.log(`🔄 Migrating API team: "${t.name}" -> ID: ${id}`);
            return {
              id: id,
              name: t.name,
              logoUrl: t.logoUrl || '',
              players: Array.isArray(t.players) ? t.players : [],
              rating: typeof t.rating === 'number' ? t.rating : 1500,
              history: Array.isArray(t.history) ? t.history : []
            };
          }
          return {
            id: t.id,
            name: t.name,
            logoUrl: t.logoUrl || '',
            players: Array.isArray(t.players) ? t.players : [],
            rating: typeof t.rating === 'number' ? t.rating : 1500,
            history: Array.isArray(t.history) ? t.history : []
          };
        });
        
        // Сохраняем в localStorage если были миграции
        if (needsSave) {
          console.log('💾 Saving migrated API teams to localStorage');
          
        }
        
        this.allTeams = teams;
      } else {
        console.log('🔵 Using localStorage cs_teams');
        const raw = localStorage.getItem('cs_teams');
        console.log('🔵 Raw localStorage:', raw ? raw.substring(0, 100) + '...' : 'EMPTY');
        let teams = JSON.parse(raw || '[]');
        console.log('🔵 Parsed teams:', teams.length, 'teams');
        
        // Migrate old teams to have IDs if they don't
        let needsSave = false;
        teams = teams.map((t, idx) => {
          console.log(`🔵 Processing team ${idx}: ${t.name}, has id: ${!!t.id}`);
          if (!t.id) {
            needsSave = true;
            const id = 'team_' + (t.name || `team${idx}`).replace(/\s+/g, '_').toLowerCase() + '_' + idx;
            console.log(`🔄 Migrating team: "${t.name}" -> ID: ${id}`);
            return {
              id: id,
              name: t.name,
              logoUrl: t.logoUrl || '',
              players: Array.isArray(t.players) ? t.players : [],
              rating: typeof t.rating === 'number' ? t.rating : 1500,
              history: Array.isArray(t.history) ? t.history : []
            };
          }
          return {
            id: t.id,
            name: t.name,
            logoUrl: t.logoUrl || '',
            players: Array.isArray(t.players) ? t.players : [],
            rating: typeof t.rating === 'number' ? t.rating : 1500,
            history: Array.isArray(t.history) ? t.history : []
          };
        });
        
        // Save migrated teams
        if (needsSave) {
          console.log('💾 Saving migrated teams to localStorage');
          
        }
        
        this.allTeams = teams;
      }
      console.log('✅ Teams loaded:', this.allTeams.length, 'teams');
      this.allTeams.forEach(t => {
        console.log(`  - ${t.name} (ID: ${t.id})`);
      });
      return this.allTeams;
    } catch (e) {
      console.error('❌ Error loading teams:', e);
      this.allTeams = [];
      return [];
    }
  }

  /**
   * Load tournaments from localStorage
   */
  loadTournaments() {
    try {
      const saved = localStorage.getItem('cs_tournaments_v2');
      let parsed = [];
      try {
        parsed = JSON.parse(saved || '[]');
      } catch (e) {
        console.warn('Could not parse cs_tournaments_v2, will attempt recovery from sessionStorage', e);
        parsed = [];
      }

      // If parsed is empty or suspiciously small, try to recover from sessionStorage backups
      if ((!Array.isArray(parsed) || parsed.length <= 1)) {
        try {
          const backups = [];
          const prev = sessionStorage.getItem('cs_tournaments_v2_prev');
          const backup = sessionStorage.getItem('cs_tournaments_v2_backup');
          if (prev) {
            try { backups.push(...JSON.parse(prev)); } catch (e) { /* ignore */ }
          }
          if (backup) {
            try { backups.push(...JSON.parse(backup)); } catch (e) { /* ignore */ }
          }

          if (backups.length > 0) {
            console.log('Found tournament backups in sessionStorage, attempting merge');
            const map = new Map();
            (parsed || []).forEach(t => { if (t && t.id) map.set(String(t.id), t); });
            backups.forEach(t => { if (t && t.id) map.set(String(t.id), t); });
            const merged = Array.from(map.values());
            if (merged.length > parsed.length) {
              parsed = merged;
              try {
                localStorage.setItem('cs_tournaments_v2', JSON.stringify(parsed));
                console.log('🔁 Restored merged tournaments into localStorage (from session backups)');
              } catch (e) {
                console.warn('Could not save restored tournaments back to localStorage:', e);
              }
            }
          }
        } catch (e) {
          console.warn('Recovery attempt failed:', e);
        }
      }

      this.tournaments = Array.isArray(parsed) ? parsed : [];
      console.log('✅ Tournaments loaded:', this.tournaments.length);
      return this.tournaments;
    } catch (e) {
      console.error('❌ Error loading tournaments:', e);
      this.tournaments = [];
      return [];
    }
  }

  /**
   * Save tournaments to localStorage
   */
  saveTournaments() {
    try {
      // Save previous snapshot to sessionStorage before attempting to overwrite localStorage
      try {
        const current = localStorage.getItem('cs_tournaments_v2');
        if (current) sessionStorage.setItem('cs_tournaments_v2_prev', current);
      } catch (s) {
        // ignore sessionStorage failures
      }

      localStorage.setItem('cs_tournaments_v2', JSON.stringify(this.tournaments));
      console.log('✅ Tournaments saved');
    } catch (e) {
      console.error('❌ Error saving tournaments:', e);

      // If quota exceeded, try to trim old tournaments and retry, but keep a backup in sessionStorage
      try {
        const msg = (e && e.message) || '';
        const isQuota = e && (e.name === 'QuotaExceededError' || /quota/i.test(msg) || e.code === 22);
        // store full copy in sessionStorage backup
        try { sessionStorage.setItem('cs_tournaments_v2_backup', JSON.stringify(this.tournaments)); } catch (sessErr) { console.warn('Could not write full backup to sessionStorage:', sessErr); }

        if (isQuota && Array.isArray(this.tournaments) && this.tournaments.length > 1) {
          console.warn('⚠️ Quota exceeded — attempting to trim tournaments and retry saving');
          const keepCandidates = [50, 20, 10, 5, 1];
          for (const keep of keepCandidates) {
            const toKeep = this.tournaments.slice(-keep);
            try {
              localStorage.setItem('cs_tournaments_v2', JSON.stringify(toKeep));
              // replace stored tournaments with trimmed version
              this.tournaments = toKeep;
              console.log(`✅ Tournaments saved after trimming to last ${keep} entries`);
              return;
            } catch (inner) {
              // continue trying smaller keeps
              console.warn(`Retry with keep=${keep} failed:`, inner);
            }
          }
        }
      } catch (innerAll) {
        console.warn('Error handling quota exceeded while saving tournaments:', innerAll);
      }

      // Final fallback: save a backup to sessionStorage (non-persistent but keeps data for this tab)
      try {
        sessionStorage.setItem('cs_tournaments_v2_backup', JSON.stringify(this.tournaments));
        console.warn('Saved tournaments to sessionStorage backup due to localStorage quota limits');
      } catch (sessErr) {
        console.error('Failed to save tournaments to sessionStorage backup:', sessErr);
      }
    }
  }

  /**
   * Create a new tournament
   */
  createTournament(data) {
    console.log('Creating tournament:', data);
    // Normalize teamIds to strings (robust against number/string mismatch)
    const teamIds = Array.isArray(data.teamIds) ? data.teamIds.map(id => String(id)) : [];

    // Get full team info (compare IDs as strings)
    const tournamentTeams = teamIds.map(teamId => {
      const team = this.allTeams.find(t => String(t.id) === teamId);
      if (!team) {
        console.warn(`⚠️  Team not found: ${teamId}`);
        return { id: teamId, name: 'Unknown', logoUrl: '', players: [] };
      }
      return {
        id: String(team.id),
        name: team.name,
        logoUrl: team.logoUrl,
        players: team.players || [],
        rating: typeof team.rating === 'number' ? team.rating : (team.rating || null),
        history: Array.isArray(team.history) ? team.history : []
      };
    });

    console.log('Tournament teams:', tournamentTeams);

    const tournament = {
      id: Date.now().toString(),
      name: data.name,
      createdAt: new Date().toISOString(),
      status: 'active',
      teamIds: data.teamIds,
      teams: tournamentTeams,
      
      groupStageFormat: data.groupStageFormat, // 'none', 'swiss', 'round-robin', 'double'
      groupsCount: data.groupsCount || 1,
      groupRounds: data.groupRounds || 1,
      
      playoffFormat: data.playoffFormat, // 'single', 'double'
      playoffTeams: Number.isFinite(parseInt(data.playoffTeams)) ? parseInt(data.playoffTeams) : 4,
      
      groupStage: null,
      playoff: null,
      currentStage: 'group',
      completed: false
    };

    // Ensure teamIds saved as strings
    tournament.teamIds = teamIds;

    // Initialize group stage if selected
    if (tournament.groupStageFormat !== 'none') {
      tournament.groupStage = this.initializeGroupStage(tournament);
    } else {
      tournament.currentStage = 'playoff';
    }

    // Initialize playoff
    tournament.playoff = this.initializePlayoff(tournament);

    this.tournaments.push(tournament);
    this.saveTournaments();
    console.log('✅ Tournament created:', tournament);
    return tournament;
  }

  /**
   * Initialize group stage based on format
   */
  initializeGroupStage(tournament) {
    const format = tournament.groupStageFormat;
    const teams = tournament.teams;

    if (format === 'double') {
      return this.initializeDoubleElimination(tournament);
    } else if (format === 'swiss') {
      return this.initializeSwiss(tournament);
    } else if (format === 'round-robin') {
      return this.initializeRoundRobin(tournament);
    }

    return null;
  }

  /**
   * Double Elimination group stage with multiple groups
   */
  initializeDoubleElimination(tournament) {
    const numGroups = tournament.groupsCount || 1;
    const teams = tournament.teams;
    const teamsPerGroup = Math.ceil(teams.length / numGroups);

    const groups = [];

    for (let g = 0; g < numGroups; g++) {
      const groupTeams = teams.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup);
      const numRounds = Math.max(1, Math.ceil(Math.log2(groupTeams.length)));

      const createRounds = () => {
        const rounds = [];
        for (let r = 0; r < numRounds; r++) {
          rounds.push({
            number: r + 1,
            matches: [],
            completed: false
          });
        }
        return rounds;
      };

      groups.push({
        number: g + 1,
        teams: groupTeams,
        winnersBracket: {
          rounds: createRounds(),
          standings: groupTeams.map(t => ({
            teamId: t.id,
            teamName: t.name,
            wins: 0,
            losses: 0,
            eliminated: false
          }))
        },
        losersBracket: {
          rounds: createRounds(),
          standings: groupTeams.map(t => ({
            teamId: t.id,
            teamName: t.name,
            wins: 0,
            losses: 0,
            eliminated: false
          }))
        }
      });
    }

    return {
      type: 'double',
      groups: groups,
      standings: teams.map(t => ({
        teamId: t.id,
        teamName: t.name,
        wins: 0,
        losses: 0
      }))
    };
  }

  /**
   * Swiss system
   */
  initializeSwiss(tournament) {
    const teams = tournament.teams;
    const rounds = [];

    for (let r = 0; r < tournament.groupRounds; r++) {
      rounds.push({
        number: r + 1,
        matches: [],
        completed: false
      });
    }

    return {
      type: 'swiss',
      rounds: rounds,
      standings: teams.map(t => ({
        teamId: t.id,
        teamName: t.name,
        wins: 0,
        losses: 0,
        points: 0,
        matchesPlayed: 0,
        eliminated: false,
        eliminatedRound: null
      }))
    };
  }

  /**
   * Round Robin
   */
  initializeRoundRobin(tournament) {
    const teams = tournament.teams;
    const rounds = [];

    for (let r = 0; r < tournament.groupRounds; r++) {
      rounds.push({
        number: r + 1,
        matches: [],
        completed: false
      });
    }

    return {
      type: 'round-robin',
      rounds: rounds,
      standings: teams.map(t => ({
        teamId: t.id,
        teamName: t.name,
        wins: 0,
        losses: 0,
        points: 0,
        matchesPlayed: 0
      }))
    };
  }

  /**
   * Initialize playoff
   */
  initializePlayoff(tournament) {
    const numTeams = Math.min(tournament.playoffTeams, tournament.teams.length);
    const teamIds = tournament.teams.slice(0, numTeams).map(t => t.id);

    const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random()*10000)}`;

    const seedMatches = (ids) => {
      const matches = [];
      for (let i = 0; i < ids.length; i += 2) {
        const a = ids[i];
        const b = ids[i+1] || null;
        matches.push({ id: makeId('m'), team1Id: a, team2Id: b, completed: false, winner: null, isBye: b === null });
      }
      return matches;
    };

    const roundsCount = Math.ceil(Math.log2(Math.max(1, numTeams)));

    if ((tournament.playoffFormat || 'single') === 'single') {
      const rounds = [];
      for (let r = 0; r < roundsCount; r++) {
        rounds.push({ number: r+1, matches: [] });
      }
      // seed first round
      if (rounds.length > 0) rounds[0].matches = seedMatches(teamIds);

      return {
        type: 'single',
        rounds: rounds,
        standings: teamIds.map(id => ({ teamId: id, teamName: this.getTeamById(id)?.name || 'Unknown', wins: 0, losses: 0 }))
      };
    }

    // Double elimination: winners + losers + grand final
    const winnersRounds = [];
    for (let r = 0; r < roundsCount; r++) winnersRounds.push({ number: r+1, matches: [] });
    if (winnersRounds.length > 0) winnersRounds[0].matches = seedMatches(teamIds);

    const losersRounds = [];
    // losers bracket typically has roundsCount-1 rounds (approx)
    for (let r = 0; r < Math.max(1, roundsCount - 1); r++) losersRounds.push({ number: r+1, matches: [] });

    const grand = { team1Id: null, team2Id: null, team1Score: null, team2Score: null, completed: false };

    return {
      type: 'double',
      winnersBracket: { rounds: winnersRounds },
      losersBracket: { rounds: losersRounds },
      grand: grand,
      standings: teamIds.map(id => ({ teamId: id, teamName: this.getTeamById(id)?.name || 'Unknown', wins: 0, losses: 0 }))
    };
  }

  /**
   * Get head-to-head history between two teams (defensive)
   */
  getMatchHistory(teamAId, teamBId) {
    const history = [];
    const a = this.allTeams.find(t => t.id === teamAId);
    const b = this.allTeams.find(t => t.id === teamBId);

    if (!a || !b) return history;

    const teamAName = (a.name || '').toString();
    const teamBName = (b.name || '').toString();

    const normalize = (s) => (s || '').toString().trim().toLowerCase();

    const seenKeys = new Set();

    const pushMatch = (entry, sourceIsA) => {
      if (!entry) return;

      // Try to detect participant names
      let pA = null, pB = null;
      if (entry.teamAName && entry.teamBName) {
        pA = entry.teamAName; pB = entry.teamBName;
      } else if (entry.team1Name && entry.team2Name) {
        pA = entry.team1Name; pB = entry.team2Name;
      } else if (entry.teams && Array.isArray(entry.teams) && entry.teams.length >= 2) {
        pA = entry.teams[0].name || entry.teams[0];
        pB = entry.teams[1].name || entry.teams[1];
      } else if (entry.opponent || entry.opponentName || entry.opponentId) {
        if (sourceIsA) {
          pA = teamAName;
          pB = entry.opponent || entry.opponentName || (entry.opponentId ? (this.getTeamById(entry.opponentId)?.name) : null);
        } else {
          pB = teamBName;
          pA = entry.opponent || entry.opponentName || (entry.opponentId ? (this.getTeamById(entry.opponentId)?.name) : null);
        }
      }

      if (!pA || !pB) return;

      // Normalize order: want pA => teamAName, pB => teamBName
      const nA = normalize(pA), nB = normalize(pB);
      const nTeamA = normalize(teamAName), nTeamB = normalize(teamBName);

      if (nA === nTeamB && nB === nTeamA) {
        // swapped — flip
        const tmp = pA; pA = pB; pB = tmp;
      }

      if (normalize(pA) !== nTeamA || normalize(pB) !== nTeamB) return; // not a direct H2H entry

      // Build unique key to avoid duplicates
      const key = `${entry.date||entry.matchDate||entry.match_date||''}::${normalize(pA)}::${normalize(pB)}::${entry.map||''}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      // Determine winner
      let winnerId = null;
      if (entry.winnerId) winnerId = entry.winnerId;
      else if (entry.winnerName) {
        if (normalize(entry.winnerName) === nTeamA) winnerId = teamAId;
        else if (normalize(entry.winnerName) === nTeamB) winnerId = teamBId;
      } else if (entry.result) {
        // result may be relative to source team ('Win'/'Loss')
        if (entry.result === 'Win') winnerId = sourceIsA ? teamAId : teamBId;
        else if (entry.result === 'Loss') winnerId = sourceIsA ? teamBId : teamAId;
      } else if (typeof entry.scoreA === 'number' && typeof entry.scoreB === 'number') {
        if (entry.scoreA > entry.scoreB) winnerId = teamAId;
        else if (entry.scoreB > entry.scoreA) winnerId = teamBId;
      }

      history.push({
        date: entry.date || entry.matchDate || entry.match_date || null,
        winnerId: winnerId,
        map: entry.map || entry.mapName || null,
        raw: entry,
        // normalizedMapDetails: array of { name, order, teamAScore, teamBScore, result }
        mapDetailsNormalized: (Array.isArray(entry.mapDetails) ? entry.mapDetails.map(md => {
          // Determine whether md.teamScore refers to pA or pB
          let teamAScore = null, teamBScore = null;
          const tryStr = (s) => (s||'').toString().trim().toLowerCase();
          const nTeamA = tryStr(teamAName);
          const nTeamB = tryStr(teamBName);
          const nTeam1 = tryStr(entry.team1Name || entry.teamName || entry.teamAName);
          const nTeam2 = tryStr(entry.team2Name || entry.opponent || entry.teamBName);

          if (nTeam1 && (nTeam1 === nTeamA || nTeam1 === nTeamB)) {
            // entry.team1Name present: assume teamScore -> team1
            if (nTeam1 === nTeamA) { teamAScore = md.teamScore; teamBScore = md.opponentScore; }
            else { teamAScore = md.opponentScore; teamBScore = md.teamScore; }
          } else if (tryStr(entry.opponent)) {
            // entry.opponent usually refers to opponent name relative to the source team
            const nOpp = tryStr(entry.opponent);
            if (nOpp === nTeamB) { teamAScore = md.teamScore; teamBScore = md.opponentScore; }
            else if (nOpp === nTeamA) { teamAScore = md.opponentScore; teamBScore = md.teamScore; }
            else {
              // fallback to sourceIsA if available on closure
              if (sourceIsA) { teamAScore = md.teamScore; teamBScore = md.opponentScore; }
              else { teamAScore = md.opponentScore; teamBScore = md.teamScore; }
            }
          } else {
            // final fallback: use sourceIsA
            if (sourceIsA) { teamAScore = md.teamScore; teamBScore = md.opponentScore; }
            else { teamAScore = md.opponentScore; teamBScore = md.teamScore; }
          }

          // Compute result from perspective of teamA
          const res = (typeof teamAScore === 'number' && typeof teamBScore === 'number') ? (teamAScore > teamBScore ? 'Win' : (teamAScore < teamBScore ? 'Loss' : 'Draw')) : (md.result || null);
          return { name: md.name || null, order: md.order || null, teamAScore, teamBScore, result: res };
        }) : [] )
      });
    };

    // Scan A history
    if (Array.isArray(a.history)) {
      a.history.forEach(h => pushMatch(h, true));
    }

    // Scan B history
    if (Array.isArray(b.history)) {
      b.history.forEach(h => pushMatch(h, false));
    }

    // Sort by date descending when date exists
    return history.sort((x, y) => {
      const dx = new Date(x.date || 0).getTime();
      const dy = new Date(y.date || 0).getTime();
      return dy - dx;
    });
  }

  /**
   * Calculate win chance between two teams using avg player rating and history/map winrates
   */
  calculateWinChance(teamAId, teamBId) {
    const a = this.getTeamById(teamAId);
    const b = this.getTeamById(teamBId);
    if (!a) return { a: 0, b: 100 };
    if (!b) return { a: 100, b: 0 };

    const avg = (team) => {
      // Prefer explicit team.rating if available
      if (typeof team.rating === 'number') {
        return team.rating > 10 ? team.rating : team.rating * 1000;
      }
      if (!team.players || team.players.length === 0) return 1500;
      const arr = team.players.map(p => typeof p.rating === 'number' ? p.rating : 1500);
      const rawAvg = arr.reduce((s, v) => s + v, 0) / arr.length;
      return rawAvg > 10 ? rawAvg : rawAvg * 1000;
    };

    const rA = avg(a);
    const rB = avg(b);

    // Base probability from Elo-like ratio (60% weight)
    const baseA = rA / (rA + rB);

    // Head-to-head adjustment (20% weight)
    const history = this.getMatchHistory(teamAId, teamBId);
    let hhAdj = 0;
    if (history.length > 0) {
      const winsA = history.filter(h => h.winnerId === teamAId).length;
      const winsB = history.filter(h => h.winnerId === teamBId).length;
      const total = winsA + winsB || 1;
      const h2hRatio = winsA / total; // 0 to 1
      hhAdj = (h2hRatio - 0.5) * 0.2; // ±0.1 range
    }

    // Recent form adjustment (10% weight) - last 5 matches
    let recentAdj = 0;
    const aRecent = (a.history || []).slice(-5).filter(h => h.winnerId === teamAId).length;
    const aRecentTotal = Math.min(5, (a.history || []).length);
    const bRecent = (b.history || []).slice(-5).filter(h => h.winnerId === teamBId).length;
    const bRecentTotal = Math.min(5, (b.history || []).length);
    if (aRecentTotal > 0 && bRecentTotal > 0) {
      const aRecentRate = aRecent / aRecentTotal;
      const bRecentRate = bRecent / bRecentTotal;
      recentAdj = (aRecentRate - bRecentRate) * 0.1; // ±0.1 range
    }

    // Map winrate adjustment (10% weight) - most common map
    let mapAdj = 0;
    const combined = [...(a.history||[]), ...(b.history||[])];
    const mapCounts = {};
    combined.forEach(h => { if (h.map) mapCounts[h.map] = (mapCounts[h.map]||0) + 1; });
    const maps = Object.keys(mapCounts).sort((x,y)=>mapCounts[y]-mapCounts[x]);
    if (maps.length > 0) {
      const map = maps[0];
      const aMapWins = (a.history||[]).filter(h => h.map === map && h.winnerId === teamAId).length;
      const bMapWins = (b.history||[]).filter(h => h.map === map && h.winnerId === teamBId).length;
      const totalMap = aMapWins + bMapWins || 1;
      const mapRatio = aMapWins / totalMap;
      mapAdj = (mapRatio - 0.5) * 0.1; // ±0.05 range
    }

    let probA = baseA + hhAdj + recentAdj + mapAdj;
    probA = Math.max(0.01, Math.min(0.99, probA));
    const probB = 1 - probA;
    return { a: Math.round(probA * 100), b: Math.round(probB * 100) };
  }

  /**
   * Get tournament by ID
   */
  getTournament(id) {
    return this.tournaments.find(t => t.id === id);
  }

  /**
   * Get team by ID from loaded teams
   */
  getTeamById(teamId) {
    if (!teamId) return null;
    const fromAll = this.allTeams.find(t => t.id === teamId);
    if (fromAll) return fromAll;
    // Search in tournaments (snapshots)
    for (const t of this.tournaments) {
      const found = (t.teams || []).find(x => x.id === teamId);
      if (found) return found;
    }
    return null;
  }

  /**
   * Apply match result to tournament structure
   */
  applyMatchResultToTournament(tournament, result) {
    const { matchId, team1Score, team2Score, winner } = result;
    const winnerId = winner === 'team1' ? result.team1Id : result.team2Id;

    console.log(`📊 Applying result to tournament ${tournament.id}, match ${matchId}, winner: ${winnerId}`);

    if (!tournament.playoff) {
      console.warn('Tournament has no playoff structure');
      return false;
    }

    // Single elimination
    if (tournament.playoff.type === 'single') {
      const rounds = tournament.playoff.rounds || [];
      for (let r = 0; r < rounds.length; r++) {
        const round = rounds[r];
        for (let mi = 0; mi < (round.matches || []).length; mi++) {
          const m = round.matches[mi];
          if (m.id === matchId) {
            m.completed = true;
            m.team1Score = team1Score;
            m.team2Score = team2Score;
            m.winner = winnerId;

            // Auto-promote winner to next round
            const nextRound = rounds[r + 1];
            if (nextRound) {
              const destIndex = Math.floor(mi / 2);
              nextRound.matches = nextRound.matches || [];
              while (nextRound.matches.length <= destIndex) {
                nextRound.matches.push({
                  id: `m_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
                  team1Id: null,
                  team2Id: null,
                  completed: false,
                  winner: null
                });
              }
              const dest = nextRound.matches[destIndex];
              if (!dest.team1Id) {
                dest.team1Id = winnerId;
              } else if (!dest.team2Id) {
                dest.team2Id = winnerId;
              }
            }
            return true;
          }
        }
      }
    }

    // Double elimination
    if (tournament.playoff.type === 'double') {
      const p = tournament.playoff;

      // Check winners bracket
      for (let r = 0; r < (p.winnersBracket?.rounds || []).length; r++) {
        const round = p.winnersBracket.rounds[r];
        for (let mi = 0; mi < (round.matches || []).length; mi++) {
          const m = round.matches[mi];
          if (m.id === matchId) {
            m.completed = true;
            m.team1Score = team1Score;
            m.team2Score = team2Score;
            m.winner = winnerId;

            // Promote to next winners round
            const next = p.winnersBracket.rounds[r + 1];
            if (next) {
              const destIndex = Math.floor(mi / 2);
              next.matches = next.matches || [];
              while (next.matches.length <= destIndex) {
                next.matches.push({
                  id: `m_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
                  team1Id: null,
                  team2Id: null,
                  completed: false,
                  winner: null
                });
              }
              const dest = next.matches[destIndex];
              if (!dest.team1Id) dest.team1Id = winnerId;
              else if (!dest.team2Id) dest.team2Id = winnerId;
            }
            return true;
          }
        }
      }

      // Check losers bracket
      for (const round of (p.losersBracket?.rounds || [])) {
        for (const m of (round.matches || [])) {
          if (m.id === matchId) {
            m.completed = true;
            m.team1Score = team1Score;
            m.team2Score = team2Score;
            m.winner = winnerId;
            return true;
          }
        }
      }

      // Check grand final
      if (p.grand && p.grand.id === matchId) {
        p.grand.completed = true;
        p.grand.team1Score = team1Score;
        p.grand.team2Score = team2Score;
        p.grand.winner = winnerId;
        return true;
      }
    }

    return false;
  }

  /**
   * Delete tournament
   */
  deleteTournament(id) {
    this.tournaments = this.tournaments.filter(t => t.id !== id);
    this.saveTournaments();
  }
}

// Create global instance
const tournamentManagerV2 = new TournamentManagerV2();

