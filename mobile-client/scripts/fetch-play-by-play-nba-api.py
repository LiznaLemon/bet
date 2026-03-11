#!/usr/bin/env python3
"""
Sample script to fetch NBA play-by-play data using nba_api.
Run: python scripts/fetch-play-by-play-nba-api.py [game_id]

This script demonstrates the data structure from nba_api and compares it
to your play_by_play_raw database schema for compatibility checking.

Your DB schema expects:
  - game_id, season, season_type
  - sequence_number, type_text, period_number
  - clock_display_value, start_quarter_seconds_remaining, start_game_seconds_remaining
  - game_play_number, scoring_play, score_value
  - athlete_id_1, athlete_id_2, athlete_id_3
  - shooting_play, points_attempted
  - coordinate_x_raw, coordinate_y_raw (for shot chart)
"""

import json
import re
import sys
import warnings

# PlayByPlayV2 is deprecated; we still try it for reference
warnings.filterwarnings("ignore", message=".*PlayByPlayV2 is deprecated.*")

try:
    from nba_api.stats.endpoints import playbyplayv2, playbyplayv3
    from nba_api.stats.static import teams
except ImportError:
    print("Error: nba_api not installed. Run: pip install nba_api")
    sys.exit(1)


# NBA API uses 10-digit game IDs: 002YYMMNNNN
#   - 002 = prefix
#   - YY = season year (e.g., 24 for 2024-25)
#   - M = season type (1=preseason, 2=regular, 4=playoffs)
#   - NNNNN = game number
# Example: 0022401234 = 2024-25 regular season game 1234
DEFAULT_GAME_ID = "0022401234"  # Sample from 2024-25 season


def get_recent_game_id():
    """Try to get a recent game ID from the league game log."""
    try:
        from nba_api.stats.endpoints import leaguegamefinder

        finder = leaguegamefinder.LeagueGameFinder(
            season_nullable="2024-25",
            season_type_nullable="Regular Season",
        )
        df = finder.get_data_frames()[0]
        if df is not None and len(df) > 0:
            # Get a completed game (has GAME_DATE)
            completed = df[df["GAME_DATE"].notna()].head(1)
            if len(completed) > 0:
                return str(completed.iloc[0]["GAME_ID"])
    except Exception as e:
        print(f"Could not fetch recent game: {e}")
    return DEFAULT_GAME_ID


def fetch_playbyplay_v2(game_id: str, start_period: int = 1, end_period: int = 4):
    """Fetch play-by-play using PlayByPlayV2 (legacy endpoint)."""
    pbp = playbyplayv2.PlayByPlayV2(
        game_id=game_id,
        start_period=start_period,
        end_period=end_period,
    )
    return pbp.play_by_play.get_data_frame()


def fetch_playbyplay_v3(game_id: str, start_period: int = 1, end_period: int = 4):
    """Fetch play-by-play using PlayByPlayV3 (recommended endpoint)."""
    pbp = playbyplayv3.PlayByPlayV3(
        game_id=game_id,
        start_period=start_period,
        end_period=end_period,
    )
    return pbp.play_by_play.get_data_frame()


def _pt_to_mmss(clock: str) -> str:
    """Convert PT12M00.00S to MM:SS display format."""
    s = parse_clock_pt(clock)
    if s is None:
        return ""
    return f"{s // 60}:{s % 60:02d}"


def parse_clock_pt(clock: str) -> int | None:
    """
    Parse V3 clock format (e.g. 'PT12M00.00S', 'PT05M23.50S') to seconds remaining in quarter.
    PT12M00.00S = 720 seconds (start of period), PT00M00.00S = 0 (end of period).
    """
    if not clock or not isinstance(clock, str):
        return None
    m = re.match(r"PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?", clock)
    if not m:
        return None
    mins = int(m.group(1) or 0)
    secs = float(m.group(2) or 0)
    return int(mins * 60 + secs)


def main():
    game_id = sys.argv[1] if len(sys.argv) > 1 else get_recent_game_id()

    # Ensure 10-digit format for NBA API
    if len(game_id) == 9 and not game_id.startswith("00"):
        print(
            f"Note: Your game_id '{game_id}' looks like ESPN format (9 digits). "
            "NBA API expects 10-digit format (e.g. 0022401234)."
        )
        print("Attempting to use as-is; if empty results, try a 10-digit NBA game ID.\n")

    print("=" * 70)
    print(f"Fetching play-by-play for game_id: {game_id}")
    print("=" * 70)

    # Try PlayByPlayV3 first (recommended)
    print("\n--- PlayByPlayV3 (recommended) ---")
    try:
        df_v3 = fetch_playbyplay_v3(game_id)
        if df_v3 is not None and len(df_v3) > 0:
            print(f"Rows: {len(df_v3)}")
            print("\nColumns:", list(df_v3.columns))
            print("\nSample row (first 3 plays):")
            for i, row in df_v3.head(3).iterrows():
                print(json.dumps(row.to_dict(), default=str, indent=2))
            print("\nSample JSON (first play):")
            print(json.dumps(df_v3.iloc[0].to_dict(), default=str, indent=2))
        else:
            print("(Empty DataFrame - V3 may not have data for this game)")
    except Exception as e:
        print(f"PlayByPlayV3 error: {e}")

    # Try PlayByPlayV2 as fallback
    print("\n--- PlayByPlayV2 (legacy) ---")
    try:
        df_v2 = fetch_playbyplay_v2(game_id)
        if df_v2 is not None and len(df_v2) > 0:
            print(f"Rows: {len(df_v2)}")
            print("\nColumns:", list(df_v2.columns))
            print("\nSample row (first play):")
            print(json.dumps(df_v2.iloc[0].to_dict(), default=str, indent=2))
        else:
            print("(Empty DataFrame - V2 may be deprecated for recent games)")
    except Exception as e:
        print(f"PlayByPlayV2 error: {e}")

    # Sample row mapped to DB schema
    print("\n--- Sample mapped to play_by_play_raw ---")
    try:
        df_v3 = fetch_playbyplay_v3(game_id)
        if df_v3 is not None and len(df_v3) > 0:
            # Get a scoring play (e.g. made shot) for a clearer example
            scoring = df_v3[(df_v3["shotResult"] == "Made") | (df_v3["pointsTotal"] > 0)]
            row = scoring.iloc[0] if len(scoring) > 0 else df_v3.iloc[2]
            quarter_secs = parse_clock_pt(str(row.get("clock", "")))
            game_secs = (int(row.get("period", 1)) - 1) * 720 + (quarter_secs or 0)
            season = int(row.get("gameId", "0022400000")[3:5]) + 2000  # 24 -> 2024
            mapped = {
                "game_id": str(row.get("gameId", "")),
                "season": season,
                "season_type": 2,
                "sequence_number": str(row.get("actionId", "")),
                "type_text": str(row.get("description", "")),
                "period_number": int(row.get("period", 1)),
                "clock_display_value": _pt_to_mmss(str(row.get("clock", ""))),
                "start_quarter_seconds_remaining": quarter_secs,
                "start_game_seconds_remaining": game_secs,
                "game_play_number": int(row.get("actionNumber", 0)),
                "scoring_play": str(row.get("shotResult", "")) == "Made" or int(row.get("pointsTotal", 0) or 0) > 0,
                "score_value": int(row.get("pointsTotal", 0) or row.get("shotValue", 0) or 0),
                "athlete_id_1": int(row.get("personId", 0)) if row.get("personId") else None,
                "athlete_id_2": None,  # V3 has single personId; assists/blocks need parsing
                "athlete_id_3": None,
                "shooting_play": bool(row.get("isFieldGoal", False)),
                "points_attempted": int(row.get("shotValue", 0) or 0) if row.get("isFieldGoal") else None,
                "coordinate_x_raw": float(row.get("xLegacy", 0)) if row.get("xLegacy") else None,
                "coordinate_y_raw": float(row.get("yLegacy", 0)) if row.get("yLegacy") else None,
            }
            print(json.dumps(mapped, indent=2))
    except Exception as e:
        print(f"Mapping error: {e}")

    # Compatibility mapping
    print("\n" + "=" * 70)
    print("COMPATIBILITY: nba_api → play_by_play_raw schema")
    print("=" * 70)
    print("""
Your play_by_play_raw table expects:
  game_id          → gameId (V3) / GAME_ID (V2) — NOTE: NBA uses 10-digit, you may use 9-digit ESPN
  season           → Must derive from game_id or pass separately
  season_type      → Must derive from game_id (1=preseason, 2=regular, 4=playoffs)
  sequence_number  → actionId (V3) / EVENTNUM (V2)
  type_text        → description (V3) / HOMEDESCRIPTION+VISITORDESCRIPTION (V2)
  period_number    → period (V3) / PERIOD (V2)
  clock_display_value → clock (V3) / PCTIMESTRING (V2)
  start_quarter_seconds_remaining → Parse from clock/PCTIMESTRING (e.g. "5:23" → 323)
  start_game_seconds_remaining   → (period-1)*720 + quarter_seconds
  game_play_number → actionNumber (V3) / EVENTNUM (V2)
  scoring_play     → shotResult=='Made' (V3) / EVENTMSGTYPE 1,2,3 (V2)
  score_value      → pointsTotal (V3) / parse from SCORE delta (V2)
  athlete_id_1     → personId (V3) / PLAYER1_ID (V2)
  athlete_id_2     → (V3: often null, check description) / PLAYER2_ID (V2)
  athlete_id_3     → (V3: often null) / PLAYER3_ID (V2)
  shooting_play    → isFieldGoal==True (V3) / EVENTMSGTYPE 1,2 (V2)
  points_attempted → Parse from description/subType (V3) / EVENTMSGACTIONTYPE (V2)
  coordinate_x_raw → xLegacy (V3) / not in V2
  coordinate_y_raw → yLegacy (V3) / not in V2

GAPS / CONSIDERATIONS:
  - Game ID format: Your DB uses 9-digit (401809839), NBA API uses 10-digit (0022401234).
    You may need a mapping table or conversion logic.
  - V3 has xLegacy/yLegacy for shot coordinates; V2 does not.
  - COORDINATE UNITS: Your shot chart expects coordinate_y_raw <= 42.25 (feet from basket).
    nba_api xLegacy/yLegacy use a different scale (e.g. 215 vs 21.5 ft). You'll need to
    convert: typically yLegacy/10 or similar to get feet. Verify with a known shot distance.
  - V3 has single personId per row; athlete_id_2/3 (assists, blocks) need parsing from
    description or separate logic.
  - season, season_type must be supplied from game metadata (not in play-by-play response).
""")


if __name__ == "__main__":
    main()
