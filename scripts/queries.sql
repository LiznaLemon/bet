SELECT game_id, 
	   game_date,
	   -- season,
	   season_type,
	   team_name,
	   home_away,
	   opponent_team_name,
	   CASE 
	     WHEN team_winner = true THEN 'Win'
	     WHEN team_winner = false THEN 'Loss'
	     ELSE NULL
	   END AS "W/L",
	   athlete_display_name,
	   active,
	   starter,
	   ejected,
	   did_not_play,
	   minutes,
	   points,
	   COALESCE(ROUND(AVG((points::numeric))
	   		OVER (ORDER BY game_date
			   	  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 1),0) AS PPG_Before,
	   COALESCE(ROUND(AVG((points::numeric))
			OVER (ORDER BY game_date
				  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 1),0) AS PPG_After,
				
	   field_goals_made AS FGM,
	   field_goals_attempted AS FGA,
	   ROUND((field_goals_made::numeric / NULLIF(field_goals_attempted::numeric, 0)) * 100, 1) AS "FG%",
	   COALESCE(ROUND(AVG((field_goals_made::numeric / NULLIF(field_goals_attempted::numeric, 0)) * 100) 
	         OVER (ORDER BY game_date 
	               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 1),0) AS "AFG%_Before",
	   ROUND(AVG((field_goals_made::numeric / NULLIF(field_goals_attempted::numeric, 0)) * 100)
	         OVER (ORDER BY game_date
	               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 1) AS "AFG%_After",
	   ROUND((points::numeric / NULLIF((2 * (field_goals_attempted + 0.44 * free_throws_attempted))::numeric, 0)) * 100, 2) as TSP,
	   three_point_field_goals_made AS "3PM",
	   three_point_field_goals_attempted AS "3PA",
	   ROUND((three_point_field_goals_made::numeric / NULLIF(three_point_field_goals_attempted::numeric, 0)) * 100, 2) as "3P%",
	   free_throws_made AS FTM,
	   free_throws_attempted AS FTA,
	   ROUND((free_throws_made::numeric / NULLIF(free_throws_attempted::numeric, 0)) * 100, 1) AS "FT%"
	   -- offensive_rebounds,
	   -- defensive_rebounds,
	   -- rebounds,
	   -- assists,
	   -- steals,
	   -- blocks,
	   -- turnovers,
	   -- fouls
FROM player_boxscores_raw
WHERE athlete_id = 3945274
AND game_id != 401809839
ORDER BY game_date;

