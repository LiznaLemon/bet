#!/usr/bin/env node
/**
 * NBA Data Update Script
 * Fetches play-by-play, player boxscores, and team boxscores from ESPN API
 * and upserts into Supabase.
 *
 * Usage:
 *   node update-nba-data.js [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--dry-run]
 */

import 'dotenv/config';
import { fetchScoreboard, fetchGameSummary } from './espn-api.js';
import { parsePlayByPlay, parsePlayerBox, parseScheduleFromSummary, parseTeamBox } from './parsers.js';
import { getSupabaseClient, getTableUpdateWatermarks, updateSchedule, upsertGameData } from './supabase-client.js';

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
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

async function main() {
  const args = parseArgs(process.argv);
  const willWriteDb = !args.dryRun;

  const supabase = getSupabaseClient();
  if (willWriteDb && !supabase) {
    console.error('❌ Missing Supabase env: SUPABASE_API_URL and SUPABASE_SERVICE_ROLE_KEY are required for DB writes.');
    process.exit(1);
  }

  const toDate = args.to ?? todayISO();
  let fromDate = args.from; // Start with user-provided from date if exists
  let watermarks = null;

  if (supabase) {
    watermarks = await getTableUpdateWatermarks(supabase);
    printTableWatermarks(watermarks);
  }

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
      fromDate = addDaysISO(toDate, -7);
      console.log(`ℹ️ No watermark found. Using default: last 7 days (from ${fromDate})`);
    }
  } else {
    console.log(`ℹ️ Using user-provided --from date: ${fromDate}`);
  }

  console.log(`📅 Date range calculated:`);
  console.log(`   From: ${fromDate}`);
  console.log(`   To: ${toDate}`);
  console.log(`   Start date object: ${new Date(fromDate)}`);
  console.log(`   End date object: ${new Date(toDate)}`);

  // Convert to Date objects for proper comparison
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

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
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const ymd = `${year}${month}${day}`;
    const dateISO = `${year}-${month}-${day}`;

    processedDates.push(dateISO);
    console.log(`\n🔍 Processing date: ${dateISO} (API format: ${ymd})`);

    let events;
    try {
      events = await fetchScoreboard(ymd);
      console.log(`   Found ${events?.length || 0} games`);
    } catch (e) {
      console.error(`❌ Scoreboard ${dateISO}:`, e.message);
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    if (!events || events.length === 0) {
      console.log(`   No games found for ${dateISO}`);
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    for (const ev of events) {
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
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   Dates processed: ${processedDates.join(', ')}`);
  console.log(`   Total games processed: ${totalGames}`);
  console.log(`   Failed games: ${failedGames.length}`);

  if (failedGames.length > 0) {
    console.warn(`⚠️ Failed games: ${failedGames.map((g) => g.gameId).join(', ')}`);
  }

  console.log('✨ Done.');
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});