package api

import (
	"bet/api/models"
	db "bet/db/sqlc"
	"net/http"

	"github.com/gin-gonic/gin"
)

func rawToSchedule(r db.Schedule) models.Schedule {
	return models.Schedule{
		ID:                      nullInt32Ptr(r.ID),
		Uid:                     nullStringPtr(r.Uid),
		Date:                    nullStringPtr(r.Date),
		Attendance:              nullInt32Ptr(r.Attendance),
		TimeValid:               nullBoolPtr(r.TimeValid),
		NeutralSite:             nullBoolPtr(r.NeutralSite),
		ConferenceCompetition:   nullBoolPtr(r.ConferenceCompetition),
		Recent:                  nullBoolPtr(r.Recent),
		StartDate:               nullStringPtr(r.StartDate),
		NotesType:               nullStringPtr(r.NotesType),
		NotesHeadline:           nullStringPtr(r.NotesHeadline),
		TypeID:                  nullInt32Ptr(r.TypeID),
		TypeAbbreviation:        nullStringPtr(r.TypeAbbreviation),
		VenueID:                 nullInt32Ptr(r.VenueID),
		VenueFullName:           nullStringPtr(r.VenueFullName),
		VenueAddressCity:        nullStringPtr(r.VenueAddressCity),
		VenueCapacity:           nullInt32Ptr(r.VenueCapacity),
		VenueIndoor:             nullBoolPtr(r.VenueIndoor),
		StatusClock:             nullInt32Ptr(r.StatusClock),
		StatusDisplayClock:      nullStringPtr(r.StatusDisplayClock),
		StatusPeriod:            nullInt32Ptr(r.StatusPeriod),
		StatusTypeID:            nullInt32Ptr(r.StatusTypeID),
		StatusTypeName:          nullStringPtr(r.StatusTypeName),
		StatusTypeState:         nullStringPtr(r.StatusTypeState),
		StatusTypeCompleted:     nullBoolPtr(r.StatusTypeCompleted),
		StatusTypeDescription:   nullStringPtr(r.StatusTypeDescription),
		StatusTypeDetail:        nullStringPtr(r.StatusTypeDetail),
		StatusTypeShortDetail:   nullStringPtr(r.StatusTypeShortDetail),
		FormatRegulationPeriods: nullInt32Ptr(r.FormatRegulationPeriods),
		HomeID:                  nullInt32Ptr(r.HomeID),
		HomeUid:                 nullStringPtr(r.HomeUid),
		HomeLocation:            nullStringPtr(r.HomeLocation),
		HomeName:                nullStringPtr(r.HomeName),
		HomeAbbreviation:        nullStringPtr(r.HomeAbbreviation),
		HomeDisplayName:         nullStringPtr(r.HomeDisplayName),
		HomeShortDisplayName:    nullStringPtr(r.HomeShortDisplayName),
		HomeColor:               nullStringPtr(r.HomeColor),
		HomeAlternateColor:      nullStringPtr(r.HomeAlternateColor),
		HomeIsActive:            nullBoolPtr(r.HomeIsActive),
		HomeVenueID:             nullInt32Ptr(r.HomeVenueID),
		HomeLogo:                nullStringPtr(r.HomeLogo),
		HomeScore:               nullInt32Ptr(r.HomeScore),
		HomeWinner:              nullBoolPtr(r.HomeWinner),
		AwayID:                  nullInt32Ptr(r.AwayID),
		AwayUid:                 nullStringPtr(r.AwayUid),
		AwayLocation:            nullStringPtr(r.AwayLocation),
		AwayName:                nullStringPtr(r.AwayName),
		AwayAbbreviation:        nullStringPtr(r.AwayAbbreviation),
		AwayDisplayName:         nullStringPtr(r.AwayDisplayName),
		AwayShortDisplayName:    nullStringPtr(r.AwayShortDisplayName),
		AwayColor:               nullStringPtr(r.AwayColor),
		AwayAlternateColor:      nullStringPtr(r.AwayAlternateColor),
		AwayIsActive:            nullBoolPtr(r.AwayIsActive),
		AwayVenueID:             nullInt32Ptr(r.AwayVenueID),
		AwayLogo:                nullStringPtr(r.AwayLogo),
		AwayScore:               nullInt32Ptr(r.AwayScore),
		AwayWinner:              nullBoolPtr(r.AwayWinner),
		GameID:                  nullInt64Ptr(r.GameID),
		Season:                  nullInt32Ptr(r.Season),
		SeasonType:              nullInt32Ptr(r.SeasonType),
		VenueAddressState:       nullStringPtr(r.VenueAddressState),
		StatusTypeAltDetail:     nullStringPtr(r.StatusTypeAltDetail),
		PBP:                     nullStringPtr(r.PBP),
		TeamBox:                 nullBoolPtr(r.TeamBox),
		PlayerBox:               nullBoolPtr(r.PlayerBox),
		GameDateTime:            nullTimePtr(r.GameDateTime),
		GameDate:                nullTimePtr(r.GameDate),
		PlayByPlayAvailable:     nullBoolPtr(r.PlayByPlayAvailable),
		Broadcast:               nullStringPtr(r.Broadcast),
		Highlights:              nullStringPtr(r.Highlights),
		BroadcastMarket:         nullStringPtr(r.BroadcastMarket),
		BroadcastName:           nullStringPtr(r.BroadcastName),
		HomeLinescores:          nullStringPtr(r.HomeLinescores),
		HomeRecords:             nullStringPtr(r.HomeRecords),
		AwayLinescores:          nullStringPtr(r.AwayLinescores),
		AwayRecords:             nullStringPtr(r.AwayRecords),
		GameJson:                r.GameJson,
		GameJsonUrl:             nullStringPtr(r.GameJsonUrl),
	}
}

func (server *Server) ListSchedules(ctx *gin.Context) {
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

	arg := db.ListSchedulesParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	items, err := server.store.ListSchedules(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, errorResponse(err))
		return
	}

	if items == nil {
		items = []db.Schedule{}
	}

	data := make([]models.Schedule, 0, len(items))
	for i := range items {
		data = append(data, rawToSchedule(items[i]))
	}

	ctx.JSON(http.StatusOK, paginatedResponse{
		Data:     data,
		PageID:   req.PageID,
		PageSize: req.PageSize,
	})
}
