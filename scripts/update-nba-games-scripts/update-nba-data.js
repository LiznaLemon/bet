#!/usr/bin/env node

// No dotenv required - use environment variables directly
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get environment variables directly from the system
const supabaseUrl = process.env.SUPABASE_API_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('   - SUPABASE_API_URL is required');
  if (!supabaseKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY is required');
  console.error('Current environment variables available:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// NBA API endpoints
const NBA_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

// Get current date
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
const currentDay = String(today.getDate()).padStart(2, '0');

console.log(`🚀 Starting NBA data update for ${currentYear}-${currentMonth}-${currentDay}`);

// Function to fetch NBA games for a specific date
async function fetchNBAGames(date) {
  try {
    const response = await axios.get(`${NBA_API_BASE}/scoreboard`, {
      params: {
        dates: date,
        limit: 50
      }
    });

    if (response.data && response.data.events) {
      console.log(`📊 Found ${response.data.events.length} games for ${date}`);
      return response.data.events;
    }
    return [];
  } catch (error) {
    console.error(`❌ Error fetching NBA games for ${date}:`, error.message);
    return [];
  }
}

// Function to fetch player box scores for a game
async function fetchPlayerBoxScores(gameId) {
  try {
    const response = await axios.get(`${NBA_API_BASE}/scoreboard/${gameId}/boxscore`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching box scores for game ${gameId}:`, error.message);
    return null;
  }
}

// Function to insert games into Supabase
async function insertGames(games) {
  if (games.length === 0) return;

  const gamesToInsert = games.map(game => ({
    game_id: game.id,
    game_date: game.date,
    season: currentYear,
    season_type: game.season?.type || 2,
    status: game.status?.type?.description || 'Scheduled',
    home_team_id: game.competitions[0]?.competitors.find(c => c.homeAway === 'home')?.team.id,
    away_team_id: game.competitions[0]?.competitors.find(c => c.homeAway === 'away')?.team.id,
    home_score: game.competitions[0]?.competitors.find(c => c.homeAway === 'home')?.score,
    away_score: game.competitions[0]?.competitors.find(c => c.homeAway === 'away')?.score,
    venue: game.competitions[0]?.venue?.fullName,
    created_at: new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from('nba_games')
    .upsert(gamesToInsert, { onConflict: 'game_id' });

  if (error) {
    console.error('❌ Error inserting games:', error);
  } else {
    console.log(`✅ Inserted/Updated ${gamesToInsert.length} games`);
  }
}

// Function to insert player statistics
async function insertPlayerStats(gameId, boxScore) {
  if (!boxScore || !boxScore.players) return;

  const statsToInsert = [];

  boxScore.players.forEach(player => {
    const stats = player.statistics;
    if (stats) {
      statsToInsert.push({
        game_id: gameId,
        player_id: player.athlete.id,
        player_name: player.athlete.displayName,
        team_id: player.team.id,
        minutes_played: stats.minutes,
        points: stats.points,
        rebounds: stats.rebounds,
        assists: stats.assists,
        steals: stats.steals,
        blocks: stats.blocks,
        turnovers: stats.turnovers,
        field_goals_made: stats.fieldGoalsMade,
        field_goals_attempted: stats.fieldGoalsAttempted,
        three_pointers_made: stats.threePointersMade,
        three_pointers_attempted: stats.threePointersAttempted,
        free_throws_made: stats.freeThrowsMade,
        free_throws_attempted: stats.freeThrowsAttempted,
        created_at: new Date().toISOString()
      });
    }
  });

  if (statsToInsert.length > 0) {
    const { data, error } = await supabase
      .from('nba_player_stats')
      .upsert(statsToInsert, { onConflict: 'game_id,player_id' });

    if (error) {
      console.error(`❌ Error inserting stats for game ${gameId}:`, error);
    } else {
      console.log(`✅ Inserted ${statsToInsert.length} player stats for game ${gameId}`);
    }
  }
}

// Main function to run the update
async function updateNBAData() {
  try {
    console.log('🏀 Starting NBA data update...');

    // Fetch today's games
    const games = await fetchNBAGames(`${currentYear}${currentMonth}${currentDay}`);

    if (games.length === 0) {
      console.log('ℹ️ No games found for today');
      return;
    }

    // Insert games
    await insertGames(games);

    // Fetch and insert player stats for completed games
    for (const game of games) {
      const gameStatus = game.status?.type?.description;

      if (gameStatus === 'Final' || gameStatus === 'In Progress') {
        console.log(`📊 Processing game ${game.id}...`);
        const boxScore = await fetchPlayerBoxScores(game.id);
        if (boxScore) {
          await insertPlayerStats(game.id, boxScore);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('✨ NBA data update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating NBA data:', error);
    process.exit(1);
  }
}

updateNBAData();