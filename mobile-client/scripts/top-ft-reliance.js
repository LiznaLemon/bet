#!/usr/bin/env node
/**
 * Top 10 players by % of points from free throws (high-volume FTA qualifiers).
 * Run: node scripts/top-ft-reliance.js [season]
 * Requires: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)
 */

const path = require('path');
const fs = require('fs');

try {
  const envLocalPath = path.join(__dirname, '../.env.local');
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envLocalPath)) require('dotenv').config({ path: envLocalPath });
  else if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
} catch (_) {}

const { createClient } = require('@supabase/supabase-js');

const SEASON = parseInt(process.argv[2] || '2026', 10);

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data, error } = await supabase.rpc('get_players_enhanced', {
    p_season: SEASON,
    p_season_type: 2,
  });

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  const players = data ?? [];
  const qualified = players.filter((p) => Number(p.games_played ?? 0) >= 10);

  const p90Index = (arr) => Math.max(0, Math.floor(arr.length * 0.1));
  const ftaValues = qualified
    .map((p) => Number(p.total_free_throws_attempted ?? 0))
    .sort((a, b) => b - a);
  const MIN_FTA = ftaValues[p90Index(ftaValues)] ?? 0;

  const withPctFt = qualified
    .filter((p) => Number(p.total_free_throws_attempted ?? 0) >= MIN_FTA)
    .map((p) => {
      const fgm = Number(p.total_field_goals_made ?? 0);
      const tpm = Number(p.total_three_point_made ?? 0);
      const ftm = Number(p.total_free_throws_made ?? 0);
      const pts2pt = Math.max(0, fgm - tpm) * 2;
      const pts3pt = tpm * 3;
      const ptsFt = ftm;
      const totalPts = pts2pt + pts3pt + ptsFt;
      const pctFt = totalPts > 0 ? (ptsFt / totalPts) * 100 : 0;
      return {
        name: p.athlete_display_name,
        pctFt,
        ftm,
        fta: Number(p.total_free_throws_attempted ?? 0),
        totalPts: Math.round(totalPts),
      };
    })
    .sort((a, b) => b.pctFt - a.pctFt)
    .slice(0, 10);

  console.log(`\nTop 10 players by % of points from free throws (season ${SEASON})`);
  console.log(`High-volume qualifier: ≥${MIN_FTA} FTA (90th percentile)\n`);
  console.log('Rank | Player                      | FT% of PTS | FTM | FTA | Total PTS');
  console.log('-----|-----------------------------|------------|-----|-----|----------');

  withPctFt.forEach((p, i) => {
    const rank = String(i + 1).padStart(2);
    const name = p.name.padEnd(28).slice(0, 28);
    const pct = p.pctFt.toFixed(1).padStart(6) + '%';
    const ftm = String(p.ftm).padStart(3);
    const fta = String(p.fta).padStart(3);
    const pts = String(p.totalPts).padStart(6);
    console.log(`  ${rank} | ${name} | ${pct}     | ${ftm} | ${fta} | ${pts}`);
  });
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
