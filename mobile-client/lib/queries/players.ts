import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { GameLogEntry, Player } from '@/lib/types';

const FETCH_TIMEOUT_MS = 15000;

export async function fetchPlayers(season: number): Promise<Player[]> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out. Check your network connection.')), FETCH_TIMEOUT_MS);
  });

  const fetchPromise = (async () => {
    const { data, error } = await supabase.rpc('get_players_enhanced', {
      p_season: season,
      p_season_type: 2,
    });

    if (error) {
      console.error('[usePlayers] Supabase RPC error:', error.message, error.details, error.hint);
      throw new Error(error.message || 'Failed to load players');
    }

    return (data ?? []) as Player[];
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

export function usePlayers(season = 2026) {
  return useQuery({
    queryKey: ['players', season],
    queryFn: () => fetchPlayers(season),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export type PlayerStatRanks = {
  athlete_id: string;
  ppg_rank: number;
  rpg_rank: number;
  apg_rank: number;
  spg_rank: number;
  bpg_rank: number;
  /** 3PT made per game rank (from get_player_stat_ranks migration 20250321) */
  three_pm_rank?: number;
};

export async function fetchPlayerStatRanks(
  season: number,
  athleteIds: string[]
): Promise<Record<string, PlayerStatRanks>> {
  const { data, error } = await supabase.rpc('get_player_stat_ranks', {
    p_season: season,
    p_season_type: 2,
    p_athlete_ids: athleteIds,
  });
  if (error) {
    console.error('[fetchPlayerStatRanks] RPC error:', error.message);
    throw error;
  }
  const rows = (data ?? []) as PlayerStatRanks[];
  return Object.fromEntries(rows.map((r) => [r.athlete_id, r]));
}

export function usePlayerStatRanks(season: number, athleteIds: string[]) {
  const ids = [...new Set(athleteIds)].filter(Boolean).sort();
  return useQuery({
    queryKey: ['player-stat-ranks', season, ids.length === 0 ? 'all' : ids],
    queryFn: () => fetchPlayerStatRanks(season, ids),
    staleTime: 5 * 60 * 1000,
  });
}

// --- Paginated players ---

const PLAYERS_PAGE_SIZE = 25;

export type PaginatedPlayer = Player & {
  recent_game_log: { points: number; rebounds: number; assists: number; steals: number; blocks: number; three_point_made: number }[];
  total_count: number;
  qualified?: boolean;
  /** League-wide rank for the current sort stat (1-based). From get_players_paginated. */
  stat_rank?: number;
};

type PaginatedPlayersPage = {
  players: PaginatedPlayer[];
  totalCount: number;
  nextOffset: number | undefined;
};

async function fetchPlayersPaginated(
  season: number,
  search: string | null,
  sortBy: string,
  offset: number
): Promise<PaginatedPlayersPage> {
  const { data, error } = await supabase.rpc('get_players_paginated', {
    p_season: season,
    p_season_type: 2,
    p_search: search || null,
    p_sort_by: sortBy,
    p_sort_dir: 'desc',
    p_offset: offset,
    p_limit: PLAYERS_PAGE_SIZE,
  });

  if (error) throw new Error(error.message || 'Failed to load players');

  const rows = (data ?? []) as PaginatedPlayer[];
  const totalCount = rows[0]?.total_count ?? 0;
  const hasMore = offset + rows.length < totalCount;

  return {
    players: rows,
    totalCount,
    nextOffset: hasMore ? offset + PLAYERS_PAGE_SIZE : undefined,
  };
}

export function usePlayersPaginated(
  season: number,
  search: string,
  sortBy: string,
  enabled = true
) {
  return useInfiniteQuery({
    queryKey: ['players-paginated', season, search || null, sortBy],
    queryFn: ({ pageParam = 0 }) =>
      fetchPlayersPaginated(season, search, sortBy, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/** Prefetch first page of players (e.g. at app open) so Players tab loads from cache. */
export function prefetchPlayersFirstPage(season = 2026, sortBy = 'ppg') {
  return queryClient.prefetchInfiniteQuery({
    queryKey: ['players-paginated', season, null, sortBy],
    queryFn: ({ pageParam = 0 }) =>
      fetchPlayersPaginated(season, null, sortBy, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 5 * 60 * 1000,
  });
}

// --- On-demand game log ---

export async function fetchPlayerGameLog(
  athleteId: string,
  season: number,
  limit = 82
): Promise<GameLogEntry[]> {
  const { data, error } = await supabase.rpc('get_player_game_log', {
    p_athlete_id: athleteId,
    p_season: season,
    p_season_type: 2,
    p_limit: limit,
  });

  if (error) throw new Error(error.message || 'Failed to load game log');
  return (data ?? []) as GameLogEntry[];
}

export function usePlayerGameLog(
  athleteId: string | undefined,
  season = 2026,
  limit = 82
) {
  return useQuery({
    queryKey: ['player-game-log', athleteId, season, limit],
    queryFn: () => fetchPlayerGameLog(athleteId!, season, limit),
    enabled: !!athleteId,
    staleTime: 5 * 60 * 1000,
  });
}
