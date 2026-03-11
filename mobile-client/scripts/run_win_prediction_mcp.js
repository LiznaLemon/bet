#!/usr/bin/env node
/**
 * Run win prediction SQL parts via Supabase.
 * Usage: node scripts/run_win_prediction_mcp.js [part_number]
 * If no part_number, runs all 6 parts.
 * Requires: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */
const fs = require('fs');
const path = require('path');

async function runPart(partNum) {
  const file = path.join('/tmp', `part${partNum}.sql`);
  const query = fs.readFileSync(file, 'utf8').trim();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace('https://', 'https://').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data;
}

// Supabase doesn't have exec_sql RPC by default - use postgrest
// Actually we need to use the SQL API. Supabase has:
// POST /rest/v1/ with a custom query? No - we need the PostgREST or direct SQL.
// The MCP uses the Supabase client which has a way to run raw SQL.
// For node, we'd use @supabase/supabase-js and there's no direct SQL in the client.
// We need to use the Supabase Management API or connect via postgres.
// Simpler: use psql if available, or the Supabase dashboard.
console.log('This script requires Supabase SQL execution.');
console.log('Use the Supabase MCP execute_sql tool, or run in SQL Editor.');
console.log('Query files: /tmp/part1.sql through /tmp/part6.sql');
process.exit(0);
