package api

import (
	"bet/api/models"
	db "bet/db/sqlc"
	"net/http"

	"github.com/gin-gonic/gin"
)

func rawToTeamBoxscore(r db.TeamBoxscoresRaw) models.TeamBoxscore {
	return models.TeamBoxscore{
		GameID:                        r.GameID,
		Season:                        r.Season,
		SeasonType:                    r.SeasonType,
		GameDate:                      r.GameDate,
		GameDateTime:                  r.GameDateTime,
		TeamID:                        r.TeamID,
		TeamUid:                       nullStringPtr(r.TeamUid),
		TeamSlug:                      nullStringPtr(r.TeamSlug),
		TeamLocation:                  nullStringPtr(r.TeamLocation),
		TeamName:                      nullStringPtr(r.TeamName),
		TeamAbbreviation:              nullStringPtr(r.TeamAbbreviation),
		TeamDisplayName:               nullStringPtr(r.TeamDisplayName),
		TeamShortDisplayName:          nullStringPtr(r.TeamShortDisplayName),
		TeamColor:                     nullStringPtr(r.TeamColor),
		TeamAlternateColor:            nullStringPtr(r.TeamAlternateColor),
		TeamLogo:                      nullStringPtr(r.TeamLogo),
		TeamHomeAway:                  nullStringPtr(r.TeamHomeAway),
		TeamScore:                     nullInt32Ptr(r.TeamScore),
		TeamWinner:                    nullBoolPtr(r.TeamWinner),
		Assists:                       nullInt32Ptr(r.Assists),
		Blocks:                        nullInt32Ptr(r.Blocks),
		DefensiveRebounds:             nullInt32Ptr(r.DefensiveRebounds),
		FastBreakPoints:               nullStringPtr(r.FastBreakPoints),
		FieldGoalPct:                  nullStringPtr(r.FieldGoalPct),
		FieldGoalsMade:                nullInt32Ptr(r.FieldGoalsMade),
		FieldGoalsAttempted:           nullInt32Ptr(r.FieldGoalsAttempted),
		FlagrantFouls:                 nullInt32Ptr(r.FlagrantFouls),
		Fouls:                         nullInt32Ptr(r.Fouls),
		FreeThrowPct:                  nullStringPtr(r.FreeThrowPct),
		FreeThrowsMade:                nullInt32Ptr(r.FreeThrowsMade),
		FreeThrowsAttempted:           nullInt32Ptr(r.FreeThrowsAttempted),
		LargestLead:                   nullStringPtr(r.LargestLead),
		OffensiveRebounds:             nullInt32Ptr(r.OffensiveRebounds),
		PointsInPaint:                 nullStringPtr(r.PointsInPaint),
		Steals:                        nullInt32Ptr(r.Steals),
		TeamTurnovers:                 nullInt32Ptr(r.TeamTurnovers),
		TechnicalFouls:                nullInt32Ptr(r.TechnicalFouls),
		ThreePointFieldGoalPct:        nullStringPtr(r.ThreePointFieldGoalPct),
		ThreePointFieldGoalsMade:      nullInt32Ptr(r.ThreePointFieldGoalsMade),
		ThreePointFieldGoalsAttempted: nullInt32Ptr(r.ThreePointFieldGoalsAttempted),
		TotalRebounds:                 nullInt32Ptr(r.TotalRebounds),
		TotalTechnicalFouls:           nullInt32Ptr(r.TotalTechnicalFouls),
		TotalTurnovers:                nullInt32Ptr(r.TotalTurnovers),
		TurnoverPoints:                nullStringPtr(r.TurnoverPoints),
		Turnovers:                     nullInt32Ptr(r.Turnovers),
		OpponentTeamID:                nullInt64Ptr(r.OpponentTeamID),
		OpponentTeamUid:               nullStringPtr(r.OpponentTeamUid),
		OpponentTeamSlug:              nullStringPtr(r.OpponentTeamSlug),
		OpponentTeamLocation:          nullStringPtr(r.OpponentTeamLocation),
		OpponentTeamName:              nullStringPtr(r.OpponentTeamName),
		OpponentTeamAbbreviation:      nullStringPtr(r.OpponentTeamAbbreviation),
		OpponentTeamDisplayName:       nullStringPtr(r.OpponentTeamDisplayName),
		OpponentTeamShortDisplayName:  nullStringPtr(r.OpponentTeamShortDisplayName),
		OpponentTeamColor:             nullStringPtr(r.OpponentTeamColor),
		OpponentTeamAlternateColor:    nullStringPtr(r.OpponentTeamAlternateColor),
		OpponentTeamLogo:              nullStringPtr(r.OpponentTeamLogo),
		OpponentTeamScore:             nullInt32Ptr(r.OpponentTeamScore),
	}
}

func (server *Server) ListTeamBoxscores(ctx *gin.Context) {
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

	arg := db.ListTeamBoxscoresParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	items, err := server.store.ListTeamBoxscores(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, errorResponse(err))
		return
	}

	if items == nil {
		items = []db.TeamBoxscoresRaw{}
	}

	data := make([]models.TeamBoxscore, 0, len(items))
	for i := range items {
		data = append(data, rawToTeamBoxscore(items[i]))
	}

	ctx.JSON(http.StatusOK, paginatedResponse{
		Data:     data,
		PageID:   req.PageID,
		PageSize: req.PageSize,
	})
}
