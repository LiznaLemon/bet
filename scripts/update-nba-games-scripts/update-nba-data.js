#!/usr/bin/env node
/**
 * NBA Data Update Script
 * Fetches play-by-play, player boxscores, and team boxscores from ESPN API
 * and upserts into Supabase.
 *
 * Usage:
 *   node update-nba-data.js [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--mode auto|playoff|regular|offseason] [--dry-run]
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { fetchScoreboardAllEvents, fetchGameSummary } from './espn-api.js';
import {
  parsePlayByPlay,
  parsePlayerBox,
  parseScheduleFromScoreboardEvent,
  parseScheduleFromSummary,
  parseTeamBox,
} from './parsers.js';
import {
  getSupabaseClient,
  getExistingScheduleIds,
  getPlaceholderSchedulesInRange,
  getTableUpdateWatermarks,
  insertPipelineRunAudit,
  insertMissingSchedules,
  refreshScheduleTeams,
  upsertPipelineState,
  updateSchedule,
  upsertGameData,
} from './supabase-client.js';

function todayISO() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function isoDateFromTimestamp(ts) {
  return String(ts).slice(0, 10);
}

function parseIsoDateAsUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function printTableWatermarks(watermarks) {
  const entries = Object.entries(watermarks);
  if (entries.length === 0) return;

  const present = entries.filter(([, ts]) => !!ts);
  const oldest = present.length
    ? present.slice().sort((a, b) => String(a[1]).localeCompare(String(b[1])))[0]
    : null;

  console.log('📌 Table watermarks (latest game_date_time):');
  for (const [table, ts] of entries) {
    const mark = oldest && oldest[0] === table ? ' <- lagging' : '';
    console.log(`   - ${table}: ${ts ?? '(no rows)'}${mark}`);
  }
}

function parseArgs(argv) {
  const out = {
    from: null,
    to: null,
    dryRun: false,
    mode: 'auto',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from' && argv[i + 1]) {
      out.from = argv[++i];
      continue;
    }
    if (a === '--to' && argv[i + 1]) {
      out.to = argv[++i];
      continue;
    }
    if (a === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (a === '--mode' && argv[i + 1]) {
      const mode = String(argv[++i]).toLowerCase();
      if (['auto', 'playoff', 'regular', 'offseason'].includes(mode)) {
        out.mode = mode;
      }
      continue;
    }
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildDateRange(startISO, endISO) {
  const out = [];
  let current = parseIsoDateAsUTC(startISO);
  const end = parseIsoDateAsUTC(endISO);
  while (current <= end) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    const day = String(current.getUTCDate()).padStart(2, '0');
    out.push(`${year}-${month}-${day}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return out;
}

function toYmd(iso) {
  return iso.replace(/-/g, '');
}

function getReconcileWindowByMode(mode) {
  if (mode === 'playoff') return { pastDays: 2, futureDays: 7 };
  if (mode === 'regular') return { pastDays: 2, futureDays: 3 };
  return { pastDays: 2, futureDays: 30 };
}

function inferModeFromEvents(events) {
  const seasonTypes = new Set(
    events.map((ev) => Number(ev?.season?.type)).filter((value) => Number.isFinite(value))
  );
  if (seasonTypes.has(3) || seasonTypes.has(5)) return 'playoff';
  if (seasonTypes.has(1) || seasonTypes.has(2)) return 'regular';
  return 'offseason';
}

async function collectEventsByDates(dateList) {
  const byDate = new Map();
  const failures = [];
  for (const iso of dateList) {
    try {
      const events = await fetchScoreboardAllEvents(toYmd(iso));
      byDate.set(iso, events);
    } catch (error) {
      failures.push({ date: iso, error: error.message });
      byDate.set(iso, []);
    }
  }
  return { byDate, failures };
}

function isFinalEvent(ev) {
  const status = ev?.status?.type || ev?.competitions?.[0]?.status?.type;
  return status?.name === 'STATUS_FINAL' || status?.completed === true;
}

/** Final games only: ESPN summary has reliable box scores and (when available) PBP. */
async function processFinalGame(gameId, { supabase, willWriteDb }) {
  const summary = await fetchGameSummary(gameId);
  const pbpRows = parsePlayByPlay(summary);
  const teamRows = parseTeamBox(summary);
  const playerRows = parsePlayerBox(summary);
  const schedule = parseScheduleFromSummary(summary);

  if (willWriteDb && supabase) {
    if (pbpRows?.length) {
      await upsertGameData(supabase, 'play_by_play_raw', 'game_id', gameId, pbpRows);
    }
    if (teamRows?.length) {
      await upsertGameData(supabase, 'team_boxscores_raw', 'game_id', gameId, teamRows);
    }
    if (playerRows?.length) {
      await upsertGameData(supabase, 'player_boxscores_raw', 'game_id', gameId, playerRows);
    }
    if (schedule) {
      await updateSchedule(supabase, gameId, schedule);
    }
  }
}

async function persistRunMetadata({ supabase, willWriteDb, state, audit }) {
  if (!willWriteDb || !supabase) return;
  try {
    await upsertPipelineState(supabase, state);
    await insertPipelineRunAudit(supabase, audit);
  } catch (error) {
    // Keep ingestion non-blocking if metadata tables are not deployed yet.
    console.warn(`⚠️ Failed to persist pipeline metadata: ${error.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const willWriteDb = !args.dryRun;
  const runId = randomUUID();

  const supabase = getSupabaseClient();
  if (willWriteDb && !supabase) {
    console.error('❌ Missing Supabase env: SUPABASE_API_URL and SUPABASE_SERVICE_ROLE_KEY are required for DB writes.');
    process.exit(1);
  }

  const today = todayISO();
  const toDate = args.to ?? today;
  let fromDate = args.from; // Start with user-provided from date if exists
  let watermarks = null;
  let activeMode = args.mode;
  let activeSeason = null;
  const scoreboardFailures = [];
  let reconciliationFailures = [];
  let missingAfterRepair = [];
  let repairAttempted = false;
  let repairInserted = 0;
  let repairSkippedExisting = 0;
  let teamRepairsApplied = 0;
  let teamRepairGameIds = [];
  let unresolvedTeamPlaceholderIds = [];
  let placeholderRowsAfterValidation = [];

  if (supabase) {
    watermarks = await getTableUpdateWatermarks(supabase);
    printTableWatermarks(watermarks);
  }

  if (activeMode === 'auto') {
    const probeDates = buildDateRange(addDaysISO(today, -1), addDaysISO(today, 2));
    const probe = await collectEventsByDates(probeDates);
    const probeEvents = Array.from(probe.byDate.values()).flat();
    activeMode = inferModeFromEvents(probeEvents);
    activeSeason =
      probeEvents
        .map((ev) => Number(ev?.season?.year))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => b - a)[0] ?? null;
    if (probe.failures.length > 0) {
      scoreboardFailures.push(...probe.failures.map((item) => ({ ...item, phase: 'mode_probe' })));
    }
  }
  console.log(`ℹ️ Pipeline mode: ${activeMode}`);

  // Only use watermark logic if user did NOT provide a --from flag
  if (!fromDate) {
    if (watermarks) {
      const present = Object.entries(watermarks).filter(([, ts]) => !!ts);
      if (present.length > 0) {
        const oldest = present.sort((a, b) => String(a[1]).localeCompare(String(b[1])))[0];
        fromDate = isoDateFromTimestamp(oldest[1]);
        console.log(`ℹ️ No --from provided. Using oldest table watermark: ${oldest[0]} @ ${oldest[1]}`);
      }
    }
    // If still no fromDate, fall back to 7 days ago
    if (!fromDate) {
      const defaultPastDays = activeMode === 'playoff' ? 3 : activeMode === 'regular' ? 7 : 30;
      fromDate = addDaysISO(toDate, -defaultPastDays);
      console.log(`ℹ️ No watermark found. Using default: last ${defaultPastDays} days (from ${fromDate})`);
    }
  } else {
    console.log(`ℹ️ Using user-provided --from date: ${fromDate}`);
  }

  console.log(`📅 Date range calculated:`);
  console.log(`   From: ${fromDate}`);
  console.log(`   To: ${toDate}`);
  console.log(`   Start date object: ${parseIsoDateAsUTC(fromDate).toISOString()}`);
  console.log(`   End date object: ${parseIsoDateAsUTC(toDate).toISOString()}`);

  // Convert to Date objects for proper comparison
  const startDate = parseIsoDateAsUTC(fromDate);
  const endDate = parseIsoDateAsUTC(toDate);

  if (startDate > endDate) {
    console.log(`ℹ️ Nothing to sync (from ${fromDate} is after to ${toDate}).`);
    return;
  }

  console.log(`🚀 NBA box scores & PBP ${fromDate} → ${toDate}`);
  if (args.dryRun) console.log('   (dry-run: no DB writes)');

  let totalGames = 0;
  const failedGames = [];
  let processedDates = [];

  // Iterate using Date objects to ensure proper day-by-day progression
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    // Format date for API call (YYYYMMDD)
    const year = currentDate.getUTCFullYear();
    const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getUTCDate()).padStart(2, '0');
    const ymd = `${year}${month}${day}`;
    const dateISO = `${year}-${month}-${day}`;

    processedDates.push(dateISO);
    console.log(`\n🔍 Processing date: ${dateISO} (API format: ${ymd})`);

    let allEvents;
    try {
      allEvents = await fetchScoreboardAllEvents(ymd);
      console.log(`   Found ${allEvents?.length || 0} games`);
      const seasons = allEvents
        .map((ev) => Number(ev?.season?.year))
        .filter((value) => Number.isFinite(value));
      if (seasons.length > 0) {
        const maxSeason = seasons.sort((a, b) => b - a)[0];
        if (activeSeason == null || maxSeason > activeSeason) activeSeason = maxSeason;
      }
    } catch (e) {
      console.error(`❌ Scoreboard ${dateISO}:`, e.message);
      scoreboardFailures.push({ date: dateISO, error: e.message, phase: 'ingest' });
      // Move to next day
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      continue;
    }

    if (!allEvents || allEvents.length === 0) {
      console.log(`   No games found for ${dateISO}`);
      // Move to next day
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      continue;
    }

    const scheduleRows = allEvents.map((ev) => parseScheduleFromScoreboardEvent(ev)).filter(Boolean);
    if (willWriteDb && supabase && scheduleRows.length > 0) {
      try {
        const { inserted, skippedExisting } = await insertMissingSchedules(supabase, scheduleRows);
        console.log(`   Schedule rows: inserted ${inserted}, existing ${skippedExisting}`);
        const refreshResult = await refreshScheduleTeams(supabase, scheduleRows);
        teamRepairsApplied += refreshResult.repaired;
        teamRepairGameIds.push(...refreshResult.repairedIds);
        unresolvedTeamPlaceholderIds.push(...refreshResult.unresolvedIds);
        if (refreshResult.repaired > 0) {
          console.log(`   Schedule team repairs applied: ${refreshResult.repaired}`);
        }
        if (refreshResult.unresolvedIds.length > 0) {
          console.warn(
            `   ⚠️ Schedule team placeholders remain unresolved after refresh for game IDs: ${refreshResult.unresolvedIds.join(', ')}`
          );
        }
      } catch (e) {
        console.error(`   ❌ Failed to insert missing schedules for ${dateISO}:`, e.message);
      }
    }

    const finalEvents = allEvents.filter((ev) => isFinalEvent(ev));
    if (finalEvents.length === 0) {
      console.log(`   No final games to process for ${dateISO}`);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      continue;
    }

    for (const ev of finalEvents) {
      const gameId = ev.game_id;
      try {
        process.stdout.write(`\rProcessing game ${gameId}... (${totalGames + 1} total)`);

        await processFinalGame(gameId, {
          supabase,
          willWriteDb,
        });

        totalGames++;
      } catch (e) {
        failedGames.push({ gameId, error: e.message });
        console.error(`\n   ❌ Game ${gameId}:`, e.message);
      }
      await sleep(1000);
    }

    // Move to next day
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   Dates processed: ${processedDates.join(', ')}`);
  console.log(`   Total games processed: ${totalGames}`);
  console.log(`   Failed games: ${failedGames.length}`);

  if (failedGames.length > 0) {
    console.warn(`⚠️ Failed games: ${failedGames.map((g) => g.gameId).join(', ')}`);
  }

  const reconcileWindow = getReconcileWindowByMode(activeMode);
  const reconcileStart = addDaysISO(today, -reconcileWindow.pastDays);
  const reconcileEnd = addDaysISO(today, reconcileWindow.futureDays);
  const reconcileDates = buildDateRange(reconcileStart, reconcileEnd);
  console.log(`🔁 Reconciliation window: ${reconcileStart} → ${reconcileEnd}`);
  const reconcileResult = await collectEventsByDates(reconcileDates);
  reconciliationFailures = reconcileResult.failures;
  if (reconciliationFailures.length > 0) {
    scoreboardFailures.push(
      ...reconciliationFailures.map((item) => ({ ...item, phase: 'reconcile_fetch' }))
    );
  }

  const reconcileEvents = Array.from(reconcileResult.byDate.values()).flat();
  const reconcileRows = reconcileEvents.map((ev) => parseScheduleFromScoreboardEvent(ev)).filter(Boolean);
  const expectedIds = [...new Set(reconcileRows.map((row) => Number(row.game_id)).filter(Number.isFinite))];
  let existingIds = new Set();

  if (willWriteDb && supabase && expectedIds.length > 0) {
    try {
      const refreshResult = await refreshScheduleTeams(supabase, reconcileRows);
      teamRepairsApplied += refreshResult.repaired;
      teamRepairGameIds.push(...refreshResult.repairedIds);
      unresolvedTeamPlaceholderIds.push(...refreshResult.unresolvedIds);
      if (refreshResult.repaired > 0) {
        console.log(`🔧 Reconcile team repairs applied: ${refreshResult.repaired}`);
      }
      if (refreshResult.unresolvedIds.length > 0) {
        console.warn(
          `⚠️ Reconcile placeholders remain unresolved after refresh for game IDs: ${refreshResult.unresolvedIds.join(', ')}`
        );
      }
    } catch (error) {
      console.error(`❌ Failed to refresh schedule teams during reconciliation: ${error.message}`);
    }

    existingIds = await getExistingScheduleIds(supabase, expectedIds);
    const missingIds = expectedIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      repairAttempted = true;
      const missingRows = reconcileRows.filter((row) => missingIds.includes(Number(row.game_id)));
      const repairResult = await insertMissingSchedules(supabase, missingRows);
      repairInserted = repairResult.inserted;
      repairSkippedExisting = repairResult.skippedExisting;
      console.log(
        `🔧 Reconcile repair: inserted ${repairInserted}, existing ${repairSkippedExisting}, missing before ${missingIds.length}`
      );
      existingIds = await getExistingScheduleIds(supabase, expectedIds);
    }
  }

  missingAfterRepair = willWriteDb && supabase ? expectedIds.filter((id) => !existingIds.has(id)) : [];
  if (willWriteDb && expectedIds.length > 0 && missingAfterRepair.length > 0) {
    console.warn(`⚠️ Missing schedule IDs after reconciliation: ${missingAfterRepair.join(', ')}`);
  }

  teamRepairGameIds = [...new Set(teamRepairGameIds)];
  unresolvedTeamPlaceholderIds = [...new Set(unresolvedTeamPlaceholderIds)];
  if (teamRepairsApplied > 0) {
    console.log(`🩹 Total schedule team repairs applied this run: ${teamRepairsApplied}`);
  }
  if (unresolvedTeamPlaceholderIds.length > 0) {
    console.warn(
      `⚠️ Schedule placeholders still unresolved after this run for game IDs: ${unresolvedTeamPlaceholderIds.join(', ')}`
    );
  }

  if (willWriteDb && supabase) {
    try {
      placeholderRowsAfterValidation = await getPlaceholderSchedulesInRange(supabase, reconcileStart, reconcileEnd);
      if (placeholderRowsAfterValidation.length > 0) {
        const ids = placeholderRowsAfterValidation.map((row) => row.game_id);
        console.warn(
          `⚠️ Placeholder schedule rows still present in reconcile window (${reconcileStart} → ${reconcileEnd}): ${ids.join(', ')}`
        );
      }
    } catch (error) {
      console.warn(`⚠️ Failed to validate placeholder schedules: ${error.message}`);
    }
  }

  let shouldFail = false;
  if (scoreboardFailures.length > 0) {
    shouldFail = true;
    console.error(
      `❌ Scoreboard fetch failures detected (${scoreboardFailures.length}). Treating as actionable failure.`
    );
  }

  if (activeMode === 'playoff' && missingAfterRepair.length > 0) {
    shouldFail = true;
  } else if (activeMode === 'regular' && missingAfterRepair.length > 2) {
    shouldFail = true;
  } else if (
    activeMode === 'offseason' &&
    expectedIds.length > 0 &&
    missingAfterRepair.length / expectedIds.length > 0.2
  ) {
    shouldFail = true;
  }

  await persistRunMetadata({
    supabase,
    willWriteDb,
    state: {
      pipeline_name: 'nba_schedule_pipeline',
      active_mode: activeMode,
      active_season: activeSeason,
      metadata: {
        reconcile_start: reconcileStart,
        reconcile_end: reconcileEnd,
        team_repairs_applied: teamRepairsApplied,
        team_repair_game_ids: teamRepairGameIds,
        unresolved_team_placeholder_ids: unresolvedTeamPlaceholderIds,
        placeholder_rows_after_validation: placeholderRowsAfterValidation.map((row) => row.game_id),
      },
    },
    audit: {
      run_id: runId,
      pipeline_name: 'nba_schedule_pipeline',
      mode: activeMode,
      from_date: fromDate,
      to_date: toDate,
      reconcile_start: reconcileStart,
      reconcile_end: reconcileEnd,
      processed_dates: processedDates,
      expected_event_count: expectedIds.length,
      missing_after_repair_ids: missingAfterRepair,
      repair_attempted: repairAttempted,
      repair_inserted: repairInserted,
      repair_skipped_existing: repairSkippedExisting,
      failed_game_ids: failedGames.map((g) => g.gameId),
      scoreboard_failures: scoreboardFailures,
      status: shouldFail ? 'failed' : 'ok',
    },
  });

  console.log('✨ Done.');
  if (shouldFail) {
    throw new Error('Pipeline finished with actionable failures. Check logs for details.');
  }
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});