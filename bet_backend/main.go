package main

import (
	"bet/api"
	db "bet/db/sqlc"
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

const (
	dbDriver      = "postgres"
	serverAddress = "0.0.0.0:8080"
)

func main() {
	dbSource := os.Getenv("SUPABASE_DB_CON_STRING")
	if dbSource == "" {
		log.Fatal("SUPABASE_DB_CON_STRING environment variable is not set")
	}

	conn, err := sql.Open(dbDriver, dbSource)
	if err != nil {
		log.Fatal("cannot connect to db:", err)
	}

	store := db.NewStore(conn)
	server := api.NewServer(store)

	err = server.Start(serverAddress)
	if err != nil {
		log.Fatal("cannot start server:", err)
	}

	fmt.Println("server is running on port", serverAddress)

}
