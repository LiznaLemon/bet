#!/usr/bin/env node

import 'dotenv/config';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { fetchScoreboard, fetchGameSummary } from './espn-api.js';
import { parsePlayByPlay, parsePlayerBox, parseTeamBox } from './parsers.js';
import { writeToCsv } from './csv-writer.js';
import { getSupabaseClient, getTableUpdateWatermarks, upsertGameData } from './supabase-client.js';

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
    csv: false,
    dryRun: false,
    skipDbWithCsv: true,
    outputDir: './output',
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
    if (a === '--csv') {
      out.csv = true;
      continue;
    }
    if (a === '--no-skip-db') {
      out.skipDbWithCsv = false;
      continue;
    }
    if (a === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (a === '--output-dir' && argv[i + 1]) {
      out.outputDir = argv[++i];
      continue;
    }
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Final games only: ESPN summary has reliable box scores and (when available) PBP. */
async function processFinalGame(gameId, { supabase, willWriteDb, willWriteCsv, outputDir }) {
  const summary = await fetchGameSummary(gameId);
  const pbpRows = parsePlayByPlay(summary);
  const teamRows = parseTeamBox(summary);
  const playerRows = parsePlayerBox(summary);

  if (willWriteCsv) {
    mkdirSync(outputDir, { recursive: true });
    const base = join(outputDir, String(gameId));
    if (pbpRows?.length) writeToCsv(pbpRows, `${base}_play_by_play_raw.csv`);
    if (teamRows?.length) writeToCsv(teamRows, `${base}_team_boxscores_raw.csv`);
    if (playerRows?.length) writeToCsv(playerRows, `${base}_player_boxscores_raw.csv`);
  }

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
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const willWriteCsv = args.csv;
  const willWriteDb = !args.dryRun && (!willWriteCsv || !args.skipDbWithCsv);

  const supabase = getSupabaseClient();
  if (willWriteDb && !supabase) {
    console.error('❌ Missing Supabase env: SUPABASE_API_URL and SUPABASE_SERVICE_ROLE_KEY are required for DB writes.');
    process.exit(1);
  }

  const toDate = args.to ?? todayISO();
  let fromDate = args.from;
  let watermarks = null;

  if (supabase) {
    watermarks = await getTableUpdateWatermarks(supabase);
    printTableWatermarks(watermarks);
  }

  if (!fromDate) {
    if (watermarks) {
      const present = Object.entries(watermarks).filter(([, ts]) => !!ts);
      if (present.length > 0) {
        // Re-sync from the oldest table watermark date so lagging tables catch up.
        const oldest = present.sort((a, b) => String(a[1]).localeCompare(String(b[1])))[0];
        fromDate = isoDateFromTimestamp(oldest[1]);
        console.log(`ℹ️ Using oldest table watermark: ${oldest[0]} @ ${oldest[1]}`);
      }
    }
    if (!fromDate) fromDate = addDaysISO(toDate, -7);
  }

  if (fromDate > toDate) {
    console.log(`ℹ️ Nothing to sync (from ${fromDate} is after to ${toDate}).`);
    return;
  }

  console.log(`🚀 NBA box scores & PBP ${fromDate} → ${toDate}`);
  if (args.dryRun) console.log('   (dry-run: no DB or CSV writes)');
  if (willWriteCsv) console.log(`   CSV output: ${args.outputDir}`);

  for (let dateISO = fromDate; dateISO <= toDate; dateISO = addDaysISO(dateISO, 1)) {
    const ymd = dateISO.replace(/-/g, '');
    let events;
    try {
      events = await fetchScoreboard(ymd);
    } catch (e) {
      console.error(`❌ Scoreboard ${dateISO}:`, e.message);
      continue;
    }

    console.log(`📅 ${dateISO}: ${events.length} final game(s)`);
    if (events.length === 0) continue;

    for (const ev of events) {
      const gameId = ev.game_id;
      try {
        console.log(`   ✓ Game ${gameId}`);
        await processFinalGame(gameId, {
          supabase,
          willWriteDb,
          willWriteCsv,
          outputDir: args.outputDir,
        });
      } catch (e) {
        console.error(`   ❌ Game ${gameId}:`, e.message);
      }
      await sleep(1000);
    }
  }

  console.log('✨ Done.');
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
