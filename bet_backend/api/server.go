package api

import (
	db "bet/db/sqlc"

	"github.com/gin-gonic/gin"
)

type Server struct {
	store  *db.Store
	router *gin.Engine
}

// NewServer creates a new HTTP server and setup routing
func NewServer(store *db.Store) *Server {
	server := &Server{store: store}
	router := gin.Default()

	router.GET("/boxscores", server.ListAllBoxscores)
	router.GET("/play-by-play", server.ListPlayByPlay)
	router.GET("/team-boxscores", server.ListTeamBoxscores)
	router.GET("/schedules", server.ListSchedules)

	server.router = router
	return server
}

// Start runs the HTTP server on a specific address
func (server *Server) Start(address string) error {
	return server.router.Run(address)
}

func errorResponse(err error) gin.H {
	return gin.H{"error": err.Error()}
}
