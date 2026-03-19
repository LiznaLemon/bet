/**
 * Parse ESPN NBA game summary JSON into Supabase-ready row arrays
 * Mirrors hoopR helper_espn_nba_* logic
 */

/**
 * Convert camelCase to snake_case
 */
function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

/**
 * Parse clock display value "12:00" or "0:45" into minutes and seconds
 */
function parseClock(displayValue) {
  if (!displayValue || typeof displayValue !== 'string') return { minutes: null, seconds: null };
  let s = displayValue.trim();
  if (!s.includes(':')) s = '0:' + s;
  const parts = s.split(':');
  const minutes = parseInt(parts[0], 10);
  const seconds = parseFloat(parts[1] || 0);
  return { minutes: isNaN(minutes) ? null : minutes, seconds: isNaN(seconds) ? null : seconds };
}

/**
 * Derive points_attempted from play (ESPN may provide it; otherwise infer from type_text)
 */
function getPointsAttempted(play) {
  if (!play.shootingPlay) return null;
  if (play.pointsAttempted != null && play.pointsAttempted !== '') {
    const v = parseInt(play.pointsAttempted, 10);
    if (!isNaN(v)) return v;
  }
  const typeText = (play.type?.text || '').toLowerCase();
  if (typeText.includes('3') || typeText.includes('three') || typeText.includes('3-pt')) return 3;
  if (typeText.includes('free throw')) return 1;
  return 2;
}

/**
 * Parse play-by-play data
 * @param {Object} json - ESPN game summary JSON
 * @returns {Array|null} Rows for play_by_play_raw, or null if no/invalid PBP
 */
export function parsePlayByPlay(json) {
  const header = json.header;
  const competitions = header?.competitions?.[0];
  if (!competitions) return null;

  const pbpSource = competitions.playByPlaySource;
  const plays = json.plays;
  if (pbpSource === 'none' || !plays || plays.length < 10) return null;

  const gameId = parseInt(header.id, 10);
  const season = header.season?.year;
  const seasonType = header.season?.type;
  const dateStr = competitions.date || '';
  const gameDate = dateStr.slice(0, 10);
  const gameDateTime = dateStr ? new Date(dateStr).toISOString() : null;

  const competitors = competitions.competitors || [];
  const homeIdx = competitors.findIndex((c) => c.homeAway === 'home');
  const awayIdx = competitors.findIndex((c) => c.homeAway === 'away');
  const homeTeam = competitors[homeIdx]?.team || {};
  const awayTeam = competitors[awayIdx]?.team || {};
  const homeTeamId = parseInt(competitors[homeIdx]?.id || 0, 10);
  const awayTeamId = parseInt(competitors[awayIdx]?.id || 0, 10);

  const homeAbbrev = (homeTeam.abbreviation || '').toLowerCase();
  const homeName = (homeTeam.location || '').toLowerCase();
  const homeMascot = (homeTeam.name || '').toLowerCase();
  const awayAbbrev = (awayTeam.abbreviation || '').toLowerCase();
  const awayName = (awayTeam.location || '').toLowerCase();
  const awayMascot = (awayTeam.name || '').toLowerCase();

  const rows = [];
  for (let i = 0; i < plays.length; i++) {
    const p = plays[i];
    const periodNum = p.period?.number ?? p.period;
    const clockVal = p.clock?.displayValue || p.clock || '';
    const { minutes: clockMin, seconds: clockSec } = parseClock(clockVal);

    const typeText = p.type?.text || '';
    const text = p.text || '';

    const homeTimeout =
      typeText === 'ShortTimeOut' &&
      (text.toLowerCase().includes(homeAbbrev) ||
        text.toLowerCase().includes(homeName) ||
        text.toLowerCase().includes(homeMascot));
    const awayTimeout =
      typeText === 'ShortTimeOut' &&
      (text.toLowerCase().includes(awayAbbrev) ||
        text.toLowerCase().includes(awayName) ||
        text.toLowerCase().includes(awayMascot));

    const qtr = periodNum != null ? parseInt(periodNum, 10) : null;
    const half = qtr != null ? (qtr <= 2 ? 1 : 2) : null;

    let startQuarterSec = null;
    let startHalfSec = null;
    let startGameSec = null;
    if (clockMin != null && clockSec != null && qtr != null) {
      const secInQtr = 60 * clockMin + clockSec;
      startQuarterSec = Math.round(secInQtr);
      startHalfSec =
        qtr === 1 || qtr === 3 ? Math.round(720 + secInQtr) : Math.round(secInQtr);
      if (qtr === 1) startGameSec = Math.round(2160 + secInQtr);
      else if (qtr === 2) startGameSec = Math.round(1440 + secInQtr);
      else if (qtr === 3) startGameSec = Math.round(720 + secInQtr);
      else startGameSec = Math.round(secInQtr);
    }

    const participants = p.participants || [];
    const athleteIds = participants.map((x) => parseInt(x.athlete?.id || 0, 10));

    const coord = p.coordinate || {};
    let coordX = coord.x;
    let coordY = coord.y;
    const validCoord =
      coordX != null &&
      coordY != null &&
      Math.abs(coordX) < 100 &&
      Math.abs(coordY) < 100;
    if (validCoord && typeText.includes('Free Throw')) {
      coordX = 25;
      coordY = 13.75;
    }
    if (validCoord && homeTeamId && p.team?.id) {
      const tid = parseInt(p.team.id, 10);
      const cx = coordX;
      const cy = coordY;
      coordX = tid === homeTeamId ? -1 * (cy - 41.75) : cy - 41.75;
      coordY = tid === homeTeamId ? -1 * (cx - 25) : cx - 25;
    } else if (!validCoord) {
      coordX = null;
      coordY = null;
    }

    const prevPlay = plays[i - 1];
    const nextPlay = plays[i + 1];
    const prevQtr = prevPlay?.period?.number ?? prevPlay?.period;
    const nextQtr = nextPlay?.period?.number ?? nextPlay?.period;
    const prevHalf = prevQtr != null ? (prevQtr <= 2 ? 1 : 2) : null;
    const nextHalf = nextQtr != null ? (nextQtr <= 2 ? 1 : 2) : null;

    let endQuarterSec = null;
    let endHalfSec = null;
    let endGameSec = null;
    if (nextPlay && nextPlay.clock?.displayValue != null) {
      const n = parseClock(nextPlay.clock.displayValue);
      const nq = nextPlay.period?.number ?? nextPlay.period;
      if (n.minutes != null && n.seconds != null && nq != null) {
        const secInQtr = 60 * n.minutes + n.seconds;
        endQuarterSec = Math.round(secInQtr);
        endHalfSec = nq === 1 || nq === 3 ? Math.round(720 + secInQtr) : Math.round(secInQtr);
        if (nq === 1) endGameSec = Math.round(2160 + secInQtr);
        else if (nq === 2) endGameSec = Math.round(1440 + secInQtr);
        else if (nq === 3) endGameSec = Math.round(720 + secInQtr);
        else endGameSec = Math.round(secInQtr);
      }
    }
    if (endQuarterSec == null && (i === 0 || (prevQtr != null && prevQtr !== qtr))) {
      endQuarterSec = qtr >= 5 ? 300 : 720;
    }
    if (endHalfSec == null && (i === 0 || (prevHalf != null && prevHalf !== half))) {
      endHalfSec = i === 0 ? 1440 : half === 1 ? 720 : 1440;
    }
    if (endGameSec == null && (i === 0 || (prevQtr != null && prevQtr !== qtr))) {
      if (i === 0) endGameSec = 2880;
      else if (prevQtr === 1 && qtr === 2) endGameSec = 2160;
      else if (prevQtr === 2 && qtr === 3) endGameSec = 1440;
      else if (prevQtr === 3 && qtr === 4) endGameSec = 720;
      else if (qtr >= 5) endGameSec = 300;
    }

    rows.push({
      id: p.id,
      sequence_number: String(p.sequenceNumber ?? ''),
      type_id: p.type?.id != null ? parseInt(p.type.id, 10) : null,
      type_text: typeText,
      text,
      away_score: p.awayScore != null ? parseInt(p.awayScore, 10) : null,
      home_score: p.homeScore != null ? parseInt(p.homeScore, 10) : null,
      period_number: periodNum != null ? parseInt(periodNum, 10) : null,
      period_display_value: p.period?.displayValue || '',
      clock_display_value: clockVal,
      scoring_play: !!p.scoringPlay,
      score_value: p.scoreValue != null ? parseInt(p.scoreValue, 10) : null,
      team_id: p.team?.id != null ? parseInt(p.team.id, 10) : null,
      athlete_id_1: athleteIds[0] || null,
      athlete_id_2: athleteIds[1] || null,
      athlete_id_3: athleteIds[2] || null,
      wallclock: p.wallclock || null,
      shooting_play: !!p.shootingPlay,
      coordinate_x_raw: coord.x,
      coordinate_y_raw: coord.y,
      points_attempted: getPointsAttempted(p),
      short_description: p.shortDescription || null,
      season,
      season_type: seasonType,
      away_team_id: awayTeamId,
      away_team_name: awayTeam.location,
      away_team_mascot: awayTeam.name,
      away_team_abbrev: awayTeam.abbreviation,
      away_team_name_alt: null,
      home_team_id: homeTeamId,
      home_team_name: homeTeam.location,
      home_team_mascot: homeTeam.name,
      home_team_abbrev: homeTeam.abbreviation,
      home_team_name_alt: null,
      home_team_spread: null,
      game_spread: null,
      home_favorite: null,
      game_spread_available: null,
      game_id: gameId,
      qtr,
      time: clockVal,
      clock_minutes: clockMin,
      clock_seconds: clockSec,
      half,
      game_half: half,
      lead_qtr: nextQtr != null ? parseInt(nextQtr, 10) : null,
      lead_game_half: nextHalf,
      start_quarter_seconds_remaining: startQuarterSec,
      start_half_seconds_remaining: startHalfSec,
      start_game_seconds_remaining: startGameSec,
      game_play_number: i + 1,
      end_quarter_seconds_remaining: endQuarterSec,
      end_half_seconds_remaining: endHalfSec,
      end_game_seconds_remaining: endGameSec,
      period: qtr,
      lag_qtr: prevQtr != null ? parseInt(prevQtr, 10) : null,
      lag_game_half: prevHalf,
      coordinate_x: coordX,
      coordinate_y: coordY,
      game_date: gameDate,
      game_date_time: gameDateTime,
      type_abbreviation: null,
      home_timeout_called: homeTimeout,
      away_timeout_called: awayTimeout,
    });
  }

  return rows;
}

/**
 * Parse schedule update from game summary (for updating schedules table with final results)
 * @param {Object} json - ESPN game summary JSON
 * @returns {Object|null} Object with fields to update in schedules table, or null
 */
export function parseScheduleFromSummary(json) {
  const header = json.header;
  const competitions = header?.competitions?.[0];
  if (!competitions) return null;

  const competitors = competitions.competitors || [];
  const homeComp = competitors.find((c) => c.homeAway === 'home');
  const awayComp = competitors.find((c) => c.homeAway === 'away');
  if (!homeComp || !awayComp) return null;

  const status = competitions.status?.type || {};
  const dateStr = competitions.date || '';
  const gameDate = dateStr.slice(0, 10);
  const gameDateTime = dateStr ? new Date(dateStr).toISOString() : null;

  const homeTeam = homeComp.team || {};
  const awayTeam = awayComp.team || {};
  const gameInfo = json.gameInfo || {};
  const attendance =
    gameInfo.attendance != null ? parseInt(gameInfo.attendance, 10) : null;

  return {
    game_id: parseInt(header.id, 10),
    game_date: gameDate,
    game_date_time: gameDateTime,
    status_type_id: status.id != null ? parseInt(status.id, 10) : null,
    status_type_name: status.name || null,
    status_type_state: status.state || null,
    status_type_completed: !!status.completed,
    status_type_description: status.description || null,
    status_type_detail: status.detail || null,
    status_type_short_detail: status.shortDetail || null,
    home_id: homeTeam.id != null ? parseInt(homeTeam.id, 10) : null,
    home_uid: homeTeam.uid || null,
    home_location: homeTeam.location || null,
    home_name: homeTeam.name || null,
    home_abbreviation: homeTeam.abbreviation || null,
    home_display_name: homeTeam.displayName || null,
    home_short_display_name: homeTeam.shortDisplayName || null,
    home_color: homeTeam.color || null,
    home_alternate_color: homeTeam.alternateColor || null,
    home_logo: homeTeam.logo || null,
    home_score: homeComp.score != null ? parseInt(homeComp.score, 10) : null,
    home_winner: !!homeComp.winner,
    away_id: awayTeam.id != null ? parseInt(awayTeam.id, 10) : null,
    away_uid: awayTeam.uid || null,
    away_location: awayTeam.location || null,
    away_name: awayTeam.name || null,
    away_abbreviation: awayTeam.abbreviation || null,
    away_display_name: awayTeam.displayName || null,
    away_short_display_name: awayTeam.shortDisplayName || null,
    away_color: awayTeam.color || null,
    away_alternate_color: awayTeam.alternateColor || null,
    away_logo: awayTeam.logo || null,
    away_score: awayComp.score != null ? parseInt(awayComp.score, 10) : null,
    away_winner: !!awayComp.winner,
    season: header.season?.year != null ? parseInt(header.season.year, 10) : null,
    season_type: header.season?.type != null ? parseInt(header.season.type, 10) : null,
    PBP: 'true',
    play_by_play_available: true,
    attendance: !isNaN(attendance) ? attendance : null,
  };
}

/**
 * Parse team box scores
 * @param {Object} json - ESPN game summary JSON
 * @returns {Array|null} Rows for team_boxscores_raw
 */
export function parseTeamBox(json) {
  const header = json.header;
  const competitions = header?.competitions?.[0];
  if (!competitions?.boxscoreAvailable) return null;

  const teams = json.boxscore?.teams;
  if (!teams || teams.length < 2) return null;

  const gameId = parseInt(header.id, 10);
  const season = header.season?.year;
  const seasonType = header.season?.type;
  const dateStr = competitions.date || '';
  const gameDate = dateStr.slice(0, 10);
  const gameDateTime = dateStr ? new Date(dateStr).toISOString() : null;

  const competitors = competitions.competitors || [];
  const comp1 = competitors[0];
  const comp2 = competitors[1];

  const rows = [];
  for (let t = 0; t < teams.length; t++) {
    const teamData = teams[t];
    const team = teamData.team || {};
    const stats = teamData.statistics || [];
    const parseStatVal = (v) => {
      if (v == null || v === '' || /^[-]+$/.test(String(v)) || String(v).toUpperCase() === 'DNP') return null;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    const statMap = {};
    for (const s of stats) {
      const name = s.name;
      const val = s.displayValue;
      if (name === 'fieldGoalsMade-fieldGoalsAttempted' && typeof val === 'string') {
        if (/^[-]+$/.test(val) || val.toUpperCase() === 'DNP') {
          statMap.field_goals_made = null;
          statMap.field_goals_attempted = null;
        } else {
          const [a, b] = val.split('-');
          statMap.field_goals_made = parseStatVal(a);
          statMap.field_goals_attempted = parseStatVal(b);
        }
      } else if (name === 'freeThrowsMade-freeThrowsAttempted' && typeof val === 'string') {
        if (/^[-]+$/.test(val) || val.toUpperCase() === 'DNP') {
          statMap.free_throws_made = null;
          statMap.free_throws_attempted = null;
        } else {
          const [a, b] = val.split('-');
          statMap.free_throws_made = parseStatVal(a);
          statMap.free_throws_attempted = parseStatVal(b);
        }
      } else if (
        name === 'threePointFieldGoalsMade-threePointFieldGoalsAttempted' &&
        typeof val === 'string'
      ) {
        if (/^[-]+$/.test(val) || val.toUpperCase() === 'DNP') {
          statMap.three_point_field_goals_made = null;
          statMap.three_point_field_goals_attempted = null;
        } else {
          const [a, b] = val.split('-');
          statMap.three_point_field_goals_made = parseStatVal(a);
          statMap.three_point_field_goals_attempted = parseStatVal(b);
        }
      } else {
        const snake = toSnakeCase(name);
        if (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val)) {
          statMap[snake] = parseFloat(val);
        } else if (typeof val === 'string' && /^\d+$/.test(val)) {
          statMap[snake] = parseInt(val, 10);
        } else {
          statMap[snake] = parseStatVal(val);
        }
      }
    }

    const teamId = parseInt(team.id || teamData.id || 0, 10);
    const isFirst = parseInt(teamData.team?.id || teamData.id, 10) === parseInt(comp1?.id, 10);
    const oppComp = isFirst ? comp2 : comp1;
    const oppTeam = oppComp?.team || {};
    const oppId = parseInt(oppComp?.id || 0, 10);
    const teamScore = isFirst ? parseInt(comp1?.score, 10) : parseInt(comp2?.score, 10);
    const oppScore = isFirst ? parseInt(comp2?.score, 10) : parseInt(comp1?.score, 10);
    const teamWinner = isFirst ? comp1?.winner : comp2?.winner;
    const homeAway = teamData.homeAway || (isFirst ? comp1?.homeAway : comp2?.homeAway);

    rows.push({
      game_id: gameId,
      season,
      season_type: seasonType,
      game_date: gameDate,
      game_date_time: gameDateTime,
      team_id: teamId,
      team_uid: team.uid || null,
      team_slug: team.slug || null,
      team_location: team.location || null,
      team_name: team.name || null,
      team_abbreviation: team.abbreviation || null,
      team_display_name: team.displayName || null,
      team_short_display_name: team.shortDisplayName || null,
      team_color: team.color || null,
      team_alternate_color: team.alternateColor || null,
      team_logo: team.logo || (team.logos?.[0]?.href) || null,
      team_home_away: homeAway,
      team_score: teamScore,
      team_winner: !!teamWinner,
      assists: statMap.assists ?? null,
      blocks: statMap.blocks ?? null,
      defensive_rebounds: statMap.defensive_rebounds ?? statMap.defensiverebounds ?? null,
      disqualifications: null,
      ejections: null,
      fast_break_points: statMap.fast_break_points ?? statMap.fastbreakpoints ?? null,
      field_goal_pct: statMap.field_goal_pct ?? statMap.fieldgoalpct ?? null,
      field_goals_made: statMap.field_goals_made ?? null,
      field_goals_attempted: statMap.field_goals_attempted ?? null,
      flagrant_fouls: statMap.flagrant_fouls ?? statMap.flagrantfouls ?? null,
      fouls: statMap.fouls ?? null,
      free_throw_pct: statMap.free_throw_pct ?? statMap.freethrowpct ?? null,
      free_throws_made: statMap.free_throws_made ?? null,
      free_throws_attempted: statMap.free_throws_attempted ?? null,
      largest_lead: statMap.largest_lead ?? statMap.largestlead ?? null,
      lead_changes: null,
      lead_percentage: null,
      offensive_rebounds: statMap.offensive_rebounds ?? statMap.offensiverebounds ?? null,
      points_in_paint: statMap.points_in_paint ?? statMap.pointsinpaint ?? null,
      steals: statMap.steals ?? null,
      team_turnovers: statMap.team_turnovers ?? statMap.teamturnovers ?? null,
      technical_fouls: statMap.technical_fouls ?? statMap.technicalfouls ?? null,
      three_point_field_goal_pct:
        statMap.three_point_field_goal_pct ?? statMap.threepointfieldgoalpct ?? null,
      three_point_field_goals_made: statMap.three_point_field_goals_made ?? null,
      three_point_field_goals_attempted: statMap.three_point_field_goals_attempted ?? null,
      times_tied: null,
      total_rebounds: statMap.total_rebounds ?? statMap.totalrebounds ?? null,
      total_technical_fouls:
        statMap.total_technical_fouls ?? statMap.totaltechnicalfouls ?? null,
      total_turnovers: statMap.total_turnovers ?? statMap.totalturnovers ?? null,
      turnover_points: statMap.turnover_points ?? statMap.turnoverpoints ?? null,
      turnovers: statMap.turnovers ?? null,
      opponent_team_id: oppId,
      opponent_team_uid: oppTeam.uid || null,
      opponent_team_slug: oppTeam.slug || null,
      opponent_team_location: oppTeam.location || null,
      opponent_team_name: oppTeam.name || null,
      opponent_team_abbreviation: oppTeam.abbreviation || null,
      opponent_team_display_name: oppTeam.displayName || null,
      opponent_team_short_display_name: oppTeam.shortDisplayName || null,
      opponent_team_color: oppTeam.color || null,
      opponent_team_alternate_color: oppTeam.alternateColor || null,
      opponent_team_logo: oppTeam.logos?.[0]?.href || oppTeam.logo || null,
      opponent_team_score: oppScore,
    });
  }

  return rows;
}

/**
 * Parse player box scores
 * @param {Object} json - ESPN game summary JSON
 * @returns {Array|null} Rows for player_boxscores_raw
 */
export function parsePlayerBox(json) {
  const header = json.header;
  const competitions = header?.competitions?.[0];
  if (!competitions?.boxscoreAvailable) return null;

  const playersData = json.boxscore?.players;
  if (!playersData || playersData.length === 0) return null;

  const gameId = parseInt(header.id, 10);
  const season = header.season?.year;
  const seasonType = header.season?.type;
  const dateStr = competitions.date || '';
  const gameDate = dateStr.slice(0, 10);
  const gameDateTime = dateStr ? new Date(dateStr).toISOString() : null;

  const competitors = competitions.competitors || [];
  const comp1 = competitors[0];
  const comp2 = competitors[1];

  const rows = [];
  for (const teamGroup of playersData) {
    const team = teamGroup.team || {};
    const statsGroups = teamGroup.statistics || [];
    if (statsGroups.length === 0) continue;

    const mainStats = statsGroups[0];
    const keys = mainStats.keys || [];
    const athletes = mainStats.athletes || [];

    for (const a of athletes) {
      const athlete = a.athlete || {};
      const statsArr = a.stats || [];
      const statObj = {};
      const parseNum = (s) => {
        if (s == null || s === '' || /^[-]+$/.test(s) || String(s).toUpperCase() === 'DNP') return null;
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : null;
      };
      keys.forEach((k, i) => {
        const v = statsArr[i];
        if (v === undefined || v === null) return;
        const snake = toSnakeCase(k);
        if (k === 'fieldGoalsMade-fieldGoalsAttempted' && typeof v === 'string') {
          if (/^[-]+$/.test(v) || v.toUpperCase() === 'DNP') {
            statObj.field_goals_made = null;
            statObj.field_goals_attempted = null;
          } else {
            const [x, y] = v.split('-');
            statObj.field_goals_made = parseNum(x);
            statObj.field_goals_attempted = parseNum(y);
          }
        } else if (
          k === 'threePointFieldGoalsMade-threePointFieldGoalsAttempted' &&
          typeof v === 'string'
        ) {
          if (/^[-]+$/.test(v) || v.toUpperCase() === 'DNP') {
            statObj.three_point_field_goals_made = null;
            statObj.three_point_field_goals_attempted = null;
          } else {
            const [x, y] = v.split('-');
            statObj.three_point_field_goals_made = parseNum(x);
            statObj.three_point_field_goals_attempted = parseNum(y);
          }
        } else if (k === 'freeThrowsMade-freeThrowsAttempted' && typeof v === 'string') {
          if (/^[-]+$/.test(v) || v.toUpperCase() === 'DNP') {
            statObj.free_throws_made = null;
            statObj.free_throws_attempted = null;
          } else {
            const [x, y] = v.split('-');
            statObj.free_throws_made = parseNum(x);
            statObj.free_throws_attempted = parseNum(y);
          }
        } else if (typeof v === 'string' && /^[+-]?\d+$/.test(v)) {
          statObj[snake] = parseInt(v, 10);
        } else if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) {
          statObj[snake] = parseFloat(v);
        } else {
          statObj[snake] = parseNum(v);
        }
      });

      const teamId = parseInt(team.id || 0, 10);
      const isFirst = teamId === parseInt(comp1?.id, 10);
      const oppComp = isFirst ? comp2 : comp1;
      const oppTeam = oppComp?.team || {};

      rows.push({
        game_id: gameId,
        season,
        season_type: seasonType,
        game_date: gameDate,
        game_date_time: gameDateTime,
        athlete_id: parseInt(athlete.id || 0, 10),
        athlete_display_name: athlete.displayName || null,
        team_id: teamId,
        team_name: team.name || null,
        team_location: team.location || null,
        team_short_display_name: team.shortDisplayName || null,
        minutes: statObj.minutes ?? null,
        field_goals_made: statObj.field_goals_made ?? null,
        field_goals_attempted: statObj.field_goals_attempted ?? null,
        three_point_field_goals_made: statObj.three_point_field_goals_made ?? null,
        three_point_field_goals_attempted: statObj.three_point_field_goals_attempted ?? null,
        free_throws_made: statObj.free_throws_made ?? null,
        free_throws_attempted: statObj.free_throws_attempted ?? null,
        offensive_rebounds: statObj.offensive_rebounds ?? statObj.offensiverebounds ?? null,
        defensive_rebounds: statObj.defensive_rebounds ?? statObj.defensiverebounds ?? null,
        rebounds: statObj.rebounds ?? null,
        assists: statObj.assists ?? null,
        steals: statObj.steals ?? null,
        blocks: statObj.blocks ?? null,
        turnovers: statObj.turnovers ?? null,
        fouls: statObj.fouls ?? null,
        plus_minus: statObj.plus_minus ?? statObj.plusminus ?? null,
        points: statObj.points ?? null,
        starter: !!a.starter,
        ejected: !!a.ejected,
        did_not_play: !!a.didNotPlay,
        reason: a.reason || null,
        active: a.active != null ? !!a.active : null,
        athlete_jersey: athlete.jersey || null,
        athlete_short_name: athlete.shortName || null,
        athlete_headshot_href: athlete.headshot?.href || null,
        athlete_position_name: athlete.position?.name || null,
        athlete_position_abbreviation: athlete.position?.abbreviation || null,
        team_display_name: team.displayName || null,
        team_uid: team.uid || null,
        team_slug: team.slug || null,
        team_logo: team.logo || (team.logos?.[0]?.href) || null,
        team_abbreviation: team.abbreviation || null,
        team_color: team.color || null,
        team_alternate_color: team.alternateColor || null,
        home_away: comp1?.id === String(teamId) ? comp1.homeAway : comp2?.homeAway,
        team_winner: comp1?.id === String(teamId) ? comp1.winner : comp2?.winner,
        team_score: comp1?.id === String(teamId) ? parseInt(comp1.score, 10) : parseInt(comp2.score, 10),
        opponent_team_id: parseInt(oppComp?.id || 0, 10),
        opponent_team_name: oppTeam.name || null,
        opponent_team_location: oppTeam.location || null,
        opponent_team_display_name: oppTeam.displayName || null,
        opponent_team_abbreviation: oppTeam.abbreviation || null,
        opponent_team_logo: oppTeam.logos?.[0]?.href || oppTeam.logo || null,
        opponent_team_color: oppTeam.color || null,
        opponent_team_alternate_color: oppTeam.alternateColor || null,
        opponent_team_score: parseInt(oppComp?.score || 0, 10),
      });
    }
  }

  return rows;
}
