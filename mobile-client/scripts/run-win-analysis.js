#!/usr/bin/env node
/**
 * Runs all 6 queries from win_prediction_analysis.sql against Supabase.
 * Requires: POSTGRES_CONNECTION_STRING in .env.local
 */
const path = require('path');
const fs = require('fs');

try {
  const envPath = path.join(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
} catch (_) {}

const { Pool } = require('pg');

const SQL_PATH = path.join(__dirname, 'win_prediction_analysis.sql');

// Line ranges for each part (0-indexed, inclusive start, exclusive end)
const RANGES = [[0, 564], [572, 801], [807, 899], [905, 973], [979, 1001], [1007, 1030]];

async function main() {
  const connectionString = process.env.POSTGRES_CONNECTION_STRING;
  if (!connectionString) {
    console.error('Error: POSTGRES_CONNECTION_STRING required (set in .env.local)');
    process.exit(1);
  }

  const content = fs.readFileSync(SQL_PATH, 'utf8');
  const lines = content.split('\n');
  const queries = RANGES.map(([s, e]) => lines.slice(s, e).join('\n'));

  const pool = new Pool({ connectionString });
  const results = [];

  for (let i = 0; i < queries.length; i++) {
    try {
      const res = await pool.query(queries[i]);
      results.push({ part: i + 1, rows: res.rows, columns: res.fields?.map(f => f.name) || [] });
    } catch (err) {
      results.push({ part: i + 1, error: err.message });
    }
  }
  await pool.end();

  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
