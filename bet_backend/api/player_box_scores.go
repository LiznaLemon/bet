package api

import (
	"bet/api/models"
	db "bet/db/sqlc"
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type listBoxscoresRequest struct {
	PageID   int32 `form:"page_id" binding:"omitempty,min=1"`
	PageSize int32 `form:"page_size" binding:"omitempty,min=1,max=100"`
}

type listBoxScoresResponse struct {
	Data     []models.BoxScore `json:"data"`
	PageID   int32             `json:"page_id"`
	PageSize int32             `json:"page_size"`
}

// paginatedResponse is a generic paginated response for list endpoints
type paginatedResponse struct {
	Data     interface{} `json:"data"`
	PageID   int32       `json:"page_id"`
	PageSize int32       `json:"page_size"`
}

func (server *Server) ListAllBoxscores(ctx *gin.Context) {
	var req listBoxscoresRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, errorResponse(err))
		return
	}

	if req.PageID == 0 {
		req.PageID = 1
	}
	if req.PageSize == 0 {
		req.PageSize = 10
	}

	arg := db.ListAllBoxscoresParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	boxscores, err := server.store.ListAllBoxscores(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, errorResponse(err))
		return
	}

	if boxscores == nil {
		boxscores = []db.PlayerBoxscoresRaw{}
	}

	data := make([]models.BoxScore, 0, len(boxscores))
	for i := range boxscores {
		data = append(data, rawToBoxScore(boxscores[i]))
	}

	ctx.JSON(http.StatusOK, listBoxScoresResponse{
		Data:     data,
		PageID:   req.PageID,
		PageSize: req.PageSize,
	})
}

func rawToBoxScore(r db.PlayerBoxscoresRaw) models.BoxScore {
	return models.BoxScore{
		GameID:               r.GameID,
		Season:               r.Season,
		SeasonType:           r.SeasonType,
		GameDate:             r.GameDate,
		GameDateTime:         r.GameDateTime,
		AthleteID:            r.AthleteID,
		AthleteDisplayName:   r.AthleteDisplayName,
		TeamID:               r.TeamID,
		TeamName:             r.TeamName,
		TeamLocation:         r.TeamLocation,
		TeamShortDisplayName: r.TeamShortDisplayName,
		Minutes:              nullStringPtr(r.Minutes),
		FieldGoalsMade:       nullInt32Ptr(r.FieldGoalsMade),
		FieldGoalsAttempted:  nullInt32Ptr(r.FieldGoalsAttempted),
		ThreePointFieldGoalsMade:      nullInt32Ptr(r.ThreePointFieldGoalsMade),
		ThreePointFieldGoalsAttempted: nullInt32Ptr(r.ThreePointFieldGoalsAttempted),
		FreeThrowsMade:                nullInt32Ptr(r.FreeThrowsMade),
		FreeThrowsAttempted:           nullInt32Ptr(r.FreeThrowsAttempted),
		OffensiveRebounds:             nullInt32Ptr(r.OffensiveRebounds),
		DefensiveRebounds:             nullInt32Ptr(r.DefensiveRebounds),
		Rebounds:                      nullInt32Ptr(r.Rebounds),
		Assists:                       nullInt32Ptr(r.Assists),
		Steals:                        nullInt32Ptr(r.Steals),
		Blocks:                        nullInt32Ptr(r.Blocks),
		Turnovers:                     nullInt32Ptr(r.Turnovers),
		Fouls:                         nullInt32Ptr(r.Fouls),
		PlusMinus:                     nullStringPtr(r.PlusMinus),
		Points:                        nullInt32Ptr(r.Points),
		Starter:                       nullBoolPtr(r.Starter),
		Ejected:                       nullBoolPtr(r.Ejected),
		DidNotPlay:                    nullBoolPtr(r.DidNotPlay),
		Reason:                        nullStringPtr(r.Reason),
		Active:                        nullBoolPtr(r.Active),
		AthleteJersey:                 nullStringPtr(r.AthleteJersey),
		AthleteShortName:              nullStringPtr(r.AthleteShortName),
		AthleteHeadshotHref:           nullStringPtr(r.AthleteHeadshotHref),
		AthletePositionName:           nullStringPtr(r.AthletePositionName),
		AthletePositionAbbreviation:   nullStringPtr(r.AthletePositionAbbreviation),
		TeamDisplayName:               nullStringVal(r.TeamDisplayName),
		TeamUid:                       nullStringVal(r.TeamUid),
		TeamSlug:                      nullStringVal(r.TeamSlug),
		TeamLogo:                      nullStringVal(r.TeamLogo),
		TeamAbbreviation:              nullStringVal(r.TeamAbbreviation),
		TeamColor:                     nullStringVal(r.TeamColor),
		TeamAlternateColor:            nullStringVal(r.TeamAlternateColor),
		HomeAway:                      nullStringVal(r.HomeAway),
		TeamWinner:                    nullBoolVal(r.TeamWinner),
		TeamScore:                     nullInt32Val(r.TeamScore),
		OpponentTeamID:                nullInt64Val(r.OpponentTeamID),
		OpponentTeamName:              nullStringPtr(r.OpponentTeamName),
		OpponentTeamLocation:          nullStringPtr(r.OpponentTeamLocation),
		OpponentTeamDisplayName:       nullStringPtr(r.OpponentTeamDisplayName),
		OpponentTeamAbbreviation:      nullStringPtr(r.OpponentTeamAbbreviation),
		OpponentTeamLogo:              nullStringPtr(r.OpponentTeamLogo),
		OpponentTeamColor:             nullStringPtr(r.OpponentTeamColor),
		OpponentTeamAlternateColor:    nullStringPtr(r.OpponentTeamAlternateColor),
		OpponentTeamScore:             nullInt32Ptr(r.OpponentTeamScore),
	}
}

func nullStringPtr(n sql.NullString) *string {
	if n.Valid {
		return &n.String
	}
	return nil
}

func nullInt32Ptr(n sql.NullInt32) *int32 {
	if n.Valid {
		return &n.Int32
	}
	return nil
}

func nullBoolPtr(n sql.NullBool) *bool {
	if n.Valid {
		return &n.Bool
	}
	return nil
}

func nullStringVal(n sql.NullString) string {
	if n.Valid {
		return n.String
	}
	return ""
}

func nullBoolVal(n sql.NullBool) bool {
	if n.Valid {
		return n.Bool
	}
	return false
}

func nullInt32Val(n sql.NullInt32) int32 {
	if n.Valid {
		return n.Int32
	}
	return 0
}

func nullInt64Val(n sql.NullInt64) int64 {
	if n.Valid {
		return n.Int64
	}
	return 0
}

func nullTimePtr(n sql.NullTime) *time.Time {
	if n.Valid {
		return &n.Time
	}
	return nil
}

func nullInt64Ptr(n sql.NullInt64) *int64 {
	if n.Valid {
		return &n.Int64
	}
	return nil
}
