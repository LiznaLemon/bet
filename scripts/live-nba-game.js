#!/usr/bin/env node
/**
 * Live NBA Game - Fetch and display live play-by-play and score data from ESPN API
 *
 * Uses the Site API v2 summary endpoint (per Public-ESPN-API docs):
 *   https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={gameId}
 *
 * Usage:
 *   node live-nba-game.js <gameId>              # One-time fetch
 *   node live-nba-game.js <gameId> --watch       # Poll every 10s for live updates
 *   node live-nba-game.js 401810808 --watch -i 5 # Poll every 5 seconds
 *
 * API: site.api.espn.com (Site API v2) - see Public-ESPN-API docs
 */

const SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';

async function fetchLiveGame(gameId) {
  const url = `${SUMMARY_URL}?event=${gameId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN API failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function formatGame(data) {
  const header = data.header;
  const comp = header?.competitions?.[0];
  if (!comp) return null;

  const status = comp.status?.type || {};
  const competitors = comp.competitors || [];
  const away = competitors.find((c) => c.homeAway === 'away');
  const home = competitors.find((c) => c.homeAway === 'home');

  const plays = data.plays || [];
  const recentPlays = plays.slice(-8).reverse();

  return {
    gameId: header.id,
    name: comp.name || `${away?.team?.abbreviation || '?'} @ ${home?.team?.abbreviation || '?'}`,
    status: status.name || 'Unknown',
    statusDetail: comp.status?.type?.shortDetail || comp.status?.type?.detail || '',
    period: comp.status?.period ?? comp.status?.displayPeriod,
    clock: comp.status?.displayClock || '',
    awayTeam: away?.team?.abbreviation || '?',
    awayScore: away?.score ?? '0',
    homeTeam: home?.team?.abbreviation || '?',
    homeScore: home?.score ?? '0',
    plays: recentPlays,
    totalPlays: plays.length,
  };
}

function printGame(game) {
  const lines = [
    '',
    '═'.repeat(60),
    `  ${game.awayTeam}  ${game.awayScore}  @  ${game.homeTeam}  ${game.homeScore}`,
    `  ${game.status}  ${game.statusDetail || game.clock}`,
    '─'.repeat(60),
    `  Recent plays (${game.totalPlays} total):`,
  ];

  for (const p of game.plays) {
    const qtr = p.period?.number ?? p.period ?? '?';
    const clock = p.clock?.displayValue ?? p.clock ?? '';
    const text = (p.text || '').slice(0, 52);
    const score = p.homeScore != null && p.awayScore != null ? ` (${p.awayScore}-${p.homeScore})` : '';
    lines.push(`    Q${qtr} ${clock}  ${text}${score}`);
  }

  lines.push('═'.repeat(60));
  console.log(lines.join('\n'));
}

async function main() {
  const args = process.argv.slice(2);
  const gameId = args.find((a) => /^\d+$/.test(a));
  const watch = args.includes('--watch') || args.includes('-w');
  const intervalIdx = args.findIndex((a) => a === '-i' || a === '--interval');
  const interval =
    intervalIdx >= 0 && args[intervalIdx + 1]
      ? parseInt(args[intervalIdx + 1], 10) * 1000
      : 10000;

  if (!gameId) {
    console.error('Usage: node live-nba-game.js <gameId> [--watch]');
    console.error('Example: node live-nba-game.js 401810808 --watch');
    process.exit(1);
  }

  const run = async () => {
    try {
      const data = await fetchLiveGame(gameId);
      const game = formatGame(data);
      if (!game) {
        console.error('Could not parse game data');
        return;
      }
      printGame(game);
      if (game.status === 'STATUS_FINAL') {
        console.log('\nGame final. Exiting.');
        process.exit(0);
      }
    } catch (err) {
      console.error('Error:', err.message);
    }
  };

  await run();

  if (watch) {
    console.log(`\nPolling every ${interval / 1000}s. Ctrl+C to stop.\n`);
    setInterval(run, interval);
  }
}

main();
