#!/usr/bin/env node
/**
 * NBA Data Update Script
 * Fetches play-by-play, player boxscores, and team boxscores from ESPN API
 * and upserts into Supabase. Supports CSV export for inspection.
 *
 * Usage:
 *   node update-nba-data.js [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--csv] [--no-skip-db] [--dry-run] [--output-dir DIR]
 */

import { config } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptsDir = resolve(__dirname);
config({ path: resolve(scriptsDir, '.env') });
config({ path: resolve(scriptsDir, '.env.local') });

import { fetchScoreboard, fetchGameSummary } from './espn-api.js';
import { parsePlayByPlay, parseTeamBox, parsePlayerBox, parseScheduleFromSummary } from './parsers.js';
import { getSupabaseClient, getLastGameDate, upsertGameData, updateSchedule } from './supabase-client.js';
import { writeToCsv } from './csv-writer.js';

const DELAY_MS = 300;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    from: null,
    to: null,
    csv: false,
    skipDb: false,
    dryRun: false,
    outputDir: './output',
  };

  let noSkipDb = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) opts.from = args[++i];
    else if (args[i] === '--to' && args[i + 1]) opts.to = args[++i];
    else if (args[i] === '--csv') opts.csv = true;
    else if (args[i] === '--no-skip-db') {
      noSkipDb = true;
      opts.skipDb = false;
    } else if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--output-dir' && args[i + 1]) opts.outputDir = args[++i];
  }

  if (opts.csv && !noSkipDb) opts.skipDb = true;

  return opts;
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatDateHyphen(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const opts = parseArgs();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const supabase = getSupabaseClient();

  let fromDate;
  if (opts.from) {
    fromDate = parseDate(opts.from);
  } else if (supabase) {
    const lastDate = await getLastGameDate(supabase);
    if (lastDate) {
      const d = parseDate(lastDate);
      if (isNaN(d.getTime())) {
        console.warn(`Invalid last game date from DB: "${lastDate}", falling back to today - 7 days`);
        const fallback = new Date(today);
        fallback.setDate(fallback.getDate() - 7);
        fromDate = fallback;
      } else {
        d.setDate(d.getDate() + 1);
        fromDate = d;
        console.log(`Using last game date from play_by_play_raw: ${lastDate}, fetching from: ${formatDateHyphen(fromDate)}`);
      }
    } else {
      console.log('No play_by_play_raw data found, fetching last 7 days');
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      fromDate = d;
    }
  } else {
    console.warn('Supabase not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY), fetching last 7 days');
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    fromDate = d;
  }

  const toDate = opts.to ? parseDate(opts.to) : new Date(today);

  if (fromDate > toDate) {
    console.error('--from must be before --to');
    process.exit(1);
  }

  const supabaseForWrite = opts.dryRun || (opts.csv && opts.skipDb) ? null : supabase;
  if (!supabaseForWrite && !opts.dryRun && !(opts.csv && opts.skipDb)) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set in .env or environment.');
    process.exit(1);
  }

  const pbpBuffer = [];
  const playerBoxBuffer = [];
  const teamBoxBuffer = [];

  const dateRangeStr = `${formatDateHyphen(fromDate)}-${formatDateHyphen(toDate)}`;

  console.log(`Fetching NBA data from ${formatDateHyphen(fromDate)} to ${formatDateHyphen(toDate)}`);
  if (opts.csv) console.log('CSV export enabled, output dir:', opts.outputDir);
  if (opts.dryRun) console.log('Dry run - no DB writes');
  if (opts.csv && opts.skipDb) console.log('CSV-only mode - skipping DB write');

  const dates = [];
  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }

  let totalGames = 0;
  let failedGames = [];

  for (const date of dates) {
    const dateStr = formatDateYYYYMMDD(date);
    let games;
    try {
      games = await fetchScoreboard(dateStr);
    } catch (err) {
      console.warn(`Scoreboard fetch failed for ${dateStr}:`, err.message);
      continue;
    }

    for (const g of games) {
      const gameId = g.game_id;
      try {
        await sleep(DELAY_MS);
        const summary = await fetchGameSummary(gameId);

        const pbp = parsePlayByPlay(summary);
        const teamBox = parseTeamBox(summary);
        const playerBox = parsePlayerBox(summary);

        if (pbp && pbp.length > 0) {
          pbpBuffer.push(...pbp);
          if (!opts.dryRun && supabaseForWrite && !opts.skipDb) {
            await upsertGameData(supabaseForWrite, 'play_by_play_raw', 'game_id', gameId, pbp);
          }
        }

        if (teamBox && teamBox.length > 0) {
          teamBoxBuffer.push(...teamBox);
          if (!opts.dryRun && supabaseForWrite && !opts.skipDb) {
            await upsertGameData(supabaseForWrite, 'team_boxscores_raw', 'game_id', gameId, teamBox);
          }
        }

        if (playerBox && playerBox.length > 0) {
          playerBoxBuffer.push(...playerBox);
          if (!opts.dryRun && supabaseForWrite && !opts.skipDb) {
            await upsertGameData(supabaseForWrite, 'player_boxscores_raw', 'game_id', gameId, playerBox);
          }
        }

        const schedule = parseScheduleFromSummary(summary);
        if (schedule && !opts.dryRun && supabaseForWrite && !opts.skipDb) {
          await updateSchedule(supabaseForWrite, gameId, schedule);
        }

        totalGames++;
        process.stdout.write(`\rProcessed ${totalGames} games...`);
      } catch (err) {
        failedGames.push({ gameId, error: err.message });
        console.warn(`\nFailed game ${gameId}:`, err.message);
      }
    }
  }

  console.log(`\nCompleted. Processed ${totalGames} games.`);

  if (failedGames.length > 0) {
    console.warn(`Failed games: ${failedGames.map((g) => g.gameId).join(', ')}`);
  }

  if (opts.csv && (pbpBuffer.length > 0 || playerBoxBuffer.length > 0 || teamBoxBuffer.length > 0)) {
    const outDir = opts.outputDir;
    if (pbpBuffer.length > 0) {
      const pbpPath = join(outDir, `play_by_play_${dateRangeStr}.csv`);
      writeToCsv(pbpBuffer, pbpPath);
      console.log('Wrote', pbpPath);
    }
    if (playerBoxBuffer.length > 0) {
      const pbPath = join(outDir, `player_boxscores_${dateRangeStr}.csv`);
      writeToCsv(playerBoxBuffer, pbPath);
      console.log('Wrote', pbPath);
    }
    if (teamBoxBuffer.length > 0) {
      const tbPath = join(outDir, `team_boxscores_${dateRangeStr}.csv`);
      writeToCsv(teamBoxBuffer, tbPath);
      console.log('Wrote', tbPath);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
