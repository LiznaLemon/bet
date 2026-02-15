package models

import "time"

type BoxScore struct {
	GameID                        int64     `json:"game_id"`
	Season                        int32     `json:"season"`
	SeasonType                    int32     `json:"season_type"`
	GameDate                      time.Time `json:"game_date"`
	GameDateTime                  time.Time `json:"game_date_time"`
	AthleteID                     int64     `json:"athlete_id"`
	AthleteDisplayName            string    `json:"athlete_display_name"`
	TeamID                        int64     `json:"team_id"`
	TeamName                      string    `json:"team_name"`
	TeamLocation                  string    `json:"team_location"`
	TeamShortDisplayName          string    `json:"team_short_display_name"`
	Minutes                       *string   `json:"minutes,omitempty"`
	FieldGoalsMade                *int32    `json:"field_goals_made,omitempty"`
	FieldGoalsAttempted           *int32    `json:"field_goals_attempted,omitempty"`
	ThreePointFieldGoalsMade      *int32    `json:"three_point_field_goals_made,omitempty"`
	ThreePointFieldGoalsAttempted *int32    `json:"three_point_field_goals_attempted,omitempty"`
	FreeThrowsMade                *int32    `json:"free_throws_made,omitempty"`
	FreeThrowsAttempted           *int32    `json:"free_throws_attempted,omitempty"`
	OffensiveRebounds             *int32    `json:"offensive_rebounds,omitempty"`
	DefensiveRebounds             *int32    `json:"defensive_rebounds,omitempty"`
	Rebounds                      *int32    `json:"rebounds,omitempty"`
	Assists                       *int32    `json:"assists,omitempty"`
	Steals                        *int32    `json:"steals,omitempty"`
	Blocks                        *int32    `json:"blocks,omitempty"`
	Turnovers                     *int32    `json:"turnovers,omitempty"`
	Fouls                         *int32    `json:"fouls,omitempty"`
	PlusMinus                     *string   `json:"plus_minus,omitempty"`
	Points                        *int32    `json:"points,omitempty"`
	Starter                       *bool     `json:"starter,omitempty"`
	Ejected                       *bool     `json:"ejected,omitempty"`
	DidNotPlay                    *bool     `json:"did_not_play,omitempty"`
	Reason                        *string   `json:"reason,omitempty"`
	Active                        *bool     `json:"active,omitempty"`
	AthleteJersey                 *string   `json:"athlete_jersey,omitempty"`
	AthleteShortName              *string   `json:"athlete_short_name,omitempty"`
	AthleteHeadshotHref           *string   `json:"athlete_headshot_href,omitempty"`
	AthletePositionName           *string   `json:"athlete_position_name,omitempty"`
	AthletePositionAbbreviation   *string   `json:"athlete_position_abbreviation,omitempty"`
	TeamDisplayName               string    `json:"team_display_name"`
	TeamUid                       string    `json:"team_uid"`
	TeamSlug                      string    `json:"team_slug"`
	TeamLogo                      string    `json:"team_logo"`
	TeamAbbreviation              string    `json:"team_abbreviation"`
	TeamColor                     string    `json:"team_color"`
	TeamAlternateColor            string    `json:"team_alternate_color"`
	HomeAway                      string    `json:"home_away"`
	TeamWinner                    bool      `json:"team_winner"`
	TeamScore                     int32     `json:"team_score"`
	OpponentTeamID                int64     `json:"opponent_team_id"`
	OpponentTeamName              *string   `json:"opponent_team_name,omitempty"`
	OpponentTeamLocation          *string   `json:"opponent_team_location,omitempty"`
	OpponentTeamDisplayName       *string   `json:"opponent_team_display_name,omitempty"`
	OpponentTeamAbbreviation      *string   `json:"opponent_team_abbreviation,omitempty"`
	OpponentTeamLogo              *string   `json:"opponent_team_logo,omitempty"`
	OpponentTeamColor             *string   `json:"opponent_team_color,omitempty"`
	OpponentTeamAlternateColor    *string   `json:"opponent_team_alternate_color,omitempty"`
	OpponentTeamScore             *int32    `json:"opponent_team_score,omitempty"`
}
