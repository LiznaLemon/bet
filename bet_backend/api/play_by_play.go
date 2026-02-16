package api

import (
	"bet/api/models"
	db "bet/db/sqlc"
	"net/http"

	"github.com/gin-gonic/gin"
)

func rawToPlayByPlay(r db.PlayByPlayRaw) models.PlayByPlay {
	return models.PlayByPlay{
		ID:                           nullStringPtr(r.ID),
		SequenceNumber:               nullStringPtr(r.SequenceNumber),
		TypeID:                       nullInt32Ptr(r.TypeID),
		TypeText:                     nullStringPtr(r.TypeText),
		Text:                         nullStringPtr(r.Text),
		AwayScore:                    nullInt32Ptr(r.AwayScore),
		HomeScore:                    nullInt32Ptr(r.HomeScore),
		PeriodNumber:                 nullInt32Ptr(r.PeriodNumber),
		PeriodDisplayValue:           nullStringPtr(r.PeriodDisplayValue),
		ClockDisplayValue:            nullStringPtr(r.ClockDisplayValue),
		ScoringPlay:                  nullBoolPtr(r.ScoringPlay),
		ScoreValue:                   nullInt32Ptr(r.ScoreValue),
		TeamID:                       nullInt32Ptr(r.TeamID),
		AthleteID1:                   nullInt32Ptr(r.AthleteID1),
		AthleteID2:                   nullInt32Ptr(r.AthleteID2),
		AthleteID3:                   nullInt32Ptr(r.AthleteID3),
		Wallclock:                    nullStringPtr(r.Wallclock),
		ShootingPlay:                 nullBoolPtr(r.ShootingPlay),
		CoordinateXRaw:               nullStringPtr(r.CoordinateXRaw),
		CoordinateYRaw:               nullStringPtr(r.CoordinateYRaw),
		PointsAttempted:              nullInt32Ptr(r.PointsAttempted),
		ShortDescription:             nullStringPtr(r.ShortDescription),
		Season:                       nullInt32Ptr(r.Season),
		SeasonType:                   nullInt32Ptr(r.SeasonType),
		AwayTeamID:                   nullInt32Ptr(r.AwayTeamID),
		AwayTeamName:                 nullStringPtr(r.AwayTeamName),
		AwayTeamMascot:               nullStringPtr(r.AwayTeamMascot),
		AwayTeamAbbrev:               nullStringPtr(r.AwayTeamAbbrev),
		AwayTeamNameAlt:              nullStringPtr(r.AwayTeamNameAlt),
		HomeTeamID:                   nullInt32Ptr(r.HomeTeamID),
		HomeTeamName:                 nullStringPtr(r.HomeTeamName),
		HomeTeamMascot:               nullStringPtr(r.HomeTeamMascot),
		HomeTeamAbbrev:               nullStringPtr(r.HomeTeamAbbrev),
		HomeTeamNameAlt:              nullStringPtr(r.HomeTeamNameAlt),
		HomeTeamSpread:               nullStringPtr(r.HomeTeamSpread),
		GameSpread:                   nullStringPtr(r.GameSpread),
		HomeFavorite:                 nullBoolPtr(r.HomeFavorite),
		GameSpreadAvailable:          nullBoolPtr(r.GameSpreadAvailable),
		GameID:                       nullInt64Ptr(r.GameID),
		Qtr:                          nullInt32Ptr(r.Qtr),
		Time:                         nullStringPtr(r.Time),
		ClockMinutes:                 nullInt32Ptr(r.ClockMinutes),
		ClockSeconds:                 nullStringPtr(r.ClockSeconds),
		Half:                         nullStringPtr(r.Half),
		GameHalf:                     nullStringPtr(r.GameHalf),
		LeadQtr:                      nullInt32Ptr(r.LeadQtr),
		LeadGameHalf:                 nullStringPtr(r.LeadGameHalf),
		LeadHalf:                     nullStringPtr(r.LeadHalf),
		StartQuarterSecondsRemaining: nullStringPtr(r.StartQuarterSecondsRemaining),
		StartHalfSecondsRemaining:    nullStringPtr(r.StartHalfSecondsRemaining),
		StartGameSecondsRemaining:    nullStringPtr(r.StartGameSecondsRemaining),
		GamePlayNumber:               nullInt32Ptr(r.GamePlayNumber),
		EndQuarterSecondsRemaining:   nullStringPtr(r.EndQuarterSecondsRemaining),
		EndHalfSecondsRemaining:      nullStringPtr(r.EndHalfSecondsRemaining),
		EndGameSecondsRemaining:      nullStringPtr(r.EndGameSecondsRemaining),
		Period:                       nullInt32Ptr(r.Period),
		LagQtr:                       nullInt32Ptr(r.LagQtr),
		LagGameHalf:                  nullStringPtr(r.LagGameHalf),
		LagHalf:                     nullStringPtr(r.LagHalf),
		CoordinateX:                  nullStringPtr(r.CoordinateX),
		CoordinateY:                  nullStringPtr(r.CoordinateY),
		GameDate:                     nullTimePtr(r.GameDate),
		GameDateTime:                 nullTimePtr(r.GameDateTime),
		TypeAbbreviation:             nullStringPtr(r.TypeAbbreviation),
		HomeTimeoutCalled:            nullBoolPtr(r.HomeTimeoutCalled),
		AwayTimeoutCalled:            nullBoolPtr(r.AwayTimeoutCalled),
	}
}

func (server *Server) ListPlayByPlay(ctx *gin.Context) {
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

	arg := db.ListPlayByPlayParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	items, err := server.store.ListPlayByPlay(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, errorResponse(err))
		return
	}

	if items == nil {
		items = []db.PlayByPlayRaw{}
	}

	data := make([]models.PlayByPlay, 0, len(items))
	for i := range items {
		data = append(data, rawToPlayByPlay(items[i]))
	}

	ctx.JSON(http.StatusOK, paginatedResponse{
		Data:     data,
		PageID:   req.PageID,
		PageSize: req.PageSize,
	})
}
