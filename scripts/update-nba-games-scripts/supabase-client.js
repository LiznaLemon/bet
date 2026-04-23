/**
 * Supabase client and database helpers for NBA data upsert
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Get the most recent game_date from play_by_play_raw (for default --from)
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string|null>} YYYY-MM-DD or null
 */
export async function getLastGameDate(supabase) {
  const { data, error } = await supabase
    .from('play_by_play_raw')
    .select('game_date')
    .order('game_date', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const raw = data[0].game_date;
  if (raw == null) return null;
  // Normalize to YYYY-MM-DD (Supabase may return ISO string like "2025-03-15T00:00:00.000Z")
  const str = String(raw);
  return str.slice(0, 10);
}

/**
 * Latest calendar game_date present across play-by-play and boxscore raw tables.
 * Used to choose the start of an incremental sync.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string|null>} YYYY-MM-DD or null if all are empty
 */
export async function getLastUpdatedGameDate(supabase) {
  const tables = ['play_by_play_raw', 'player_boxscores_raw', 'team_boxscores_raw'];
  const candidates = [];
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('game_date')
      .order('game_date', { ascending: false })
      .limit(1);
    if (error || !data?.length) continue;
    const raw = data[0].game_date;
    if (raw == null) continue;
    candidates.push(String(raw).slice(0, 10));
  }
  if (candidates.length === 0) return null;
  return candidates.sort().at(-1);
}

/**
 * Read latest game_date_time watermark per table.
 * Returns ISO timestamp strings (or null when table has no rows).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Record<string, string|null>>}
 */
export async function getTableUpdateWatermarks(supabase) {
  const tables = ['play_by_play_raw', 'player_boxscores_raw', 'team_boxscores_raw', 'schedules'];
  const watermarks = {};

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('game_date_time')
      .order('game_date_time', { ascending: false })
      .limit(1);

    if (error || !data?.length || data[0].game_date_time == null) {
      watermarks[table] = null;
      continue;
    }

    watermarks[table] = String(data[0].game_date_time);
  }

  return watermarks;
}

/**
 * Create Supabase client from env
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
export function getSupabaseClient() {
  const url = process.env.SUPABASE_API_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Columns to update on schedules - status, score, PBP availability, attendance (preserve logo, team metadata, etc.) */
const SCHEDULE_UPDATE_COLUMNS = [
  'status_type_id',
  'status_type_name',
  'status_type_state',
  'status_type_completed',
  'status_type_description',
  'status_type_detail',
  'status_type_short_detail',
  'home_score',
  'away_score',
  'home_winner',
  'away_winner',
  'PBP',
  'play_by_play_available',
  'attendance',
  'season',
  'season_type',
];

const SCHEDULE_TEAM_IDENTITY_COLUMNS = [
  'home_id',
  'home_uid',
  'home_location',
  'home_name',
  'home_abbreviation',
  'home_display_name',
  'home_short_display_name',
  'home_color',
  'home_alternate_color',
  'home_is_active',
  'home_venue_id',
  'home_logo',
  'away_id',
  'away_uid',
  'away_location',
  'away_name',
  'away_abbreviation',
  'away_display_name',
  'away_short_display_name',
  'away_color',
  'away_alternate_color',
  'away_is_active',
  'away_venue_id',
  'away_logo',
];

function isPlaceholderTeamValue(value) {
  if (value == null) return true;
  if (typeof value === 'number') return false;
  const normalized = String(value).trim();
  if (!normalized) return true;
  return normalized.toUpperCase() === 'TBD';
}

function hasResolvedTeam(row, side) {
  return (
    !isPlaceholderTeamValue(row?.[`${side}_id`]) &&
    !isPlaceholderTeamValue(row?.[`${side}_abbreviation`]) &&
    !isPlaceholderTeamValue(row?.[`${side}_display_name`])
  );
}

function needsTeamRepair(existingRow, incomingRow, side) {
  const existingResolved = hasResolvedTeam(existingRow, side);
  const incomingResolved = hasResolvedTeam(incomingRow, side);

  if (!incomingResolved) return false;
  if (!existingResolved) return true;

  const existingId = existingRow?.[`${side}_id`];
  const incomingId = incomingRow?.[`${side}_id`];
  if (existingId != null && incomingId != null && Number(existingId) !== Number(incomingId)) {
    return true;
  }

  const existingAbbrev = existingRow?.[`${side}_abbreviation`];
  const incomingAbbrev = incomingRow?.[`${side}_abbreviation`];
  if (
    existingAbbrev != null &&
    incomingAbbrev != null &&
    String(existingAbbrev).trim().toUpperCase() !== String(incomingAbbrev).trim().toUpperCase()
  ) {
    return true;
  }

  return false;
}

function buildTeamIdentityUpdate(existingRow, incomingRow) {
  const needsHomeRepair = needsTeamRepair(existingRow, incomingRow, 'home');
  const needsAwayRepair = needsTeamRepair(existingRow, incomingRow, 'away');
  if (!needsHomeRepair && !needsAwayRepair) return null;

  const updateFields = {};
  for (const col of SCHEDULE_TEAM_IDENTITY_COLUMNS) {
    if (!(col in incomingRow)) continue;
    if (col.startsWith('home_') && !needsHomeRepair) continue;
    if (col.startsWith('away_') && !needsAwayRepair) continue;
    updateFields[col] = incomingRow[col];
  }
  return Object.keys(updateFields).length > 0 ? updateFields : null;
}

/**
 * Update schedules table with final results for a completed game.
 * Only updates status and score columns to avoid overwriting existing data (e.g. home_logo).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} gameId
 * @param {Object} scheduleRow - Parsed schedule fields (from parseScheduleFromSummary)
 */
export async function updateSchedule(supabase, gameId, scheduleRow) {
  if (!scheduleRow) return;
  const updateFields = {};
  for (const col of SCHEDULE_UPDATE_COLUMNS) {
    if (!(col in scheduleRow)) continue;
    const val = scheduleRow[col];
    if (col === 'attendance' && (val == null || val === '')) continue;
    updateFields[col] = val;
  }
  if (Object.keys(updateFields).length === 0) return;
  const { error } = await supabase.from('schedules').update(updateFields).eq('game_id', gameId);
  if (error) {
    throw new Error(`Failed to update schedule for game ${gameId}: ${error.message}`);
  }
}

/**
 * Insert schedule rows that do not exist yet (by game_id).
 * Existing rows are left untouched to avoid clobbering richer metadata.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<Object>} scheduleRows
 * @returns {Promise<{inserted: number, skippedExisting: number}>}
 */
export async function insertMissingSchedules(supabase, scheduleRows) {
  if (!Array.isArray(scheduleRows) || scheduleRows.length === 0) {
    return { inserted: 0, skippedExisting: 0 };
  }

  const dedupedByGameId = new Map();
  for (const row of scheduleRows) {
    const gameId = row?.game_id;
    if (!gameId) continue;
    if (!dedupedByGameId.has(gameId)) {
      dedupedByGameId.set(gameId, row);
    }
  }

  const rows = Array.from(dedupedByGameId.values());
  if (rows.length === 0) {
    return { inserted: 0, skippedExisting: 0 };
  }

  const gameIds = rows.map((r) => r.game_id);
  const existingIds = new Set();
  const ID_CHUNK_SIZE = 200;
  for (let i = 0; i < gameIds.length; i += ID_CHUNK_SIZE) {
    const chunk = gameIds.slice(i, i + ID_CHUNK_SIZE);
    const { data, error } = await supabase.from('schedules').select('game_id').in('game_id', chunk);
    if (error) {
      throw new Error(`Failed to check existing schedules: ${error.message}`);
    }
    for (const row of data || []) {
      existingIds.add(row.game_id);
    }
  }

  const missingRows = rows.filter((row) => !existingIds.has(row.game_id));
  if (missingRows.length === 0) {
    return { inserted: 0, skippedExisting: rows.length };
  }

  const INSERT_BATCH_SIZE = 200;
  for (let i = 0; i < missingRows.length; i += INSERT_BATCH_SIZE) {
    const batch = missingRows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from('schedules').insert(batch);
    if (error) {
      throw new Error(`Failed to insert missing schedules: ${error.message}`);
    }
  }

  return { inserted: missingRows.length, skippedExisting: rows.length - missingRows.length };
}

/**
 * Refresh team identity fields on existing schedule rows when scoreboard placeholders resolve.
 * This is intended for near-term playoff/play-in rows that may initially be seeded with TBD teams.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<Object>} scheduleRows
 * @returns {Promise<{repaired: number, checkedExisting: number, unresolvedIds: number[], repairedIds: number[]}>}
 */
export async function refreshScheduleTeams(supabase, scheduleRows) {
  if (!Array.isArray(scheduleRows) || scheduleRows.length === 0) {
    return { repaired: 0, checkedExisting: 0, unresolvedIds: [], repairedIds: [] };
  }

  const dedupedByGameId = new Map();
  for (const row of scheduleRows) {
    const gameId = Number(row?.game_id);
    if (!Number.isFinite(gameId)) continue;
    dedupedByGameId.set(gameId, row);
  }

  const gameIds = Array.from(dedupedByGameId.keys());
  if (gameIds.length === 0) {
    return { repaired: 0, checkedExisting: 0, unresolvedIds: [], repairedIds: [] };
  }

  const existingRows = [];
  const CHUNK_SIZE = 200;
  for (let i = 0; i < gameIds.length; i += CHUNK_SIZE) {
    const chunk = gameIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('schedules')
      .select(['game_id', ...SCHEDULE_TEAM_IDENTITY_COLUMNS].join(', '))
      .in('game_id', chunk);
    if (error) {
      throw new Error(`Failed to read schedules for team refresh: ${error.message}`);
    }
    existingRows.push(...(data || []));
  }

  const existingByGameId = new Map(existingRows.map((row) => [Number(row.game_id), row]));
  const unresolvedIds = [];
  const repairedIds = [];

  for (const gameId of gameIds) {
    const existingRow = existingByGameId.get(gameId);
    if (!existingRow) continue;

    const incomingRow = dedupedByGameId.get(gameId);
    const updateFields = buildTeamIdentityUpdate(existingRow, incomingRow);
    if (!updateFields) continue;

    const { error } = await supabase.from('schedules').update(updateFields).eq('game_id', gameId);
    if (error) {
      throw new Error(`Failed to refresh schedule teams for game ${gameId}: ${error.message}`);
    }

    repairedIds.push(gameId);

    const combinedRow = { ...existingRow, ...updateFields };
    if (!hasResolvedTeam(combinedRow, 'home') || !hasResolvedTeam(combinedRow, 'away')) {
      unresolvedIds.push(gameId);
    }
  }

  return {
    repaired: repairedIds.length,
    checkedExisting: existingRows.length,
    unresolvedIds,
    repairedIds,
  };
}

/**
 * Delete existing rows for a game and insert new ones (delete-then-insert strategy)
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table - Table name
 * @param {string} idColumn - Column name for game_id (e.g. 'game_id')
 * @param {number} gameId
 * @param {Array<Object>} rows - Rows to insert
 */
export async function upsertGameData(supabase, table, idColumn, gameId, rows) {
  if (!rows || rows.length === 0) return;

  const { error: delError } = await supabase.from(table).delete().eq(idColumn, gameId);

  if (delError) {
    throw new Error(`Failed to delete from ${table} for game ${gameId}: ${delError.message}`);
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error: insError } = await supabase.from(table).insert(batch);

    if (insError) {
      throw new Error(`Failed to insert into ${table} for game ${gameId}: ${insError.message}`);
    }
  }
}

/**
 * Return subset of game IDs that exist in schedules.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number[]} gameIds
 * @returns {Promise<Set<number>>}
 */
export async function getExistingScheduleIds(supabase, gameIds) {
  const existingIds = new Set();
  if (!Array.isArray(gameIds) || gameIds.length === 0) return existingIds;

  const CHUNK_SIZE = 200;
  for (let i = 0; i < gameIds.length; i += CHUNK_SIZE) {
    const chunk = gameIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase.from('schedules').select('game_id').in('game_id', chunk);
    if (error) throw new Error(`Failed to read schedule IDs: ${error.message}`);
    for (const row of data || []) {
      if (row?.game_id != null) existingIds.add(Number(row.game_id));
    }
  }
  return existingIds;
}

/**
 * Report schedule rows in a date window that still have placeholder teams.
 * Useful as a validation step after scoreboard reconciliation.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Array<{game_id: number, game_date: string, home_abbreviation: string|null, away_abbreviation: string|null}>>}
 */
export async function getPlaceholderSchedulesInRange(supabase, startDate, endDate) {
  const { data, error } = await supabase
    .from('schedules')
    .select('game_id, game_date, home_abbreviation, away_abbreviation')
    .gte('game_date', startDate)
    .lte('game_date', endDate)
    .or('home_abbreviation.is.null,home_abbreviation.eq.TBD,away_abbreviation.is.null,away_abbreviation.eq.TBD')
    .order('game_date', { ascending: true })
    .order('game_id', { ascending: true });

  if (error) {
    throw new Error(`Failed to read placeholder schedules: ${error.message}`);
  }

  return data || [];
}

/**
 * Upsert pipeline state row (best effort).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{pipeline_name: string, active_mode: string, active_season: number|null, metadata?: object}} state
 */
export async function upsertPipelineState(supabase, state) {
  const { error } = await supabase.from('pipeline_state').upsert(state, { onConflict: 'pipeline_name' });
  if (error) {
    throw new Error(`Failed to upsert pipeline_state: ${error.message}`);
  }
}

/**
 * Insert per-run audit record (best effort).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} runRecord
 */
export async function insertPipelineRunAudit(supabase, runRecord) {
  const { error } = await supabase.from('pipeline_run_audit').insert(runRecord);
  if (error) {
    throw new Error(`Failed to insert pipeline_run_audit: ${error.message}`);
  }
}
