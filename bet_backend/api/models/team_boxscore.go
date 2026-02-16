package models

import "time"

type TeamBoxscore struct {
	GameID                        int64     `json:"game_id"`
	Season                        int32     `json:"season"`
	SeasonType                    int32     `json:"season_type"`
	GameDate                      time.Time `json:"game_date"`
	GameDateTime                  time.Time `json:"game_date_time"`
	TeamID                        int64     `json:"team_id"`
	TeamUid                       *string   `json:"team_uid,omitempty"`
	TeamSlug                      *string   `json:"team_slug,omitempty"`
	TeamLocation                  *string   `json:"team_location,omitempty"`
	TeamName                      *string   `json:"team_name,omitempty"`
	TeamAbbreviation              *string   `json:"team_abbreviation,omitempty"`
	TeamDisplayName               *string   `json:"team_display_name,omitempty"`
	TeamShortDisplayName          *string   `json:"team_short_display_name,omitempty"`
	TeamColor                     *string   `json:"team_color,omitempty"`
	TeamAlternateColor            *string   `json:"team_alternate_color,omitempty"`
	TeamLogo                      *string   `json:"team_logo,omitempty"`
	TeamHomeAway                  *string   `json:"team_home_away,omitempty"`
	TeamScore                     *int32    `json:"team_score,omitempty"`
	TeamWinner                    *bool     `json:"team_winner,omitempty"`
	Assists                       *int32    `json:"assists,omitempty"`
	Blocks                        *int32    `json:"blocks,omitempty"`
	DefensiveRebounds             *int32    `json:"defensive_rebounds,omitempty"`
	FastBreakPoints               *string   `json:"fast_break_points,omitempty"`
	FieldGoalPct                  *string   `json:"field_goal_pct,omitempty"`
	FieldGoalsMade                *int32    `json:"field_goals_made,omitempty"`
	FieldGoalsAttempted           *int32    `json:"field_goals_attempted,omitempty"`
	FlagrantFouls                 *int32    `json:"flagrant_fouls,omitempty"`
	Fouls                         *int32    `json:"fouls,omitempty"`
	FreeThrowPct                  *string   `json:"free_throw_pct,omitempty"`
	FreeThrowsMade                *int32    `json:"free_throws_made,omitempty"`
	FreeThrowsAttempted           *int32    `json:"free_throws_attempted,omitempty"`
	LargestLead                   *string   `json:"largest_lead,omitempty"`
	OffensiveRebounds             *int32    `json:"offensive_rebounds,omitempty"`
	PointsInPaint                 *string   `json:"points_in_paint,omitempty"`
	Steals                        *int32    `json:"steals,omitempty"`
	TeamTurnovers                 *int32    `json:"team_turnovers,omitempty"`
	TechnicalFouls                *int32    `json:"technical_fouls,omitempty"`
	ThreePointFieldGoalPct        *string   `json:"three_point_field_goal_pct,omitempty"`
	ThreePointFieldGoalsMade      *int32    `json:"three_point_field_goals_made,omitempty"`
	ThreePointFieldGoalsAttempted *int32    `json:"three_point_field_goals_attempted,omitempty"`
	TotalRebounds                 *int32    `json:"total_rebounds,omitempty"`
	TotalTechnicalFouls           *int32    `json:"total_technical_fouls,omitempty"`
	TotalTurnovers                *int32    `json:"total_turnovers,omitempty"`
	TurnoverPoints                *string   `json:"turnover_points,omitempty"`
	Turnovers                     *int32    `json:"turnovers,omitempty"`
	OpponentTeamID                *int64    `json:"opponent_team_id,omitempty"`
	OpponentTeamUid               *string   `json:"opponent_team_uid,omitempty"`
	OpponentTeamSlug              *string   `json:"opponent_team_slug,omitempty"`
	OpponentTeamLocation          *string   `json:"opponent_team_location,omitempty"`
	OpponentTeamName              *string   `json:"opponent_team_name,omitempty"`
	OpponentTeamAbbreviation      *string   `json:"opponent_team_abbreviation,omitempty"`
	OpponentTeamDisplayName       *string   `json:"opponent_team_display_name,omitempty"`
	OpponentTeamShortDisplayName  *string   `json:"opponent_team_short_display_name,omitempty"`
	OpponentTeamColor             *string   `json:"opponent_team_color,omitempty"`
	OpponentTeamAlternateColor    *string   `json:"opponent_team_alternate_color,omitempty"`
	OpponentTeamLogo              *string   `json:"opponent_team_logo,omitempty"`
	OpponentTeamScore             *int32    `json:"opponent_team_score,omitempty"`
}
