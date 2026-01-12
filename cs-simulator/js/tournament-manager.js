// Класс для управления турнирами
class TournamentManager {
  constructor() {
    this.tournaments = [];
    this.allTeams = [];
    this.currentTournament = null;
  }

  /**
   * Загружает все турниры из localStorage
   */
  loadTournaments() {
    const saved = localStorage.getItem('cs_tournaments');
    this.tournaments = saved ? JSON.parse(saved) : [];
    
    // Восстанавливаем данные команд если их нет
    this.tournaments = this.tournaments.map(tournament => {
      if (!tournament.teams || tournament.teams.length === 0) {
        console.log(`Restoring teams for tournament ${tournament.id}`);
        // Восстанавливаем из teamIds
        tournament.teams = tournament.teamIds.map(teamId => {
          const team = this.allTeams.find(t => t.id === teamId);
          return {
            id: teamId,
            name: team?.name || 'Unknown',
            logoUrl: team?.logoUrl || '',
            players: team?.players || []
          };
        });
      }
      return tournament;
    });
    
    console.log('Loaded tournaments:', this.tournaments);
  }

  /**
   * Сохраняет турниры в localStorage
   */
  saveTournaments() {
    localStorage.setItem('cs_tournaments', JSON.stringify(this.tournaments));
  }

  /**
   * Загружает все команды из localStorage или API
   */
  async loadTeams() {
    try {
      if (window.csApi) {
        this.allTeams = await window.csApi.fetchTeams();
      } else {
        const raw = localStorage.getItem('cs_teams');
        this.allTeams = JSON.parse(raw || '[]');
      }
      console.log('Loaded teams:', this.allTeams);
      return this.allTeams;
    } catch (e) {
      console.error('Error loading teams:', e);
      this.allTeams = [];
      return [];
    }
  }

  /**
   * Создаёт новый турнир
   */
  createTournament(data) {
    console.log('Creating tournament with data:', data);
    console.log('Available teams in manager:', this.allTeams);

    // Сохраняем информацию о командах в турнир
    const tournamentTeams = data.teams.map(teamId => {
      const team = this.allTeams.find(t => t.id === teamId);
      console.log(`Looking for team ${teamId}, found:`, team);
      return {
        id: teamId,
        name: team?.name || 'Unknown',
        logoUrl: team?.logoUrl || '',
        players: team?.players || []
      };
    });

    console.log('Tournament teams after mapping:', tournamentTeams);

    const tournament = {
      id: Date.now().toString(),
      name: data.name,
      createdAt: new Date().toISOString(),
      status: 'active', // active, completed
      teamIds: data.teams, // массив с ID команд
      teams: tournamentTeams, // сохраняем полную информацию о командах
      groupStageFormat: data.groupStageFormat, // 'none', 'swiss', 'round-robin', 'double'
      groupRounds: data.groupRounds || 0,
      groupsCount: data.groupsCount || 1, // количество групп для double elimination
      playoffFormat: data.playoffFormat, // 'single', 'double'
      playoffTeams: parseInt(data.playoffTeams),
      groupStage: null, // будет заполнено после инициализации
      playoff: null, // будет заполнено после инициализации
      currentStage: 'group', // 'group' или 'playoff'
      completed: false
    };

    // Инициализируем групповую стадию, если она есть
    if (tournament.groupStageFormat !== 'none') {
      try {
        if (tournament.groupStageFormat === 'swiss') {
          tournament.groupStage = this.initializeSwissSystem(tournament);
          console.log('Initialized Swiss system');
        } else if (tournament.groupStageFormat === 'round-robin') {
          tournament.groupStage = this.initializeRoundRobin(tournament);
          console.log('Initialized Round Robin');
        } else if (tournament.groupStageFormat === 'double') {
          tournament.groupStage = this.initializeDoubleGroupStage(tournament);
          console.log('Initialized Double Elimination');
        }
      } catch (error) {
        console.error('Error initializing group stage:', error);
        throw new Error(`Ошибка при инициализации групповой стадии: ${error.message}`);
      }
    } else {
      // Если нет групповой стадии, сразу переходим к плей-офф
      tournament.currentStage = 'playoff';
    }

    // Инициализируем плей-офф (всегда)
    try {
      tournament.playoff = this.initializePlayoff(tournament);
      console.log('Initialized playoff');
    } catch (error) {
      console.error('Error initializing playoff:', error);
      throw new Error(`Ошибка при инициализации плей-офф: ${error.message}`);
    }

    this.tournaments.push(tournament);
    this.saveTournaments();
    console.log('Tournament created successfully:', tournament);
    return tournament;
  }

  /**
   * Инициализирует швейцарскую систему с выбыванием при 3 W/L
   */
  initializeSwissSystem(tournament) {
    const teams = tournament.teamIds.map(teamId => {
      const teamInfo = tournament.teams.find(t => t.id === teamId);
      return {
        id: teamId,
        name: teamInfo?.name || 'Unknown',
        wins: 0,
        losses: 0,
        points: 0,
        eliminated: false,
        eliminatedRound: null,
        matches: []
      };
    });

    const rounds = [];
    for (let i = 0; i < tournament.groupRounds; i++) {
      rounds.push({
        number: i + 1,
        matches: [],
        completed: false
      });
    }

    return {
      type: 'swiss',
      teams: teams,
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
   * Инициализирует круговую систему
   */
  initializeRoundRobin(tournament) {
    const teams = tournament.teamIds.map(teamId => {
      const teamInfo = tournament.teams.find(t => t.id === teamId);
      return {
        id: teamId,
        name: teamInfo?.name || 'Unknown',
        wins: 0,
        losses: 0,
        points: 0,
        matches: []
      };
    });

    // Генерируем все матчи
    const matches = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `match_${i}_${j}`,
          team1Id: teams[i].id,
          team2Id: teams[j].id,
          team1Score: null,
          team2Score: null,
          completed: false,
          maps: []
        });
      }
    }

    return {
      type: 'round-robin',
      teams: teams,
      matches: matches,
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
   * Инициализирует double elimination для групповой стадии (с группами)
   */
  initializeDoubleGroupStage(tournament) {
    const allTeams = tournament.teamIds.map(teamId => {
      const teamInfo = tournament.teams.find(t => t.id === teamId);
      return {
        id: teamId,
        name: teamInfo?.name || 'Unknown',
        wins: 0,
        losses: 0,
        eliminated: false
      };
    });

    const numGroups = tournament.groupsCount || 1;
    const teamsPerGroup = Math.ceil(allTeams.length / numGroups);
    
    // Разделяем команды на группы
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      const groupTeams = allTeams.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup);
      
      // Для каждой группы создаём верхнюю и нижнюю сетку
      const numRounds = Math.ceil(Math.log2(groupTeams.length));
      const roundsTemplate = [];
      for (let j = 0; j < numRounds; j++) {
        roundsTemplate.push({
          number: j + 1,
          matches: [],
          completed: false
        });
      }

      groups.push({
        groupNumber: i + 1,
        teams: groupTeams,
        winnersBracket: {
          rounds: JSON.parse(JSON.stringify(roundsTemplate)),
          standings: groupTeams.map(t => ({
            teamId: t.id,
            teamName: t.name,
            wins: 0,
            losses: 0,
            eliminated: false
          }))
        },
        losersBracket: {
          rounds: JSON.parse(JSON.stringify(roundsTemplate)),
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
      teams: allTeams,
      standings: allTeams.map(t => ({
        teamId: t.id,
        teamName: t.name,
        wins: 0,
        losses: 0,
        eliminated: false
      }))
    };
  }

  /**
   * Инициализирует плей-офф
   */
  initializePlayoff(tournament) {
    // Определяем команды для плей-офф
    let playoffTeams = [];
    
    if (tournament.groupStageFormat !== 'none' && tournament.groupStage) {
      // Берём топ команд из групповой стадии (не выбывших)
      const standings = tournament.groupStage.standings
        .filter(s => !s.eliminated)
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return b.wins - a.wins;
        })
        .slice(0, tournament.playoffTeams)
        .map(s => s.teamId);
      playoffTeams = standings;
    } else {
      // Берём первые N команд из оригинального списка
      playoffTeams = tournament.teamIds.slice(0, tournament.playoffTeams);
    }

    console.log('Playoff teams:', playoffTeams);

    if (playoffTeams.length < 2) {
      throw new Error(`Недостаточно команд для плей-офф: ${playoffTeams.length}`);
    }

    let playoff;
    if (tournament.playoffFormat === 'single') {
      playoff = this.initializeSingleElimination(playoffTeams);
    } else if (tournament.playoffFormat === 'double') {
      playoff = this.initializeDoubleElimination(playoffTeams);
    } else {
      throw new Error(`Неизвестный формат плей-офф: ${tournament.playoffFormat}`);
    }

    console.log('Playoff initialized:', playoff);
    return playoff;
  }

  /**
   * Инициализирует single elimination
   */
  initializeSingleElimination(teams) {
    const rounds = [];
    let currentRoundTeams = [...teams];
    let roundNum = 0;

    while (currentRoundTeams.length > 1 && roundNum < 20) {
      roundNum++;
      const matches = [];
      
      for (let i = 0; i < currentRoundTeams.length; i += 2) {
        if (i + 1 < currentRoundTeams.length) {
          // Нормальный матч между двумя командами
          matches.push({
            id: `se_match_${Date.now()}_${roundNum}_${i}`,
            team1Id: currentRoundTeams[i],
            team2Id: currentRoundTeams[i + 1],
            team1Score: null,
            team2Score: null,
            winner: null,
            completed: false,
            maps: []
          });
        } else {
          // БУХ (bye) для нечётного количества команд - автоматически проходит дальше
          matches.push({
            id: `se_match_${Date.now()}_${roundNum}_${i}`,
            team1Id: currentRoundTeams[i],
            team2Id: null,
            team1Score: null,
            team2Score: null,
            winner: currentRoundTeams[i],
            completed: true,
            isBye: true,
            maps: []
          });
        }
      }

      rounds.push({
        number: rounds.length + 1,
        matches: matches,
        completed: false
      });

      // Подготавливаем команды для следующего раунда
      // Для незавершённых матчей берём team1Id как placeholder
      currentRoundTeams = matches.map(m => m.winner || m.team1Id);
    }

    return {
      type: 'single',
      rounds: rounds,
      winner: null
    };
  }

  /**
   * Инициализирует double elimination
   */
  initializeDoubleElimination(teams) {
    // Верхняя сетка (winners bracket)
    const winnersBracket = this.initializeSingleElimination(teams);
    
    // Нижняя сетка (losers bracket) - начинается со проигравших из первого раунда
    const firstRoundMatches = winnersBracket.rounds[0].matches;
    const losers = [];
    firstRoundMatches.forEach(match => {
      if (!match.isBye) {
        losers.push(match.team2Id); // Проигравший
      }
    });

    const losersBracket = this.initializeSingleElimination(losers.length > 0 ? losers : teams.slice(teams.length / 2));

    return {
      type: 'double',
      winnersBracket: winnersBracket,
      losersBracket: losersBracket,
      grand: {
        team1Id: null, // Победитель верхней сетки
        team2Id: null, // Победитель нижней сетки
        team1Score: null,
        team2Score: null,
        winner: null,
        completed: false,
        maps: []
      },
      completed: false
    };
  }

  /**
   * Обновляет результат матча в групповой стадии
   */
  updateGroupMatch(tournamentId, roundNumber, matchId, team1Score, team2Score) {
    const tournament = this.tournaments.find(t => t.id === tournamentId);
    if (!tournament || !tournament.groupStage) return false;

    const round = tournament.groupStage.rounds.find(r => r.number === roundNumber);
    if (!round) return false;

    const match = round.matches.find(m => m.id === matchId);
    if (!match) return false;

    match.team1Score = team1Score;
    match.team2Score = team2Score;
    match.completed = true;

    // Обновляем статистику команд
    this.updateGroupStandings(tournament);

    this.saveTournaments();
    return true;
  }

  /**
   * Обновляет статистику команд в групповой стадии
   */
  updateGroupStandings(tournament) {
    const standings = new Map();
    tournament.teamIds.forEach(teamId => {
      standings.set(teamId, {
        teamId: teamId,
        teamName: tournament.teams.find(t => t.id === teamId)?.name || 'Unknown',
        wins: 0,
        losses: 0,
        points: 0,
        matchesPlayed: 0,
        eliminated: false,
        eliminatedRound: null
      });
    });

    const rounds = tournament.groupStage.rounds || [];
    rounds.forEach((round, roundIdx) => {
      round.matches.forEach(match => {
        if (!match.completed) return;

        let team1 = standings.get(match.team1Id);
        let team2 = standings.get(match.team2Id);

        if (!team1 || !team2) return;

        team1.matchesPlayed++;
        team2.matchesPlayed++;

        if (match.team1Score > match.team2Score) {
          team1.wins++;
          team1.points += 3;
          team2.losses++;
        } else if (match.team2Score > match.team1Score) {
          team2.wins++;
          team2.points += 3;
          team1.losses++;
        } else {
          team1.points += 1;
          team2.points += 1;
        }

        // Проверяем выбывание: 3 победы ИЛИ 3 поражения
        if (tournament.groupStageFormat === 'swiss') {
          if (team1.wins === 3 && !team1.eliminated) {
            team1.eliminated = true;
            team1.eliminatedRound = round.number;
          }
          if (team1.losses === 3 && !team1.eliminated) {
            team1.eliminated = true;
            team1.eliminatedRound = round.number;
          }
          if (team2.wins === 3 && !team2.eliminated) {
            team2.eliminated = true;
            team2.eliminatedRound = round.number;
          }
          if (team2.losses === 3 && !team2.eliminated) {
            team2.eliminated = true;
            team2.eliminatedRound = round.number;
          }
        }
      });
    });

    tournament.groupStage.standings = Array.from(standings.values());
  }

  /**
   * Генерирует матчи для следующего раунда швейцарской системы
   */
  generateSwissRound(tournamentId, roundNumber) {
    const tournament = this.tournaments.find(t => t.id === tournamentId);
    if (!tournament || !tournament.groupStage) return false;

    const round = tournament.groupStage.rounds.find(r => r.number === roundNumber);
    if (!round || round.matches.length > 0) return false;

    const standings = [...tournament.groupStage.standings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.wins - a.wins;
    });

    const matches = [];
    const used = new Set();

    for (let i = 0; i < standings.length; i += 2) {
      if (i + 1 < standings.length) {
        const team1 = standings[i];
        const team2 = standings[i + 1];

        // Проверяем, не играли ли уже друг с другом
        let team2Idx = i + 1;
        while (
          team2Idx < standings.length &&
          this.havePlayedBefore(tournament, team1.teamId, standings[team2Idx].teamId)
        ) {
          team2Idx++;
        }

        if (team2Idx < standings.length) {
          matches.push({
            id: `swiss_match_${roundNumber}_${matches.length}`,
            team1Id: team1.teamId,
            team2Id: standings[team2Idx].teamId,
            team1Score: null,
            team2Score: null,
            completed: false,
            maps: []
          });
          used.add(team1.teamId);
          used.add(standings[team2Idx].teamId);
        }
      }
    }

    round.matches = matches;
    this.saveTournaments();
    return true;
  }

  /**
   * Проверяет, играли ли команды друг с другом в групповой стадии
   */
  havePlayedBefore(tournament, team1Id, team2Id) {
    if (!tournament.groupStage) return false;

    return tournament.groupStage.rounds.some(round =>
      round.matches.some(match =>
        (match.team1Id === team1Id && match.team2Id === team2Id) ||
        (match.team1Id === team2Id && match.team2Id === team1Id)
      )
    );
  }

  /**
   * Обновляет результат матча в плей-офф
   */
  updatePlayoffMatch(tournamentId, stage, roundNumber, matchId, winner) {
    const tournament = this.tournaments.find(t => t.id === tournamentId);
    if (!tournament || !tournament.playoff) return false;

    const playoff = tournament.playoff;

    if (playoff.type === 'single') {
      const round = playoff.rounds.find(r => r.number === roundNumber);
      const match = round.matches.find(m => m.id === matchId);
      if (match) {
        match.winner = winner;
        match.completed = true;
      }
    } else if (playoff.type === 'double') {
      let bracket = stage === 'winners' ? playoff.winnersBracket : playoff.losersBracket;
      const round = bracket.rounds.find(r => r.number === roundNumber);
      const match = round.matches.find(m => m.id === matchId);
      if (match) {
        match.winner = winner;
        match.completed = true;
      }
    }

    this.saveTournaments();
    return true;
  }

  /**
   * Завершает групповую стадию и переходит к плей-офф
   */
  completeGroupStage(tournamentId) {
    const tournament = this.tournaments.find(t => t.id === tournamentId);
    if (!tournament) return false;

    tournament.currentStage = 'playoff';
    tournament.playoff = this.initializePlayoff(tournament);
    this.saveTournaments();
    return true;
  }

  /**
   * Получает турнир по ID
   */
  getTournament(id) {
    return this.tournaments.find(t => t.id === id);
  }

  /**
   * Удаляет турнир
   */
  deleteTournament(id) {
    const idx = this.tournaments.findIndex(t => t.id === id);
    if (idx >= 0) {
      this.tournaments.splice(idx, 1);
      this.saveTournaments();
      return true;
    }
    return false;
  }

  /**
   * Получает команду по ID
   */
  getTeamById(teamId) {
    return this.allTeams.find(t => t.id === teamId);
  }
}

// Экспортируем менеджер
const tournamentManager = new TournamentManager();
