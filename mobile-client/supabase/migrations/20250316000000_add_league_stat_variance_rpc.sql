-- RPC to get league-wide standard deviation per stat (across 30 teams)
-- Used for Seasonal Breakdown: difference is "significant" when |diff| >= k * std_dev

CREATE OR REPLACE FUNCTION get_league_stat_variance(p_season int DEFAULT 2026, p_season_type int DEFAULT 2)
RETURNS TABLE (
  pts_std numeric,
  reb_std numeric,
  ast_std numeric,
  stl_std numeric,
  blk_std numeric,
  tov_std numeric,
  fg_pct_std numeric,
  three_pt_pct_std numeric,
  ft_pct_std numeric,
  pts_allowed_std numeric,
  reb_allowed_std numeric,
  ast_allowed_std numeric,
  fg_pct_allowed_std numeric,
  three_pt_pct_allowed_std numeric,
  ft_pct_allowed_std numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH excluded_games AS (
    SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid
  ),
  off AS (
    SELECT
      STDDEV(pts_avg)::numeric AS pts_std,
      STDDEV(reb_avg)::numeric AS reb_std,
      STDDEV(ast_avg)::numeric AS ast_std,
      STDDEV(stl_avg)::numeric AS stl_std,
      STDDEV(blk_avg)::numeric AS blk_std,
      STDDEV(tov_avg)::numeric AS tov_std,
      STDDEV(fg_pct)::numeric AS fg_pct_std,
      STDDEV(three_pt_pct)::numeric AS three_pt_pct_std,
      STDDEV(ft_pct)::numeric AS ft_pct_std
    FROM get_team_offensive_stats(p_season, p_season_type)
  ),
  def AS (
    SELECT
      STDDEV(pts_allowed_avg)::numeric AS pts_allowed_std,
      STDDEV(reb_allowed_avg)::numeric AS reb_allowed_std,
      STDDEV(ast_allowed_avg)::numeric AS ast_allowed_std,
      STDDEV(fg_pct_allowed)::numeric AS fg_pct_allowed_std,
      STDDEV(three_pt_pct_allowed)::numeric AS three_pt_pct_allowed_std,
      STDDEV(ft_pct_allowed)::numeric AS ft_pct_allowed_std
    FROM get_team_defensive_stats(p_season, p_season_type)
  )
  SELECT
    off.pts_std,
    off.reb_std,
    off.ast_std,
    off.stl_std,
    off.blk_std,
    off.tov_std,
    off.fg_pct_std,
    off.three_pt_pct_std,
    off.ft_pct_std,
    def.pts_allowed_std,
    def.reb_allowed_std,
    def.ast_allowed_std,
    def.fg_pct_allowed_std,
    def.three_pt_pct_allowed_std,
    def.ft_pct_allowed_std
  FROM off, def;
$$;
