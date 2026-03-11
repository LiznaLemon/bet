# Supabase Live Data Setup

The app connects to Supabase for live schedule, player stats, and shot data. **The app does not use local JSON; all data is fetched from Supabase at runtime.** Follow these steps to configure.

## 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
```

Get these from your Supabase project: **Dashboard → Project Settings → API** (Project URL and anon/publishable key).

## 2. Run the Database Migrations

Apply the RPC function and optimizations. In Supabase Dashboard → **SQL Editor**, run in order:

1. `supabase/migrations/20250306000000_create_players_enhanced_rpc.sql`
2. `supabase/migrations/20250307000000_optimize_players_rpc_payload.sql` (reduces payload size; fixes timeouts)
3. `supabase/migrations/20250307100000_fix_players_rpc_timeout.sql` (removes correlated subqueries)
4. `supabase/migrations/20250307200000_add_shots_query_index.sql` (index for shot chart lookups)

Or, if using Supabase CLI:

```bash
supabase db push
```

## 3. Row Level Security (RLS)

Enable RLS and allow public read access for the tables used by the app. In the SQL Editor:

```sql
-- Enable RLS on tables
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_boxscores_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_by_play_raw ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access (adjust if you add auth later)
CREATE POLICY "Allow public read schedules"
  ON schedules FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public read player_boxscores_raw"
  ON player_boxscores_raw FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public read play_by_play_raw"
  ON play_by_play_raw FOR SELECT TO anon USING (true);
```

## 4. Optional: Legacy Scripts

The `fetch-schedule` and `fetch-player-stats` scripts are no longer required for the app. You can keep them for:

- Backfilling or debugging
- Generating static JSON for offline/fallback

They use `POSTGRES_CONNECTION_STRING` (Supabase provides this in Project Settings → Database).

## 5. Debugging: Supabase Logs

If the players screen shows an error while the schedule loads:

1. **API Logs** – Dashboard → **Logs** → **API**  
   - Shows PostgREST requests, status codes, and errors for `get_players_enhanced`.

2. **Postgres Logs** – Dashboard → **Logs** → **Postgres**  
   - Shows database errors (e.g. RPC failures, timeouts).

3. **App logs** – In your terminal or Metro bundler, look for `[usePlayers] Supabase RPC error:` and the message/details.

4. **Common causes** – Large RPC responses (timeout), missing RLS policy, or wrong env vars. The optimization migration limits `game_log` to 30 games and omits `shots` to reduce payload size.
