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
 * Create Supabase client from env
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
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
];

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
