package models

import (
	"encoding/json"
	"time"
)

type Schedule struct {
	ID                      *int32          `json:"id,omitempty"`
	Uid                     *string         `json:"uid,omitempty"`
	Date                    *string         `json:"date,omitempty"`
	Attendance              *int32          `json:"attendance,omitempty"`
	TimeValid               *bool           `json:"time_valid,omitempty"`
	NeutralSite             *bool           `json:"neutral_site,omitempty"`
	ConferenceCompetition   *bool           `json:"conference_competition,omitempty"`
	Recent                  *bool           `json:"recent,omitempty"`
	StartDate               *string         `json:"start_date,omitempty"`
	NotesType               *string         `json:"notes_type,omitempty"`
	NotesHeadline           *string         `json:"notes_headline,omitempty"`
	TypeID                  *int32          `json:"type_id,omitempty"`
	TypeAbbreviation        *string         `json:"type_abbreviation,omitempty"`
	VenueID                 *int32          `json:"venue_id,omitempty"`
	VenueFullName           *string         `json:"venue_full_name,omitempty"`
	VenueAddressCity        *string         `json:"venue_address_city,omitempty"`
	VenueCapacity           *int32          `json:"venue_capacity,omitempty"`
	VenueIndoor             *bool           `json:"venue_indoor,omitempty"`
	StatusClock             *int32          `json:"status_clock,omitempty"`
	StatusDisplayClock      *string         `json:"status_display_clock,omitempty"`
	StatusPeriod            *int32          `json:"status_period,omitempty"`
	StatusTypeID            *int32          `json:"status_type_id,omitempty"`
	StatusTypeName          *string         `json:"status_type_name,omitempty"`
	StatusTypeState         *string         `json:"status_type_state,omitempty"`
	StatusTypeCompleted     *bool           `json:"status_type_completed,omitempty"`
	StatusTypeDescription   *string         `json:"status_type_description,omitempty"`
	StatusTypeDetail        *string         `json:"status_type_detail,omitempty"`
	StatusTypeShortDetail   *string         `json:"status_type_short_detail,omitempty"`
	FormatRegulationPeriods *int32          `json:"format_regulation_periods,omitempty"`
	HomeID                  *int32          `json:"home_id,omitempty"`
	HomeUid                 *string         `json:"home_uid,omitempty"`
	HomeLocation            *string         `json:"home_location,omitempty"`
	HomeName                *string         `json:"home_name,omitempty"`
	HomeAbbreviation        *string         `json:"home_abbreviation,omitempty"`
	HomeDisplayName         *string         `json:"home_display_name,omitempty"`
	HomeShortDisplayName    *string         `json:"home_short_display_name,omitempty"`
	HomeColor               *string         `json:"home_color,omitempty"`
	HomeAlternateColor      *string         `json:"home_alternate_color,omitempty"`
	HomeIsActive            *bool           `json:"home_is_active,omitempty"`
	HomeVenueID             *int32          `json:"home_venue_id,omitempty"`
	HomeLogo                *string         `json:"home_logo,omitempty"`
	HomeScore               *int32          `json:"home_score,omitempty"`
	HomeWinner              *bool           `json:"home_winner,omitempty"`
	AwayID                  *int32          `json:"away_id,omitempty"`
	AwayUid                 *string         `json:"away_uid,omitempty"`
	AwayLocation            *string         `json:"away_location,omitempty"`
	AwayName                *string         `json:"away_name,omitempty"`
	AwayAbbreviation        *string         `json:"away_abbreviation,omitempty"`
	AwayDisplayName         *string         `json:"away_display_name,omitempty"`
	AwayShortDisplayName    *string         `json:"away_short_display_name,omitempty"`
	AwayColor               *string         `json:"away_color,omitempty"`
	AwayAlternateColor      *string         `json:"away_alternate_color,omitempty"`
	AwayIsActive            *bool           `json:"away_is_active,omitempty"`
	AwayVenueID             *int32          `json:"away_venue_id,omitempty"`
	AwayLogo                *string         `json:"away_logo,omitempty"`
	AwayScore               *int32          `json:"away_score,omitempty"`
	AwayWinner              *bool           `json:"away_winner,omitempty"`
	GameID                  *int64          `json:"game_id,omitempty"`
	Season                  *int32          `json:"season,omitempty"`
	SeasonType              *int32          `json:"season_type,omitempty"`
	VenueAddressState       *string         `json:"venue_address_state,omitempty"`
	StatusTypeAltDetail     *string         `json:"status_type_alt_detail,omitempty"`
	PBP                     *string         `json:"PBP,omitempty"`
	TeamBox                 *bool           `json:"team_box,omitempty"`
	PlayerBox               *bool           `json:"player_box,omitempty"`
	GameDateTime            *time.Time      `json:"game_date_time,omitempty"`
	GameDate                *time.Time      `json:"game_date,omitempty"`
	PlayByPlayAvailable     *bool           `json:"play_by_play_available,omitempty"`
	Broadcast               *string         `json:"broadcast,omitempty"`
	Highlights              *string         `json:"highlights,omitempty"`
	BroadcastMarket         *string         `json:"broadcast_market,omitempty"`
	BroadcastName           *string         `json:"broadcast_name,omitempty"`
	HomeLinescores          *string         `json:"home_linescores,omitempty"`
	HomeRecords             *string         `json:"home_records,omitempty"`
	AwayLinescores          *string         `json:"away_linescores,omitempty"`
	AwayRecords             *string         `json:"away_records,omitempty"`
	GameJson                json.RawMessage `json:"game_json,omitempty"`
	GameJsonUrl             *string         `json:"game_json_url,omitempty"`
}
