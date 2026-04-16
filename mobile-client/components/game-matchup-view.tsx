import { FilterOptionButtons } from '@/components/filter-option-buttons';
import { GameMatchupDisplay } from '@/components/game-matchup-display';
import { InsightCarousel } from '@/components/insight-carousel';
import { PlayerAvatar } from '@/components/player-avatar';
import { SimilarPlayersModal } from '@/components/similar-players-modal';
import {
  TEAM_COMPARISON_LABEL_COLUMN_WIDTH,
  TEAM_COMPARISON_ROW_GAP,
  TeamComparisonBar,
} from '@/components/team-comparison-bar';
import { ThemedText } from '@/components/themed-text';
import { getTeamColor } from '@/constants/team-colors';
import { Colors, gradientFadeClear } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDisplayPreferences } from '@/lib/display-preferences';
import { PROP_STAT_OPTIONS, PROP_STAT_PLAYER_ROW_LABEL } from '@/lib/constants/prop-stat-ui';
import {
  getPlayerSeasonAvgFromTotals,
  getSeasonAvgFromGameLog,
  getStatFromGameLog,
} from '@/lib/props/compute-prop-stats';
import { type ESPNInjuryEntry } from '@/lib/queries/espn-live-game';
import { type GameBoxScore, useGameBoxScores } from '@/lib/queries/game-boxscores';
import { usePlayerStatRanks } from '@/lib/queries/players';
import { usePreviousMatchups } from '@/lib/queries/schedule';
import { useTeamMatchupContext } from '@/lib/queries/team-matchup-context';
import { useGameMatchupBundle } from '@/lib/queries/team-offensive-stats';
import { supabase } from '@/lib/supabase';
import type { GameLogEntry, Player, ScheduleGame } from '@/lib/types';
import type { PropStatKey } from '@/lib/types/props';
import {
  aggregateBoxScoresByTeam,
} from '@/lib/utils/game-team-stats';
import { athleteIdsOutFromInjuries } from '@/lib/utils/injury-roster';
import { getLeagueRank } from '@/lib/utils/league-team-rank';
import type { MatchupPointInTimeStats } from '@/lib/utils/matchup-insights';
import {
  computePlayerMatchupInsights,
  computeTeamMatchupInsights,
  getMatchupEligiblePlayers,
  teamMatches,
} from '@/lib/utils/matchup-insights';
import type { SimilarPlayerWithGames } from '@/lib/utils/player-similarity';
import { formatPlayerName } from '@/lib/utils/player-display';
import { getAbbrevAliases, toThreeLetterAbbrev } from '@/lib/utils/team-abbreviation';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

const SEASON = 2026;

/** Injury "lead X is out" lines only: box / shooting roles, not minutes or turnovers. */
const PROP_STATS_FOR_INJURY_LEAD_HIGHLIGHT: PropStatKey[] = PROP_STAT_OPTIONS.map((o) => o.key).filter(
  (k) => k !== 'minutes' && k !== 'turnovers'
);

function buildPropStatPitByPlayerId(
  playerList: Player[],
  gameDate: string | null
): Record<string, Record<PropStatKey, number>> {
  const result: Record<string, Record<PropStatKey, number>> = {};
  for (const p of playerList) {
    const log = (p.game_log ?? []) as GameLogEntry[];
    const filtered = gameDate ? log.filter((g) => (g.game_date ?? '') < gameDate) : log;
    const row = {} as Record<PropStatKey, number>;
    for (const { key } of PROP_STAT_OPTIONS) {
      row[key] =
        filtered.length > 0
          ? getSeasonAvgFromGameLog(filtered, key)
          : getPlayerSeasonAvgFromTotals(p, key);
    }
    result[p.athlete_id] = row;
  }
  return result;
}

function otherPropStatKeysForRow(selected: PropStatKey): PropStatKey[] {
  return PROP_STAT_OPTIONS.map((o) => o.key).filter((k) => k !== selected).slice(0, 3);
}

function getLeadRoleNoun(stat: PropStatKey): string {
  const map: Record<PropStatKey, string> = {
    points: 'scorer',
    rebounds: 'rebounder',
    assists: 'passer',
    steals: 'steal leader',
    blocks: 'shot blocker',
    minutes: 'minutes leader',
    turnovers: 'turnovers leader',
    fouls: 'fouls leader',
    two_pt_made: 'two-point maker',
    three_pt_made: 'three-point shooter',
    free_throws_made: 'free throw shooter',
  };
  return map[stat];
}

function joinLeadRoles(roles: string[]): string {
  if (roles.length === 0) return '';
  if (roles.length === 1) return roles[0];
  if (roles.length === 2) return `${roles[0]} and ${roles[1]}`;
  return `${roles.slice(0, -1).join(', ')}, and ${roles[roles.length - 1]}`;
}

function formatSidelinedLeaderBody(
  teamAbbrev: string,
  playerDisplayName: string,
  stats: Array<{ stat: PropStatKey; value: number }>
): string {
  const rolesPhrase = joinLeadRoles(stats.map((s) => getLeadRoleNoun(s.stat)));
  return `Lead ${teamAbbrev} ${rolesPhrase} ${playerDisplayName} is listed out.`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getGamesVsOpponent(gameLog: GameLogEntry[], opp: string): GameLogEntry[] {
  const aliases = new Set(getAbbrevAliases(opp).map((a) => a.toUpperCase().trim()));
  return (gameLog ?? []).filter((g) =>
    aliases.has((g.opponent_team_abbreviation ?? '').toUpperCase().trim())
  );
}

function propStatShortLabel(stat: PropStatKey): string {
  return PROP_STAT_OPTIONS.find((o) => o.key === stat)?.label ?? PROP_STAT_PLAYER_ROW_LABEL[stat];
}

function propStatToRankField(stat: PropStatKey): 'ppg_rank' | 'rpg_rank' | 'apg_rank' | 'spg_rank' | 'bpg_rank' | 'three_pm_rank' | null {
  const map: Partial<Record<PropStatKey, 'ppg_rank' | 'rpg_rank' | 'apg_rank' | 'spg_rank' | 'bpg_rank' | 'three_pm_rank'>> = {
    points: 'ppg_rank',
    rebounds: 'rpg_rank',
    assists: 'apg_rank',
    steals: 'spg_rank',
    blocks: 'bpg_rank',
    three_pt_made: 'three_pm_rank',
  };
  return map[stat] ?? null;
}

function propStatToAvgField(stat: PropStatKey): 'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg' | 'three_pm' | null {
  const map: Partial<Record<PropStatKey, 'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg' | 'three_pm'>> = {
    points: 'ppg',
    rebounds: 'rpg',
    assists: 'apg',
    steals: 'spg',
    blocks: 'bpg',
    three_pt_made: 'three_pm',
  };
  return map[stat] ?? null;
}

function formatVsOpponentSingleGameValue(val: number): string {
  if (Number.isInteger(val) || Math.abs(val - Math.round(val)) < 1e-6) {
    return String(Math.round(val));
  }
  return val.toFixed(1);
}

function getMatchupTeamColors(awayAbbrev: string, homeAbbrev: string): { awayColor: string; homeColor: string } {
  return {
    awayColor: getTeamColor(awayAbbrev),
    homeColor: getTeamColor(homeAbbrev),
  };
}

type GameMatchupViewProps = {
  game: ScheduleGame;
  players: Player[];
  boxScores: GameBoxScore[];
  injuries?: ESPNInjuryEntry[];
  /** ISO time from ESPN fetch; used for live/upcoming game freshness copy. */
  liveDataFetchedAt?: string;
  /** ISO timestamp of the stored snapshot; shown for completed historical games. */
  injurySnapshotCapturedAt?: string;
  /** Enriched schedule slice (e.g. game day ±1) for team records / B2B matching the schedule tab. */
  scheduleGames?: ScheduleGame[];
};

// ─── Injury Marquee ──────────────────────────────────────────────────────────

const MARQUEE_PX_PER_MS = 0.05; // scroll speed
const MARQUEE_FADE = 32;

function injuryStatusColor(status: string, textSecondary: string, statusLive: string): string {
  const s = status.toLowerCase();
  if (s.includes('out')) return statusLive;
  if (s.includes('day') || s === 'dtd') return '#ff9800';
  if (s.includes('quest')) return '#ffc107';
  return textSecondary;
}

function InjuryMarquee({ injuries }: { injuries: ESPNInjuryEntry[] }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { nameFormat } = useDisplayPreferences();
  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const [singleWidth, setSingleWidth] = useState(0);

  useEffect(() => {
    if (singleWidth <= 0) return;
    animRef.current?.stop();
    translateX.setValue(0);
    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: -singleWidth,
        duration: singleWidth / MARQUEE_PX_PER_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animRef.current.start();
    return () => { animRef.current?.stop(); };
  }, [singleWidth, translateX]);

  const renderItem = (inj: ESPNInjuryEntry, key: string) => (
    <View key={key} style={marqueeStyles.item}>
      <PlayerAvatar uri={inj.headshotUrl} displayName={inj.playerName} teamAbbrev={inj.teamAbbrev} size={36} />
      <View style={marqueeStyles.meta}>
        <Text style={marqueeStyles.name} numberOfLines={1}>
          <Text style={{ color: colors.text }}>{formatPlayerName(inj.playerName, nameFormat)}</Text>
          {inj.teamAbbrev ? (
            <Text style={[marqueeStyles.name, marqueeStyles.teamAbbrev, { color: colors.textSecondary }]}>
              {` (${inj.teamAbbrev})`}
            </Text>
          ) : null}
        </Text>
        <Text
          style={[
            marqueeStyles.status,
            { color: injuryStatusColor(inj.status, colors.textSecondary, colors.statusLive) },
          ]}
          numberOfLines={1}>
          {inj.status}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[marqueeStyles.wrapper, { backgroundColor: 'transparent' }]}>
      <Animated.View
        style={[marqueeStyles.track, { transform: [{ translateX }] }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setSingleWidth(w / 2);
        }}
      >
        {injuries.map((inj, i) => renderItem(inj, `a-${i}`))}
        {injuries.map((inj, i) => renderItem(inj, `b-${i}`))}
      </Animated.View>
      <LinearGradient
        colors={[colors.background, gradientFadeClear(colors.background)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[marqueeStyles.fade, marqueeStyles.fadeLeft]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[gradientFadeClear(colors.background), colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[marqueeStyles.fade, marqueeStyles.fadeRight]}
        pointerEvents="none"
      />
    </View>
  );
}

const marqueeStyles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    position: 'relative',
    height: 52,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginRight: 24,
  },
  meta: {
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  teamAbbrev: {
    fontSize: 13,
    fontWeight: '400',
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
  },
  fade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: MARQUEE_FADE,
    zIndex: 1,
  },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
});

// ─── Matchup Summary ─────────────────────────────────────────────────────────

type SummarySpan = {
  text: string;
  bold?: boolean;
  accent?: string;
};

function buildIntroParts(
  displayAwayAbbrev: string,
  displayHomeAbbrev: string,
  awayRecord: string | null | undefined,
  homeRecord: string | null | undefined,
  awayRecentResults: { wins: number; losses: number; results: ('W' | 'L')[] } | undefined,
  homeRecentResults: { wins: number; losses: number; results: ('W' | 'L')[] } | undefined,
  awayBackToBack: boolean | undefined,
  homeBackToBack: boolean | undefined,
  seasonSeriesSummaryText: string | null,
  awayB2BContext?: import('@/lib/types').B2BContext,
  homeB2BContext?: import('@/lib/types').B2BContext
): SummarySpan[] {
  const spans: SummarySpan[] = [];
  const push = (text: string) => spans.push({ text });
  const pushBold = (text: string, accent?: string) => spans.push({ text, bold: true, accent });

  let sentences = 0;

  const describeRecent = (abbrev: string, record: string | null | undefined, recent: typeof awayRecentResults) => {
    if (sentences > 0) push(' ');
    pushBold(abbrev);
    if (record) { push(' ('); pushBold(record); push(')'); }
    if (!recent || recent.results.length === 0) { push('.'); sentences++; return; }
    let streak = 0;
    const first = recent.results[0];
    for (const r of recent.results) { if (r !== first) break; streak++; }
    const wins = recent.results.filter((r) => r === 'W').length;
    const n = recent.results.length;
    if (streak >= n) {
      const kind = first === 'W' ? 'winning' : 'losing';
      push(' are on a ');
      pushBold(`${streak}-game ${kind} streak`, first === 'W' ? '#4caf50' : '#e05252');
    } else if (streak >= 3) {
      const kind = first === 'W' ? 'winning' : 'losing';
      push(' are on a ');
      pushBold(`${streak}-game ${kind} streak`, first === 'W' ? '#4caf50' : '#e05252');
      push(', going ');
      pushBold(`${wins}-${n - wins}`);
      push(` over their last ${n}`);
    } else {
      push(wins > n / 2 ? ' have won ' : wins < n / 2 ? ' have lost ' : ' split ');
      pushBold(`${wins} of ${n}`);
      push(' recent games');
    }
    push('.');
    sentences++;
  };

  describeRecent(displayAwayAbbrev, awayRecord, awayRecentResults);
  describeRecent(displayHomeAbbrev, homeRecord, homeRecentResults);

  const b2bEntries: Array<{ abbrev: string; ctx: import('@/lib/types').B2BContext | undefined }> = [
    ...(awayBackToBack ? [{ abbrev: displayAwayAbbrev, ctx: awayB2BContext }] : []),
    ...(homeBackToBack ? [{ abbrev: displayHomeAbbrev, ctx: homeB2BContext }] : []),
  ];
  for (const { abbrev, ctx } of b2bEntries) {
    if (sentences > 0) push(' ');
    pushBold(abbrev);
    push(' is playing back to back tonight');
    if (ctx?.hasResult) {
      const verb = ctx.won ? ' after beating ' : ' after losing to ';
      const venue = ctx.wasHome ? ' at home' : ' on the road';
      push(verb);
      pushBold(ctx.opponentAbbrev);
      push(venue);
    }
    push('.');
    sentences++;
  }

  if (seasonSeriesSummaryText) {
    if (sentences > 0) push(' ');
    const match = seasonSeriesSummaryText.match(/(\d+)[–\-](\d+)/);
    if (match) {
      const idx = seasonSeriesSummaryText.indexOf(match[0]);
      push(seasonSeriesSummaryText.slice(0, idx));
      pushBold(match[0]);
      push(seasonSeriesSummaryText.slice(idx + match[0].length));
    } else {
      push(seasonSeriesSummaryText);
    }
  }

  return spans;
}

type SidelinedLine = { teamAbbrev: string; player: Player; stats: Array<{ stat: PropStatKey; value: number }> };

/** Stats shown in the grouped "X are out" inline sentence — excludes free throws, fouls, two-pointers. */
const SUMMARY_GROUPED_STATS = new Set<PropStatKey>(['points', 'rebounds', 'assists', 'steals', 'blocks', 'three_pt_made']);

function SidelinedGroupedLines({
  lines,
  textColor,
  mutedColor,
  nameFormat,
}: {
  lines: SidelinedLine[];
  textColor: string;
  mutedColor: string;
  nameFormat: 'full' | 'initial_last';
}) {
  // Group by team, filtering to relevant stats only
  const teamGroups: Array<{ teamAbbrev: string; players: Array<{ player: Player; roles: string[] }> }> = [];
  const teamMap = new Map<string, Map<string, { player: Player; roles: string[] }>>();
  for (const line of lines) {
    const roles = line.stats
      .filter((s) => SUMMARY_GROUPED_STATS.has(s.stat))
      .map((s) => getLeadRoleNoun(s.stat));
    if (roles.length === 0) continue;
    if (!teamMap.has(line.teamAbbrev)) teamMap.set(line.teamAbbrev, new Map());
    const pm = teamMap.get(line.teamAbbrev)!;
    if (!pm.has(line.player.athlete_id)) pm.set(line.player.athlete_id, { player: line.player, roles });
  }
  for (const [teamAbbrev, pm] of teamMap) {
    teamGroups.push({ teamAbbrev, players: [...pm.values()] });
  }

  if (teamGroups.length === 0) return null;

  return (
    <>
      {teamGroups.map(({ teamAbbrev, players }) => {
        const verb = players.length === 1 ? 'is' : 'are';
        return (
          <View key={teamAbbrev} style={summaryStyles.groupedLine}>
            <ThemedText style={[summaryStyles.paragraph, { color: mutedColor }]}>
              <ThemedText style={[summaryStyles.bold, { color: textColor }]}>{teamAbbrev}{`'s`}</ThemedText>
            </ThemedText>
            {players.map((p, i) => {
              const isFirst = i === 0;
              const isLast = i === players.length - 1;
              const sep =
                isFirst ? ' lead ' :
                isLast && players.length === 2 ? ' and lead ' :
                isLast ? ', and lead ' :
                ', lead ';
              const rolesStr = joinLeadRoles(p.roles);
              return (
                <View key={p.player.athlete_id} style={summaryStyles.inlineChunk}>
                  <ThemedText style={[summaryStyles.paragraph, { color: mutedColor }]}>
                    {sep + rolesStr + ' '}
                  </ThemedText>
                  <View style={summaryStyles.inlineMention}>
                    <PlayerAvatar
                      uri={p.player.athlete_headshot_href}
                      displayName={p.player.athlete_display_name}
                      teamAbbrev={p.player.team_abbreviation}
                      size={22}
                      style={summaryStyles.inlineAvatar}
                    />
                    <ThemedText style={[summaryStyles.paragraph, summaryStyles.bold, summaryStyles.outAccent]}>
                      {formatPlayerName(p.player.athlete_display_name, nameFormat)}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
            <ThemedText style={[summaryStyles.paragraph, { color: mutedColor }]}>{` ${verb} `}</ThemedText>
            <ThemedText style={[summaryStyles.paragraph, summaryStyles.bold, summaryStyles.outAccent]}>out</ThemedText>
            <ThemedText style={[summaryStyles.paragraph, { color: mutedColor }]}>{'.'}</ThemedText>
          </View>
        );
      })}
    </>
  );
}

function MatchupSummarySection({
  game,
  displayAwayAbbrev,
  displayHomeAbbrev,
  awayRecentResults,
  homeRecentResults,
  sidelinedStatLeaderLines,
  seasonSeriesSummaryText,
  textColor,
  mutedColor,
  nameFormat,
  isLoading,
}: {
  game: ScheduleGame;
  displayAwayAbbrev: string;
  displayHomeAbbrev: string;
  awayRecentResults: { wins: number; losses: number; results: ('W' | 'L')[] } | undefined;
  homeRecentResults: { wins: number; losses: number; results: ('W' | 'L')[] } | undefined;
  sidelinedStatLeaderLines: SidelinedLine[];
  seasonSeriesSummaryText: string | null;
  textColor: string;
  mutedColor: string;
  nameFormat: 'full' | 'initial_last';
  isLoading: boolean;
}) {
  const introSpans = buildIntroParts(
    displayAwayAbbrev,
    displayHomeAbbrev,
    game.awayRecord,
    game.homeRecord,
    awayRecentResults,
    homeRecentResults,
    game.awayBackToBack,
    game.homeBackToBack,
    seasonSeriesSummaryText,
    game.awayB2BContext,
    game.homeB2BContext
  );

  if (introSpans.length === 0 && sidelinedStatLeaderLines.length === 0) {
    // While loading, reserve the space so content popping in doesn't shift the layout below.
    if (isLoading) return <View style={summaryStyles.container} />;
    return null;
  }

  return (
    <View style={summaryStyles.container}>
      {introSpans.length > 0 && (
        <Text style={[summaryStyles.paragraph, { color: mutedColor }]}>
          {introSpans.map((span, i) => (
            <Text
              key={i}
              style={[
                span.bold ? summaryStyles.bold : null,
                span.accent
                  ? { color: span.accent }
                  : span.bold
                    ? { color: textColor }
                    : null,
              ]}
            >
              {span.text}
            </Text>
          ))}
        </Text>
      )}
      {/* OLD: separate avatar rows per player
      {sidelinedStatLeaderLines.map((line) => {
        const rolesPhrase = joinLeadRoles(line.stats.map((s) => getLeadRoleNoun(s.stat)));
        return (
          <View key={`${line.teamAbbrev}-${line.player.athlete_id}`} style={summaryStyles.playerRow}>
            <PlayerAvatar uri={line.player.athlete_headshot_href} size={28} />
            <Text style={[summaryStyles.paragraph, summaryStyles.playerRowText, { color: mutedColor }]}>
              <Text style={[summaryStyles.bold, summaryStyles.outAccent]}>{line.player.athlete_display_name}</Text>
              <Text>{` (${line.teamAbbrev} lead ${rolesPhrase}) is `}</Text>
              <Text style={[summaryStyles.bold, summaryStyles.outAccent]}>out</Text>
              <Text>{'.'}</Text>
            </Text>
          </View>
        );
      })}
      */}
      <SidelinedGroupedLines
        lines={sidelinedStatLeaderLines}
        textColor={textColor}
        mutedColor={mutedColor}
        nameFormat={nameFormat}
      />
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  container: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(37, 37, 37, 0.5)',
    gap: 10,
  },
  paragraph: {
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  bold: {
    fontWeight: '700',
  },
  outAccent: {
    color: '#e05252',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerRowText: {
    flex: 1,
  },
  inlineAvatar: {
    marginLeft: 2,
    marginRight: 8,
  },
  groupedLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  inlineChunk: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  inlineMention: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function GameMatchupView({
  game,
  players,
  boxScores,
  injuries = [],
  liveDataFetchedAt,
  injurySnapshotCapturedAt,
  scheduleGames,
}: GameMatchupViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { nameFormat } = useDisplayPreferences();

  const {
    data: matchupBundle,
    isLoading: bundleLoading,
    isError: bundleError,
  } = useGameMatchupBundle(SEASON);
  const teamDefenseSeason = matchupBundle?.teamDefensiveAllModes?.season ?? [];
  const teamDefenseLast10 = matchupBundle?.teamDefensiveAllModes?.last10 ?? [];
  const teamDefenseLast5 = matchupBundle?.teamDefensiveAllModes?.last5 ?? [];
  const teamOffensiveSeason = matchupBundle?.teamOffensiveAllModes?.season ?? [];
  const teamOffensiveLast10 = matchupBundle?.teamOffensiveAllModes?.last10 ?? [];
  const teamOffensiveLast5 = matchupBundle?.teamOffensiveAllModes?.last5 ?? [];
  const leagueVariance = matchupBundle?.leagueVariance ?? null;
  const teamDefenseLoading = bundleLoading;
  const teamDefenseError = bundleError;
  const teamOffensiveLoading = bundleLoading;
  const teamOffensiveSeasonError = bundleError;

  const { data: matchupContext, isLoading: matchupContextLoading } = useTeamMatchupContext(
    game.awayTeamAbbrev,
    game.homeTeamAbbrev,
    SEASON,
    5,
    // For past games, filter results to before the game date so streaks are point-in-time.
    // Upcoming games use null (no filter) to get current standings.
    game.completed ? game.gameDate : null
  );
  const awayRecentResults = matchupContext?.awayRecentResults;
  const homeRecentResults = matchupContext?.homeRecentResults;
  const activeAwayIds = matchupContext?.activeAwayIds ?? new Set<string>();
  const activeHomeIds = matchupContext?.activeHomeIds ?? new Set<string>();

  const [breakdownMode, setBreakdownMode] = useState<'season' | 'last10' | 'last5'>('season');
  const [breakdownStatType, setBreakdownStatType] = useState<'offense' | 'defense'>('offense');
  const [previousMatchupIndex, setPreviousMatchupIndex] = useState(0);
  const [previousMatchupExpanded, setPreviousMatchupExpanded] = useState(false);
  const [keyMatchupStat, setKeyMatchupStat] = useState<PropStatKey>('points');

  const displayAwayAbbrev = useMemo(
    () => toThreeLetterAbbrev((game.awayTeamAbbrev ?? '').toUpperCase().trim()),
    [game.awayTeamAbbrev]
  );
  const displayHomeAbbrev = useMemo(
    () => toThreeLetterAbbrev((game.homeTeamAbbrev ?? '').toUpperCase().trim()),
    [game.homeTeamAbbrev]
  );

  const { data: previousMatchups = [], isLoading: previousMatchupsLoading } = usePreviousMatchups(
    game.homeTeamAbbrev,
    game.awayTeamAbbrev,
    SEASON,
    game.id
  );
  const selectedPreviousGame = previousMatchups[previousMatchupIndex] ?? null;
  const { data: previousBoxScores = [], isLoading: previousBoxScoresLoading } = useGameBoxScores(
    selectedPreviousGame?.id,
    SEASON
  );

  const previousMatchupStats = useMemo(() => {
    if (!selectedPreviousGame || !previousBoxScores.length) return null;
    return aggregateBoxScoresByTeam(
      previousBoxScores,
      game.awayTeamAbbrev ?? '',
      game.homeTeamAbbrev ?? ''
    );
  }, [selectedPreviousGame, previousBoxScores, game.awayTeamAbbrev, game.homeTeamAbbrev]);

  const previousScoreDisplay = useMemo(() => {
    if (!selectedPreviousGame || selectedPreviousGame.awayScore == null || selectedPreviousGame.homeScore == null) return null;
    const awayAbbrev = toThreeLetterAbbrev((game.awayTeamAbbrev ?? '').toUpperCase().trim());
    const homeAbbrev = toThreeLetterAbbrev((game.homeTeamAbbrev ?? '').toUpperCase().trim());
    const prevAway = toThreeLetterAbbrev((selectedPreviousGame.awayTeamAbbrev ?? '').toUpperCase().trim());
    const prevAwayScore = selectedPreviousGame.awayScore;
    const prevHomeScore = selectedPreviousGame.homeScore;
    const leftScore = prevAway === awayAbbrev ? prevAwayScore : prevHomeScore;
    const rightScore = prevAway === awayAbbrev ? prevHomeScore : prevAwayScore;
    const leftWon = leftScore > rightScore;
    const rightWon = rightScore > leftScore;
    const isTie = leftScore === rightScore;
    return { leftScore, rightScore, leftWon, rightWon, isTie };
  }, [selectedPreviousGame, game]);

  const [similarModalPlayer, setSimilarModalPlayer] = useState<{
    player: Player;
    similarPlayers: SimilarPlayerWithGames[] | null;
    isLoading: boolean;
  } | null>(null);

  const openSimilarModal = useCallback(
    async (player: Player) => {
      setSimilarModalPlayer({ player, similarPlayers: null, isLoading: true });
      try {
        const opp =
          toThreeLetterAbbrev((player.team_abbreviation ?? '').toUpperCase()) === displayHomeAbbrev
            ? displayAwayAbbrev
            : displayHomeAbbrev;
        const { data, error } = await supabase.rpc('get_similar_players', {
          p_athlete_id: player.athlete_id,
          p_opponent_abbrev: opp,
          p_season: SEASON,
          p_season_type: 2,
          p_k: 5,
        });
        if (error) throw error;
        const similar: SimilarPlayerWithGames[] = (data ?? []).map((row: Record<string, unknown>) => ({
          player: {
            athlete_id: String(row.athlete_id ?? ''),
            athlete_display_name: String(row.athlete_display_name ?? ''),
            athlete_headshot_href: String(row.athlete_headshot_href ?? ''),
            athlete_position_abbreviation: String(row.athlete_position_abbreviation ?? ''),
            team_abbreviation: String(row.team_abbreviation ?? ''),
            ppg: String(row.ppg ?? '0'),
            rpg: String(row.rpg ?? '0'),
            apg: String(row.apg ?? '0'),
            game_log: [],
          } as unknown as Player,
          similarityScore: Number(row.similarity_score ?? 0),
          gamesVsOpponent: (row.vs_game_log ?? []) as GameLogEntry[],
          avgPts: Number(row.avg_pts_vs ?? 0),
          avgReb: Number(row.avg_reb_vs ?? 0),
          avgAst: Number(row.avg_ast_vs ?? 0),
        }));
        setSimilarModalPlayer({ player, similarPlayers: similar, isLoading: false });
      } catch (err) {
        console.error('[openSimilarModal] Failed to load similar players:', err);
        setSimilarModalPlayer({ player, similarPlayers: [], isLoading: false });
      }
    },
    [displayAwayAbbrev, displayHomeAbbrev]
  );

  useEffect(() => {
    if (previousMatchupIndex >= previousMatchups.length && previousMatchups.length > 0) {
      setPreviousMatchupIndex(0);
    }
  }, [previousMatchups, previousMatchupIndex]);

  useEffect(() => {
    setPreviousMatchupExpanded(false);
  }, [game.id]);

  const seasonSeriesRecord = useMemo(() => {
    if (!previousMatchups.length) return null;
    const away = displayAwayAbbrev;
    const home = displayHomeAbbrev;
    let awayWins = 0;
    let homeWins = 0;
    for (const g of previousMatchups) {
      if (g.awayScore == null || g.homeScore == null) continue;
      const gAway = toThreeLetterAbbrev((g.awayTeamAbbrev ?? '').toUpperCase().trim());
      const gHome = toThreeLetterAbbrev((g.homeTeamAbbrev ?? '').toUpperCase().trim());
      if (gAway === away) {
        if (g.awayScore > g.homeScore) awayWins++;
        else homeWins++;
      } else if (gHome === away) {
        if (g.homeScore > g.awayScore) awayWins++;
        else homeWins++;
      }
    }
    return { awayWins, homeWins };
  }, [previousMatchups, displayAwayAbbrev, displayHomeAbbrev]);

  const summaryLoading = matchupContextLoading || previousMatchupsLoading;

  const seasonSeriesSummaryText = useMemo(() => {
    if (!seasonSeriesRecord) return null;
    const { awayWins, homeWins } = seasonSeriesRecord;
    const a = displayAwayAbbrev;
    const h = displayHomeAbbrev;
    if (awayWins === 0 && homeWins === 0) return null;
    if (awayWins === homeWins) return `${a} and ${h} split the season series ${awayWins}–${homeWins}.`;
    if (awayWins > homeWins) return `${a} leads the season series ${awayWins}–${homeWins}.`;
    return `${h} leads the season series ${homeWins}–${awayWins}.`;
  }, [seasonSeriesRecord, displayAwayAbbrev, displayHomeAbbrev]);

  // Map normalized player name → headshot URL, used to fill in null headshotUrls
  // on injury entries sourced from the DB backfill (PDFs don't include headshots).
  const playerHeadshotByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) {
      const url = p.athlete_headshot_href;
      if (!url) continue;
      const norm = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
      map.set(norm(p.athlete_display_name), url);
      if (p.athlete_short_name) map.set(norm(p.athlete_short_name), url);
    }
    return map;
  }, [players]);

  const injuredOutAthleteIds = useMemo(
    () =>
      athleteIdsOutFromInjuries(
        players,
        injuries,
        game.awayTeamAbbrev ?? '',
        game.homeTeamAbbrev ?? ''
      ),
    [players, injuries, game.awayTeamAbbrev, game.homeTeamAbbrev]
  );

  const matchupEligiblePlayers = useMemo(
    () =>
      getMatchupEligiblePlayers(
        players,
        game.awayTeamAbbrev ?? '',
        game.homeTeamAbbrev ?? '',
        activeAwayIds,
        activeHomeIds,
        injuredOutAthleteIds
      ),
    [players, game.awayTeamAbbrev, game.homeTeamAbbrev, activeAwayIds, activeHomeIds, injuredOutAthleteIds]
  );

  const activeAwayPlayers = useMemo(
    () =>
      matchupEligiblePlayers.filter(
        (p) =>
          toThreeLetterAbbrev((p.team_abbreviation ?? '').toUpperCase().trim()) === displayAwayAbbrev
      ),
    [matchupEligiblePlayers, displayAwayAbbrev]
  );
  const activeHomePlayers = useMemo(
    () =>
      matchupEligiblePlayers.filter(
        (p) =>
          toThreeLetterAbbrev((p.team_abbreviation ?? '').toUpperCase().trim()) === displayHomeAbbrev
      ),
    [matchupEligiblePlayers, displayHomeAbbrev]
  );

  const fullRosterAwayPlayers = useMemo(
    () => players.filter((p) => teamMatches(p.team_abbreviation ?? '', game.awayTeamAbbrev ?? '')),
    [players, game.awayTeamAbbrev]
  );
  const fullRosterHomePlayers = useMemo(
    () => players.filter((p) => teamMatches(p.team_abbreviation ?? '', game.homeTeamAbbrev ?? '')),
    [players, game.homeTeamAbbrev]
  );

  const pointInTimeStatsFullRosterByPlayerId = useMemo(
    () => buildPropStatPitByPlayerId([...fullRosterAwayPlayers, ...fullRosterHomePlayers], game.gameDate ?? null),
    [fullRosterAwayPlayers, fullRosterHomePlayers, game.gameDate]
  );

  const sidelinedStatLeaderLines = useMemo(() => {
    if (!injuredOutAthleteIds.size) return [];
    const statKeys = PROP_STATS_FOR_INJURY_LEAD_HIGHLIGHT;

    const linesForSide = (teamAbbrev: string, teamPlayers: Player[]) => {
      const byPlayer = new Map<
        string,
        { player: Player; stats: Array<{ stat: PropStatKey; value: number }> }
      >();
      for (const stat of statKeys) {
        if (!teamPlayers.length) continue;
        const sorted = [...teamPlayers].sort((a, b) => {
          const aVal = pointInTimeStatsFullRosterByPlayerId[a.athlete_id]?.[stat] ?? 0;
          const bVal = pointInTimeStatsFullRosterByPlayerId[b.athlete_id]?.[stat] ?? 0;
          return bVal - aVal;
        });
        const top = sorted[0];
        if (!top || !injuredOutAthleteIds.has(top.athlete_id)) continue;
        const value = pointInTimeStatsFullRosterByPlayerId[top.athlete_id]?.[stat] ?? 0;
        const cur = byPlayer.get(top.athlete_id);
        if (cur) cur.stats.push({ stat, value });
        else byPlayer.set(top.athlete_id, { player: top, stats: [{ stat, value }] });
      }
      return [...byPlayer.values()].map((v) => ({
        teamAbbrev,
        player: v.player,
        stats: v.stats,
      }));
    };

    return [
      ...linesForSide(displayAwayAbbrev, fullRosterAwayPlayers),
      ...linesForSide(displayHomeAbbrev, fullRosterHomePlayers),
    ];
  }, [
    injuredOutAthleteIds,
    displayAwayAbbrev,
    displayHomeAbbrev,
    fullRosterAwayPlayers,
    fullRosterHomePlayers,
    pointInTimeStatsFullRosterByPlayerId,
  ]);

  const breakdownTeamColors = useMemo(
    () => getMatchupTeamColors(game.awayTeamAbbrev ?? '', game.homeTeamAbbrev ?? ''),
    [game.awayTeamAbbrev, game.homeTeamAbbrev]
  );

  const previousMatchupTeamColors = useMemo(
    () => getMatchupTeamColors(game.awayTeamAbbrev ?? '', game.homeTeamAbbrev ?? ''),
    [game.awayTeamAbbrev, game.homeTeamAbbrev]
  );

  const teamOffensiveByMode =
    breakdownMode === 'season'
      ? teamOffensiveSeason
      : breakdownMode === 'last10'
        ? teamOffensiveLast10
        : teamOffensiveLast5;

  const breakdownStats = useMemo(() => {
    const awayAbbrev = (game.awayTeamAbbrev ?? '').toUpperCase().trim();
    const homeAbbrev = (game.homeTeamAbbrev ?? '').toUpperCase().trim();
    const awayAliases = getAbbrevAliases(awayAbbrev);
    const homeAliases = getAbbrevAliases(homeAbbrev);
    const away = teamOffensiveByMode.find((t) =>
      awayAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );
    const home = teamOffensiveByMode.find((t) =>
      homeAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );
    if (away && home) {
      return {
        away: {
          ppg: away.pts_avg,
          rpg: away.reb_avg,
          apg: away.ast_avg,
          spg: away.stl_avg,
          bpg: away.blk_avg,
          tpg: away.tov_avg,
          fgPct: away.fg_pct ?? 0,
          threePtPct: away.three_pt_pct ?? 0,
          ftPct: away.ft_pct ?? 0,
        },
        home: {
          ppg: home.pts_avg,
          rpg: home.reb_avg,
          apg: home.ast_avg,
          spg: home.stl_avg,
          bpg: home.blk_avg,
          tpg: home.tov_avg,
          fgPct: home.fg_pct ?? 0,
          threePtPct: home.three_pt_pct ?? 0,
          ftPct: home.ft_pct ?? 0,
        },
      };
    }
    return null;
  }, [game.awayTeamAbbrev, game.homeTeamAbbrev, teamOffensiveByMode]);

  const breakdownLoading = teamOffensiveLoading;

  const SIG_K = 0.5;
  const significanceThresholds = useMemo(() => {
    if (!leagueVariance) return null;
    return {
      pts: leagueVariance.pts_std * SIG_K,
      ptsAllowed: leagueVariance.pts_allowed_std * SIG_K,
      reb: leagueVariance.reb_std * SIG_K,
      rebAllowed: leagueVariance.reb_allowed_std * SIG_K,
      ast: leagueVariance.ast_std * SIG_K,
      astAllowed: leagueVariance.ast_allowed_std * SIG_K,
      stl: leagueVariance.stl_std * SIG_K,
      blk: leagueVariance.blk_std * SIG_K,
      tov: leagueVariance.tov_std * SIG_K,
      fgPct: leagueVariance.fg_pct_std * SIG_K,
      fgPctAllowed: leagueVariance.fg_pct_allowed_std * SIG_K,
      threePtPct: leagueVariance.three_pt_pct_std * SIG_K,
      threePtPctAllowed: leagueVariance.three_pt_pct_allowed_std * SIG_K,
      ftPct: leagueVariance.ft_pct_std * SIG_K,
      ftPctAllowed: leagueVariance.ft_pct_allowed_std * SIG_K,
    };
  }, [leagueVariance]);

  const breakdownUnavailable =
    !breakdownStats && !breakdownLoading && (teamOffensiveSeasonError || teamOffensiveSeason.length === 0);

  const teamDefenseByMode =
    breakdownMode === 'season'
      ? teamDefenseSeason
      : breakdownMode === 'last10'
        ? teamDefenseLast10
        : teamDefenseLast5;

  const breakdownDefenseStats = useMemo(() => {
    if (!teamDefenseByMode.length) return null;
    const awayAbbrev = (game.awayTeamAbbrev ?? '').toUpperCase().trim();
    const homeAbbrev = (game.homeTeamAbbrev ?? '').toUpperCase().trim();
    const awayAliases = getAbbrevAliases(awayAbbrev);
    const homeAliases = getAbbrevAliases(homeAbbrev);
    const away = teamDefenseByMode.find((t) =>
      awayAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );
    const home = teamDefenseByMode.find((t) =>
      homeAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );
    if (away && home) {
      return {
        away: {
          ptsAllowed: away.pts_allowed_avg,
          rebAllowed: away.reb_allowed_avg,
          astAllowed: away.ast_allowed_avg,
          fgPctAllowed: away.fg_pct_allowed ?? 0,
          threePtPctAllowed: away.three_pt_pct_allowed ?? 0,
          ftPctAllowed: away.ft_pct_allowed ?? 0,
        },
        home: {
          ptsAllowed: home.pts_allowed_avg,
          rebAllowed: home.reb_allowed_avg,
          astAllowed: home.ast_allowed_avg,
          fgPctAllowed: home.fg_pct_allowed ?? 0,
          threePtPctAllowed: home.three_pt_pct_allowed ?? 0,
          ftPctAllowed: home.ft_pct_allowed ?? 0,
        },
      };
    }
    return null;
  }, [game.awayTeamAbbrev, game.homeTeamAbbrev, teamDefenseByMode]);

  const breakdownDefenseUnavailable =
    breakdownStatType === 'defense' &&
    !breakdownDefenseStats &&
    (teamDefenseError || teamDefenseSeason.length === 0) &&
    !teamDefenseLoading;

  const seasonalBreakdownRanks = useMemo(() => {
    const awayAliases = getAbbrevAliases((game.awayTeamAbbrev ?? '').toUpperCase().trim());
    const homeAliases = getAbbrevAliases((game.homeTeamAbbrev ?? '').toUpperCase().trim());
    const o = teamOffensiveByMode;
    const d = teamDefenseByMode;
    const offense = o.length
      ? {
          ppg: {
            away: getLeagueRank(o, (t) => t.pts_avg, false, awayAliases),
            home: getLeagueRank(o, (t) => t.pts_avg, false, homeAliases),
          },
          apg: {
            away: getLeagueRank(o, (t) => t.ast_avg, false, awayAliases),
            home: getLeagueRank(o, (t) => t.ast_avg, false, homeAliases),
          },
          rpg: {
            away: getLeagueRank(o, (t) => t.reb_avg, false, awayAliases),
            home: getLeagueRank(o, (t) => t.reb_avg, false, homeAliases),
          },
          spg: {
            away: getLeagueRank(o, (t) => t.stl_avg, false, awayAliases),
            home: getLeagueRank(o, (t) => t.stl_avg, false, homeAliases),
          },
          bpg: {
            away: getLeagueRank(o, (t) => t.blk_avg, false, awayAliases),
            home: getLeagueRank(o, (t) => t.blk_avg, false, homeAliases),
          },
          tpg: {
            away: getLeagueRank(o, (t) => t.tov_avg, true, awayAliases),
            home: getLeagueRank(o, (t) => t.tov_avg, true, homeAliases),
          },
          fgPct: {
            away: getLeagueRank(o, (t) => t.fg_pct ?? 0, false, awayAliases),
            home: getLeagueRank(o, (t) => t.fg_pct ?? 0, false, homeAliases),
          },
          threePtPct: {
            away: getLeagueRank(o, (t) => t.three_pt_pct ?? 0, false, awayAliases),
            home: getLeagueRank(o, (t) => t.three_pt_pct ?? 0, false, homeAliases),
          },
          ftPct: {
            away: getLeagueRank(o, (t) => t.ft_pct ?? 0, false, awayAliases),
            home: getLeagueRank(o, (t) => t.ft_pct ?? 0, false, homeAliases),
          },
        }
      : null;
    const defense = d.length
      ? {
          ptsAllowed: {
            away: getLeagueRank(d, (t) => t.pts_allowed_avg, true, awayAliases),
            home: getLeagueRank(d, (t) => t.pts_allowed_avg, true, homeAliases),
          },
          rebAllowed: {
            away: getLeagueRank(d, (t) => t.reb_allowed_avg, true, awayAliases),
            home: getLeagueRank(d, (t) => t.reb_allowed_avg, true, homeAliases),
          },
          astAllowed: {
            away: getLeagueRank(d, (t) => t.ast_allowed_avg, true, awayAliases),
            home: getLeagueRank(d, (t) => t.ast_allowed_avg, true, homeAliases),
          },
          fgPctAllowed: {
            away: getLeagueRank(d, (t) => t.fg_pct_allowed ?? 0, true, awayAliases),
            home: getLeagueRank(d, (t) => t.fg_pct_allowed ?? 0, true, homeAliases),
          },
          threePtPctAllowed: {
            away: getLeagueRank(d, (t) => t.three_pt_pct_allowed ?? 0, true, awayAliases),
            home: getLeagueRank(d, (t) => t.three_pt_pct_allowed ?? 0, true, homeAliases),
          },
          ftPctAllowed: {
            away: getLeagueRank(d, (t) => t.ft_pct_allowed ?? 0, true, awayAliases),
            home: getLeagueRank(d, (t) => t.ft_pct_allowed ?? 0, true, homeAliases),
          },
        }
      : null;
    return { offense, defense };
  }, [teamOffensiveByMode, teamDefenseByMode, game.awayTeamAbbrev, game.homeTeamAbbrev]);

  const mismatchAlertPlayerIds = useMemo(() => {
    const allActive = [...activeAwayPlayers, ...activeHomePlayers];
    const rpgRanked = [...allActive].sort((a, b) => (Number(b.rpg) || 0) - (Number(a.rpg) || 0));
    const ppgRanked = [...allActive].sort((a, b) => (Number(b.ppg) || 0) - (Number(a.ppg) || 0));
    const topAwayRebounder = rpgRanked.find((p) => activeAwayPlayers.includes(p));
    const topHomeRebounder = rpgRanked.find((p) => activeHomePlayers.includes(p));
    const topAwayScorer = ppgRanked.find((p) => activeAwayPlayers.includes(p));
    const topHomeScorer = ppgRanked.find((p) => activeHomePlayers.includes(p));
    return [
      topAwayRebounder?.athlete_id,
      topHomeRebounder?.athlete_id,
      topAwayScorer?.athlete_id,
      topHomeScorer?.athlete_id,
    ].filter(Boolean) as string[];
  }, [activeAwayPlayers, activeHomePlayers]);

  const approxTopPlayerIds = useMemo(
    () =>
      [...activeAwayPlayers, ...activeHomePlayers]
        .sort((a, b) => getPlayerSeasonAvgFromTotals(b, keyMatchupStat) - getPlayerSeasonAvgFromTotals(a, keyMatchupStat))
        .slice(0, 6)
        .map((p) => p.athlete_id),
    [activeAwayPlayers, activeHomePlayers, keyMatchupStat]
  );

  const allStatRankIds = useMemo(
    () => [...new Set([...mismatchAlertPlayerIds, ...approxTopPlayerIds])],
    [mismatchAlertPlayerIds, approxTopPlayerIds]
  );

  const { data: playerStatRanks = {} } = usePlayerStatRanks(SEASON, allStatRankIds, game.gameDate ?? undefined);

  const mismatchAlerts = useMemo(() => {
    if (teamDefenseError || !teamDefenseSeason.length) return [];
    const alerts: string[] = [];
    const homeAbbrev = (game.homeTeamAbbrev ?? '').toUpperCase().trim();
    const awayAbbrev = (game.awayTeamAbbrev ?? '').toUpperCase().trim();
    const homeAliases = getAbbrevAliases(homeAbbrev);
    const awayAliases = getAbbrevAliases(awayAbbrev);

    const homeDef = teamDefenseSeason.find((t) =>
      homeAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );
    const awayDef = teamDefenseSeason.find((t) =>
      awayAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );

    const allActive = [...activeAwayPlayers, ...activeHomePlayers];
    const rpgRanked = [...allActive].sort((a, b) => (Number(b.rpg) || 0) - (Number(a.rpg) || 0));
    const ppgRanked = [...allActive].sort((a, b) => (Number(b.ppg) || 0) - (Number(a.ppg) || 0));
    const topAwayRebounder = rpgRanked.find((p) => activeAwayPlayers.includes(p));
    const topHomeRebounder = rpgRanked.find((p) => activeHomePlayers.includes(p));
    const topAwayScorer = ppgRanked.find((p) => activeAwayPlayers.includes(p));
    const topHomeScorer = ppgRanked.find((p) => activeHomePlayers.includes(p));

    if (homeDef && topAwayRebounder && homeDef.reb_allowed_rank <= 5) {
      const rpg = Number(topAwayRebounder.rpg) || 0;
      const rank = playerStatRanks[topAwayRebounder.athlete_id]?.rpg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${displayHomeAbbrev} allows ${homeDef.reb_allowed_avg.toFixed(1)} RPG (#${homeDef.reb_allowed_rank}). ${formatPlayerName(topAwayRebounder.athlete_display_name, nameFormat)}: ${rpg.toFixed(1)} RPG${rankStr}`
      );
    }
    if (awayDef && topHomeRebounder && awayDef.reb_allowed_rank <= 5) {
      const rpg = Number(topHomeRebounder.rpg) || 0;
      const rank = playerStatRanks[topHomeRebounder.athlete_id]?.rpg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${displayAwayAbbrev} allows ${awayDef.reb_allowed_avg.toFixed(1)} RPG (#${awayDef.reb_allowed_rank}). ${formatPlayerName(topHomeRebounder.athlete_display_name, nameFormat)}: ${rpg.toFixed(1)} RPG${rankStr}`
      );
    }
    if (homeDef && topAwayScorer && homeDef.pts_allowed_rank >= 25) {
      const ppg = Number(topAwayScorer.ppg) || 0;
      const rank = playerStatRanks[topAwayScorer.athlete_id]?.ppg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${displayHomeAbbrev} allows ${homeDef.pts_allowed_avg.toFixed(1)} PPG (#${homeDef.pts_allowed_rank}). ${formatPlayerName(topAwayScorer.athlete_display_name, nameFormat)}: ${ppg.toFixed(1)} PPG${rankStr}`
      );
    }
    if (awayDef && topHomeScorer && awayDef.pts_allowed_rank >= 25) {
      const ppg = Number(topHomeScorer.ppg) || 0;
      const rank = playerStatRanks[topHomeScorer.athlete_id]?.ppg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${displayAwayAbbrev} allows ${awayDef.pts_allowed_avg.toFixed(1)} PPG (#${awayDef.pts_allowed_rank}). ${formatPlayerName(topHomeScorer.athlete_display_name, nameFormat)}: ${ppg.toFixed(1)} PPG${rankStr}`
      );
    }
    return alerts;
  }, [
    teamDefenseSeason,
    activeHomePlayers,
    activeAwayPlayers,
    playerStatRanks,
    displayHomeAbbrev,
    displayAwayAbbrev,
    nameFormat,
  ]);

  const pointInTimeStatsByPlayerId = useMemo(
    () => buildPropStatPitByPlayerId([...activeAwayPlayers, ...activeHomePlayers], game.gameDate ?? null),
    [activeAwayPlayers, activeHomePlayers, game.gameDate]
  );

  const topPlayersByStat = useMemo(
    () =>
      [...activeAwayPlayers, ...activeHomePlayers]
        .sort((a, b) => {
          const aVal = pointInTimeStatsByPlayerId[a.athlete_id]?.[keyMatchupStat] ?? 0;
          const bVal = pointInTimeStatsByPlayerId[b.athlete_id]?.[keyMatchupStat] ?? 0;
          return bVal - aVal;
        })
        .slice(0, 6),
    [activeAwayPlayers, activeHomePlayers, keyMatchupStat, pointInTimeStatsByPlayerId]
  );

  const teamMatchupInsights = useMemo(() => {
    if (!awayRecentResults || !homeRecentResults) return [];
    return computeTeamMatchupInsights(
      game,
      teamOffensiveSeason,
      teamOffensiveLast5,
      teamDefenseSeason,
      awayRecentResults,
      homeRecentResults
    );
  }, [
    game,
    teamOffensiveSeason,
    teamOffensiveLast5,
    teamDefenseSeason,
    awayRecentResults,
    homeRecentResults,
  ]);

  const playerMatchupInsights = useMemo(() => {
    const pit: MatchupPointInTimeStats = {};
    for (const p of [...activeAwayPlayers, ...activeHomePlayers]) {
      const s = pointInTimeStatsByPlayerId[p.athlete_id];
      if (s) pit[p.athlete_id] = { ppg: s.points, apg: s.assists };
    }
    return computePlayerMatchupInsights(game, players, activeAwayIds, activeHomeIds, {
      excludeAthleteIds: injuredOutAthleteIds,
      pointInTimeByPlayerId: pit,
    });
  }, [
    game,
    players,
    activeAwayIds,
    activeHomeIds,
    activeAwayPlayers,
    activeHomePlayers,
    pointInTimeStatsByPlayerId,
    injuredOutAthleteIds,
  ]);

  const liveDataAsOfLabel = useMemo(() => {
    if (!liveDataFetchedAt) return null;
    try {
      const d = new Date(liveDataFetchedAt);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  }, [liveDataFetchedAt]);

  const injurySnapshotLabel = useMemo(() => {
    if (!injurySnapshotCapturedAt) return null;
    try {
      const d = new Date(injurySnapshotCapturedAt);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  }, [injurySnapshotCapturedAt]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}>

      <View>
        <GameMatchupDisplay
          game={game}
          colorScheme={colorScheme ?? 'light'}
          scheduleGames={scheduleGames}
        />
      </View>

      <MatchupSummarySection
        game={game}
        displayAwayAbbrev={displayAwayAbbrev}
        displayHomeAbbrev={displayHomeAbbrev}
        awayRecentResults={awayRecentResults}
        homeRecentResults={homeRecentResults}
        sidelinedStatLeaderLines={sidelinedStatLeaderLines}
        seasonSeriesSummaryText={seasonSeriesSummaryText}
        textColor={colors.text}
        mutedColor={colors.textSecondary}
        nameFormat={nameFormat}
        isLoading={summaryLoading}
      />

      {injuries.length > 0 && (() => {
        const awayAbbrevSet = new Set(
          getAbbrevAliases(displayAwayAbbrev).map((a) => a.toUpperCase())
        );
        const homeAbbrevSet = new Set(
          getAbbrevAliases(displayHomeAbbrev).map((a) => a.toUpperCase())
        );
        const awayInjuries = injuries.filter((i) =>
          awayAbbrevSet.has((i.teamAbbrev ?? '').toUpperCase())
        );
        const homeInjuries = injuries.filter((i) =>
          homeAbbrevSet.has((i.teamAbbrev ?? '').toUpperCase())
        );
        const statusSortOrder = (status: string) => {
          const s = status.toLowerCase();
          if (s.includes('out')) return 0;
          if (s.includes('day') || s === 'dtd') return 1;
          if (s.includes('quest')) return 2;
          return 3;
        };
        const sortInjuries = (list: ESPNInjuryEntry[]) =>
          [...list].sort((a, b) => statusSortOrder(a.status) - statusSortOrder(b.status));
        const fillHeadshot = (inj: ESPNInjuryEntry): ESPNInjuryEntry => {
          if (inj.headshotUrl) return inj;
          const norm = (inj.playerName ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
          const url = playerHeadshotByName.get(norm);
          return url ? { ...inj, headshotUrl: url } : inj;
        };
        const allInjuries = [
          ...sortInjuries(awayInjuries).map(fillHeadshot),
          ...sortInjuries(homeInjuries).map(fillHeadshot),
        ];
        return (
          <View style={styles.sectionOpen}>
            <ThemedText style={styles.sectionTitle}>Injury Report</ThemedText>
            <InjuryMarquee injuries={allInjuries} />
            {injurySnapshotLabel ? (
              <ThemedText style={[styles.dataFreshness, { color: colors.textSecondary }]}>
                Injury report as of {injurySnapshotLabel}
              </ThemedText>
            ) : liveDataAsOfLabel ? (
              <ThemedText style={[styles.dataFreshness, { color: colors.textSecondary }]}>
                Injury report and live data as of {liveDataAsOfLabel}
              </ThemedText>
            ) : null}
          </View>
        );
      })()}

      {!injuries.length && (liveDataAsOfLabel || injurySnapshotLabel) ? (
        <View style={styles.sectionOpen}>
          <ThemedText style={[styles.dataFreshness, { color: colors.textSecondary }]}>
            {liveDataAsOfLabel ? `Live data as of ${liveDataAsOfLabel}` : `No injury report recorded`}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.sectionOpen}>
        <ThemedText style={styles.sectionTitle}>Season Leaders</ThemedText>
        <View style={styles.breakdownFilterRow}>
          <FilterOptionButtons
            options={PROP_STAT_OPTIONS}
            value={keyMatchupStat}
            onSelect={(k) => setKeyMatchupStat(k as PropStatKey)}
            colorScheme={colorScheme ?? 'light'}
            scrollable
          />
        </View>
        {playerMatchupInsights.length > 0 && (
          <InsightCarousel
            insights={playerMatchupInsights}
            style={styles.insightCarousel}
            cycleDurationMs={5000}
          />
        )}
        <View style={styles.matchupGrid}>
          {topPlayersByStat.map((p) => {
            const isAway =
              toThreeLetterAbbrev((p.team_abbreviation ?? '').toUpperCase()) === displayAwayAbbrev;
            const opp = isAway ? displayHomeAbbrev : displayAwayAbbrev;
            const pitStats = pointInTimeStatsByPlayerId[p.athlete_id];
            const fullLog = (p.game_log ?? []) as GameLogEntry[];
            const pitLog = game.gameDate
              ? fullLog.filter((g) => (g.game_date ?? '') < game.gameDate!)
              : fullLog;
            const gamesVs = getGamesVsOpponent(pitLog, opp);
            const vsLineParts = (() => {
              if (gamesVs.length === 0) return null;
              if (gamesVs.length === 1) {
                const raw = getStatFromGameLog(gamesVs[0], keyMatchupStat);
                const statStr = `${formatVsOpponentSingleGameValue(raw)} ${propStatShortLabel(keyMatchupStat)}`;
                return { prefix: 'Got ', statStr, suffix: ` vs ${opp} last time` };
              }
              const avg = getSeasonAvgFromGameLog(gamesVs, keyMatchupStat);
              const statStr = `${avg.toFixed(1)} ${PROP_STAT_PLAYER_ROW_LABEL[keyMatchupStat]}`;
              return { prefix: 'Avg. ', statStr, suffix: ` in ${gamesVs.length} games vs ${opp}` };
            })();
            return (
              <View key={p.athlete_id} style={styles.matchupRow}>
                <Pressable
                  style={styles.playerRow}
                  onPress={() => router.push({ pathname: '/player/[id]', params: { id: p.athlete_id, name: formatPlayerName(p.athlete_display_name, nameFormat), from: 'Game' } })}>
                  <PlayerAvatar uri={p.athlete_headshot_href} displayName={p.athlete_display_name} teamAbbrev={p.team_abbreviation} size={44} />
                  <View style={styles.playerMeta}>
                    <ThemedText style={styles.playerName}>
                      {formatPlayerName(p.athlete_display_name, nameFormat)}
                      <ThemedText style={[styles.playerTeamAbbrev, { color: colors.textSecondary }]}>
                        {' '}({toThreeLetterAbbrev((p.team_abbreviation ?? '').toUpperCase())})
                      </ThemedText>
                    </ThemedText>
                    {(() => {
                        const fmt = (v: number) => v.toFixed(1);
                        const rankField = propStatToRankField(keyMatchupStat);
                        const avgField = propStatToAvgField(keyMatchupStat);
                        const rank = rankField ? playerStatRanks[p.athlete_id]?.[rankField] : null;
                        // Use true PIT average from rank RPC when available; fall back to season totals
                        const pitRpcAvg = avgField ? playerStatRanks[p.athlete_id]?.[avgField] : null;
                        const primaryStatVal = pitRpcAvg != null ? pitRpcAvg : getPlayerSeasonAvgFromTotals(p, keyMatchupStat);
                        const primaryVal = `${fmt(primaryStatVal)} ${PROP_STAT_PLAYER_ROW_LABEL[keyMatchupStat]}`;
                        const others = otherPropStatKeysForRow(keyMatchupStat);
                        const rest = others
                          .map((s) => {
                            const otherAvgField = propStatToAvgField(s);
                            const otherAvg = otherAvgField ? playerStatRanks[p.athlete_id]?.[otherAvgField] : null;
                            const val = otherAvg != null ? otherAvg : getPlayerSeasonAvgFromTotals(p, s);
                            return `${fmt(val)} ${PROP_STAT_PLAYER_ROW_LABEL[s]}`;
                          })
                          .join(' • ');
                        const last5 = [...pitLog]
                          .sort((a, b) => (b.game_date ?? '').localeCompare(a.game_date ?? ''))
                          .slice(0, 5);
                        const l5Avg = last5.length >= 3
                          ? last5.reduce((sum, g) => sum + (getStatFromGameLog(g, keyMatchupStat) || 0), 0) / last5.length
                          : null;
                        const delta = l5Avg !== null ? l5Avg - primaryStatVal : null;
                        const trendParts = delta !== null && Math.abs(delta) >= 0.5
                          ? {
                              deltaStr: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} ${PROP_STAT_PLAYER_ROW_LABEL[keyMatchupStat]}`,
                              rest: ' in L5 games',
                              isPositive: delta >= 0,
                            }
                          : null;
                        return (
                          <>
                            <ThemedText style={[styles.playerStat, { color: colors.textSecondary }]}>
                              {primaryVal}
                              {rank != null && rank <= 25 && (
                                <Text style={{ color: colors.text, fontWeight: '700' }}>{` (#${rank})`}</Text>
                              )}
                              {rest ? ` • ${rest}` : ''}
                            </ThemedText>
                            {(vsLineParts || trendParts) && (
                              <ThemedText style={[styles.vsLine, { color: colors.textSecondary }]}>
                                {vsLineParts && (
                                  <>
                                    {vsLineParts.prefix}
                                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>{vsLineParts.statStr}</Text>
                                    {vsLineParts.suffix}
                                  </>
                                )}
                                {vsLineParts && trendParts ? '. ' : null}
                                {trendParts && (
                                  <>
                                    <Text style={{ color: trendParts.isPositive ? colors.scoreWinner : colors.statusLive, fontWeight: 'bold' }}>{trendParts.deltaStr}</Text>
                                    {trendParts.rest}
                                  </>
                                )}
                              </ThemedText>
                            )}
                          </>
                        );
                      })()}
                  </View>
                </Pressable>
                {/* <View style={styles.similarSection}>
                  <TouchableOpacity
                    style={[styles.seeSimilarBtn, { borderColor: colors.tint }]}
                    onPress={() => openSimilarModal(p)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <ThemedText style={[styles.seeSimilarText, { color: colors.tint }]}>
                      See similar players
                    </ThemedText>
                  </TouchableOpacity>
                </View> */}
              </View>
            );
          })}
        </View>
      </View>

      {/* Mismatch alerts temporarily disabled
      {mismatchAlerts.length > 0 && (
        <View style={[styles.sectionOpen, { backgroundColor: colors.tint + '20' }]}>
          <ThemedText style={styles.sectionTitle}>Mismatch Alerts</ThemedText>
          {mismatchAlerts.map((msg, i) => (
            <View
              key={i}
              style={[styles.alertCard, { backgroundColor: colors.background }]}>
              <ThemedText style={styles.alertText}>{msg}</ThemedText>
            </View>
          ))}
        </View>
      )}
      */}

      {previousMatchups.length > 0 && (
        <View style={styles.sectionOpen}>
          <ThemedText style={styles.sectionTitle}>Previous Matchups</ThemedText>
          {seasonSeriesSummaryText ? (
            <ThemedText style={[styles.seriesLine, { color: colors.textSecondary }]}>
              {seasonSeriesSummaryText}
            </ThemedText>
          ) : null}
          {previousMatchups.length > 1 && (
            <View style={styles.breakdownFilterRow}>
              <FilterOptionButtons
                options={previousMatchups.map((g, i) => ({
                  key: String(i),
                  label: formatDate(g.gameDate),
                }))}
                value={String(previousMatchupIndex)}
                onSelect={(k) => setPreviousMatchupIndex(Number(k))}
                colorScheme={colorScheme ?? 'light'}
                scrollable
              />
            </View>
          )}
          {selectedPreviousGame && (
            <>
              {previousMatchups.length === 1 && (
                <View
                  style={[
                    styles.previousMatchupDateChip,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.tint,
                    },
                  ]}>
                  <ThemedText style={[styles.previousMatchupDateChipText, { color: colors.tint }]}>
                    {formatDate(selectedPreviousGame.gameDate)}
                  </ThemedText>
                </View>
              )}
              {previousScoreDisplay && (
                <>
                  <View style={styles.previousScoreRow}>
                    <View style={[styles.previousScoreSide, styles.previousScoreColumn]}>
                      <ThemedText
                        style={[
                          styles.previousScoreText,
                          previousScoreDisplay.leftWon && { color: colors.scoreWinner },
                          !previousScoreDisplay.leftWon && !previousScoreDisplay.isTie && { color: colors.scoreLoser },
                        ]}
                        numberOfLines={1}>
                        {previousScoreDisplay.leftScore}
                      </ThemedText>
                      <ThemedText style={[styles.previousScoreHomeAway, { color: colors.textSecondary }]}>Away</ThemedText>
                      <ThemedText style={[styles.previousScoreTeamName, { color: colors.scoreTeamLabel }]}>
                        {displayAwayAbbrev}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.scoreDash, styles.previousScoreDash, { color: colors.textSecondary }]}>–</ThemedText>
                    <View style={[styles.previousScoreSide, styles.previousScoreColumn]}>
                      <ThemedText
                        style={[
                          styles.previousScoreText,
                          previousScoreDisplay.rightWon && { color: colors.scoreWinner },
                          !previousScoreDisplay.rightWon && !previousScoreDisplay.isTie && { color: colors.scoreLoser },
                        ]}
                        numberOfLines={1}>
                        {previousScoreDisplay.rightScore}
                      </ThemedText>
                      <ThemedText style={[styles.previousScoreHomeAway, { color: colors.textSecondary }]}>Home</ThemedText>
                      <ThemedText style={[styles.teamAbbrev, styles.previousScoreTeamName, { color: colors.scoreTeamLabel }]}>
                        {displayHomeAbbrev}
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    style={[styles.expandPreviousRow, { borderColor: colors.border }]}
                    onPress={() => setPreviousMatchupExpanded((e) => !e)}
                    hitSlop={8}>
                    <ThemedText style={[styles.expandPreviousText, { color: colors.tint }]}>
                      {previousMatchupExpanded ? 'Hide game stats' : 'Show game stats'}
                    </ThemedText>
                    <Feather
                      name={previousMatchupExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.tint}
                    />
                  </Pressable>
                </>
              )}
              {previousMatchupExpanded && previousScoreDisplay ? (
                previousBoxScoresLoading ? (
                  <View style={styles.loadingPlaceholder}>
                    <ActivityIndicator size="small" color={colors.tint} />
                    <ThemedText style={[styles.breakdownLoadingText, { color: colors.textSecondary }]}>
                      Loading game stats…
                    </ThemedText>
                  </View>
                ) : previousMatchupStats ? (
                  <>
                  <TeamComparisonBar
                    label="Assists"
                    leftValue={previousMatchupStats.away.apg}
                    rightValue={previousMatchupStats.home.apg}
                    leftLabel={String(Math.round(previousMatchupStats.away.apg))}
                    rightLabel={String(Math.round(previousMatchupStats.home.apg))}
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Rebounds"
                    leftValue={previousMatchupStats.away.rpg}
                    rightValue={previousMatchupStats.home.rpg}
                    leftLabel={String(Math.round(previousMatchupStats.away.rpg))}
                    rightLabel={String(Math.round(previousMatchupStats.home.rpg))}
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Steals"
                    leftValue={previousMatchupStats.away.spg}
                    rightValue={previousMatchupStats.home.spg}
                    leftLabel={String(Math.round(previousMatchupStats.away.spg))}
                    rightLabel={String(Math.round(previousMatchupStats.home.spg))}
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Blocks"
                    leftValue={previousMatchupStats.away.bpg}
                    rightValue={previousMatchupStats.home.bpg}
                    leftLabel={String(Math.round(previousMatchupStats.away.bpg))}
                    rightLabel={String(Math.round(previousMatchupStats.home.bpg))}
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Turnovers"
                    leftValue={previousMatchupStats.away.tpg}
                    rightValue={previousMatchupStats.home.tpg}
                    leftLabel={String(Math.round(previousMatchupStats.away.tpg))}
                    rightLabel={String(Math.round(previousMatchupStats.home.tpg))}
                    lowerIsBetter
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Field Goal %"
                    leftValue={previousMatchupStats.away.fgPct}
                    rightValue={previousMatchupStats.home.fgPct}
                    leftLabel={`${previousMatchupStats.away.fgPct.toFixed(1)}%`}
                    rightLabel={`${previousMatchupStats.home.fgPct.toFixed(1)}%`}
                    isPercent
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="3PT%"
                    leftValue={previousMatchupStats.away.threePtPct}
                    rightValue={previousMatchupStats.home.threePtPct}
                    leftLabel={`${previousMatchupStats.away.threePtPct.toFixed(1)}%`}
                    rightLabel={`${previousMatchupStats.home.threePtPct.toFixed(1)}%`}
                    isPercent
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Free Throw %"
                    leftValue={previousMatchupStats.away.ftPct}
                    rightValue={previousMatchupStats.home.ftPct}
                    leftLabel={`${previousMatchupStats.away.ftPct.toFixed(1)}%`}
                    rightLabel={`${previousMatchupStats.home.ftPct.toFixed(1)}%`}
                    isPercent
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  </>
                ) : null
              ) : null}
            </>
          )}
        </View>
      )}

      {(breakdownStats || breakdownDefenseStats || breakdownLoading || teamDefenseLoading || breakdownUnavailable || breakdownDefenseUnavailable) && (
        <View style={styles.sectionOpen}>
          <ThemedText style={styles.sectionTitle}>Season Breakdown</ThemedText>
          <View style={[styles.breakdownFilterRow, styles.breakdownFilterRowFirst]}>
            <FilterOptionButtons
              options={[
                { key: 'offense', label: 'Offense' },
                { key: 'defense', label: 'Defense' },
              ]}
              value={breakdownStatType}
              onSelect={(k) => setBreakdownStatType(k as 'offense' | 'defense')}
              colorScheme={colorScheme ?? 'light'}
            />
          </View>
          <View style={styles.breakdownFilterRow}>
            <FilterOptionButtons
              options={[
                { key: 'season', label: 'Season' },
                { key: 'last10', label: 'Last 10' },
                { key: 'last5', label: 'Last 5' },
              ]}
              value={breakdownMode}
              onSelect={(k) => setBreakdownMode(k as 'season' | 'last10' | 'last5')}
              colorScheme={colorScheme ?? 'light'}
              scrollable
            />
          </View>
          {teamMatchupInsights.length > 0 && (
            <InsightCarousel
              insights={teamMatchupInsights}
              style={styles.insightCarousel}
              cycleDurationMs={5000}
            />
          )}
          {(breakdownStatType === 'offense' && breakdownStats) ||
          (breakdownStatType === 'defense' && breakdownDefenseStats) ? (
            <>
              <View style={[styles.breakdownTeamHeader, { gap: TEAM_COMPARISON_ROW_GAP }]}>
                <View style={styles.breakdownTeamHeaderAway}>
                  <ThemedText
                    style={[
                      styles.previousScoreHomeAway,
                      styles.breakdownTeamHeaderAwayText,
                      { color: colors.textSecondary },
                    ]}>
                    Away
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.teamAbbrev,
                      styles.previousScoreTeamName,
                      styles.breakdownTeamHeaderAwayText,
                      { color: colors.scoreTeamLabel },
                    ]}>
                    {displayAwayAbbrev}
                  </ThemedText>
                </View>
                <View
                  style={{ width: TEAM_COMPARISON_LABEL_COLUMN_WIDTH, flexShrink: 0 }}
                  accessible={false}
                />
                <View style={styles.breakdownTeamHeaderHome}>
                  <ThemedText
                    style={[
                      styles.previousScoreHomeAway,
                      styles.breakdownTeamHeaderHomeText,
                      { color: colors.textSecondary },
                    ]}>
                    Home
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.teamAbbrev,
                      styles.previousScoreTeamName,
                      styles.breakdownTeamHeaderHomeText,
                      { color: colors.scoreTeamLabel },
                    ]}>
                    {displayHomeAbbrev}
                  </ThemedText>
                </View>
              </View>
              {breakdownStatType === 'offense' && breakdownStats ? (
                <>
                  <TeamComparisonBar
                    label="Points"
                    leftValue={breakdownStats.away.ppg}
                    rightValue={breakdownStats.home.ppg}
                    leftLabel={breakdownStats.away.ppg.toFixed(1)}
                    rightLabel={breakdownStats.home.ppg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.ppg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.ppg.home ?? undefined}
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.pts })}
                  />
                  <TeamComparisonBar
                    label="Assists"
                    leftValue={breakdownStats.away.apg}
                    rightValue={breakdownStats.home.apg}
                    leftLabel={breakdownStats.away.apg.toFixed(1)}
                    rightLabel={breakdownStats.home.apg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.apg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.apg.home ?? undefined}
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.ast })}
                  />
                  <TeamComparisonBar
                    label="Rebounds"
                    leftValue={breakdownStats.away.rpg}
                    rightValue={breakdownStats.home.rpg}
                    leftLabel={breakdownStats.away.rpg.toFixed(1)}
                    rightLabel={breakdownStats.home.rpg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.rpg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.rpg.home ?? undefined}
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.reb })}
                  />
                  <TeamComparisonBar
                    label="Steals"
                    leftValue={breakdownStats.away.spg}
                    rightValue={breakdownStats.home.spg}
                    leftLabel={breakdownStats.away.spg.toFixed(1)}
                    rightLabel={breakdownStats.home.spg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.spg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.spg.home ?? undefined}
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.stl })}
                  />
                  <TeamComparisonBar
                    label="Blocks"
                    leftValue={breakdownStats.away.bpg}
                    rightValue={breakdownStats.home.bpg}
                    leftLabel={breakdownStats.away.bpg.toFixed(1)}
                    rightLabel={breakdownStats.home.bpg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.bpg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.bpg.home ?? undefined}
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.blk })}
                  />
                  <TeamComparisonBar
                    label="Turnovers"
                    leftValue={breakdownStats.away.tpg}
                    rightValue={breakdownStats.home.tpg}
                    leftLabel={breakdownStats.away.tpg.toFixed(1)}
                    rightLabel={breakdownStats.home.tpg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.tpg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.tpg.home ?? undefined}
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.tov })}
                  />
                  <TeamComparisonBar
                    label="Field Goal %"
                    leftValue={breakdownStats.away.fgPct}
                    rightValue={breakdownStats.home.fgPct}
                    leftLabel={`${breakdownStats.away.fgPct.toFixed(1)}%`}
                    rightLabel={`${breakdownStats.home.fgPct.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.offense?.fgPct.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.fgPct.home ?? undefined}
                    isPercent
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.fgPct })}
                  />
                  <TeamComparisonBar
                    label="3PT%"
                    leftValue={breakdownStats.away.threePtPct}
                    rightValue={breakdownStats.home.threePtPct}
                    leftLabel={`${breakdownStats.away.threePtPct.toFixed(1)}%`}
                    rightLabel={`${breakdownStats.home.threePtPct.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.offense?.threePtPct.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.threePtPct.home ?? undefined}
                    isPercent
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.threePtPct })}
                  />
                  <TeamComparisonBar
                    label="Free Throw %"
                    leftValue={breakdownStats.away.ftPct}
                    rightValue={breakdownStats.home.ftPct}
                    leftLabel={`${breakdownStats.away.ftPct.toFixed(1)}%`}
                    rightLabel={`${breakdownStats.home.ftPct.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.offense?.ftPct.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.ftPct.home ?? undefined}
                    isPercent
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.ftPct })}
                  />
                </>
              ) : breakdownDefenseStats ? (
                <>
                  <TeamComparisonBar
                    label="Points Allowed"
                    leftValue={breakdownDefenseStats.away.ptsAllowed}
                    rightValue={breakdownDefenseStats.home.ptsAllowed}
                    leftLabel={breakdownDefenseStats.away.ptsAllowed.toFixed(1)}
                    rightLabel={breakdownDefenseStats.home.ptsAllowed.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.defense?.ptsAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.ptsAllowed.home ?? undefined}
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.ptsAllowed })}
                  />
                  <TeamComparisonBar
                    label="Rebounds Allowed"
                    leftValue={breakdownDefenseStats.away.rebAllowed}
                    rightValue={breakdownDefenseStats.home.rebAllowed}
                    leftLabel={breakdownDefenseStats.away.rebAllowed.toFixed(1)}
                    rightLabel={breakdownDefenseStats.home.rebAllowed.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.defense?.rebAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.rebAllowed.home ?? undefined}
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.rebAllowed })}
                  />
                  <TeamComparisonBar
                    label="Assists Allowed"
                    leftValue={breakdownDefenseStats.away.astAllowed}
                    rightValue={breakdownDefenseStats.home.astAllowed}
                    leftLabel={breakdownDefenseStats.away.astAllowed.toFixed(1)}
                    rightLabel={breakdownDefenseStats.home.astAllowed.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.defense?.astAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.astAllowed.home ?? undefined}
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.astAllowed })}
                  />
                  <TeamComparisonBar
                    label="FG% Allowed"
                    leftValue={breakdownDefenseStats.away.fgPctAllowed}
                    rightValue={breakdownDefenseStats.home.fgPctAllowed}
                    leftLabel={`${breakdownDefenseStats.away.fgPctAllowed.toFixed(1)}%`}
                    rightLabel={`${breakdownDefenseStats.home.fgPctAllowed.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.defense?.fgPctAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.fgPctAllowed.home ?? undefined}
                    isPercent
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.fgPctAllowed })}
                  />
                  <TeamComparisonBar
                    label="3PT% Allowed"
                    leftValue={breakdownDefenseStats.away.threePtPctAllowed}
                    rightValue={breakdownDefenseStats.home.threePtPctAllowed}
                    leftLabel={`${breakdownDefenseStats.away.threePtPctAllowed.toFixed(1)}%`}
                    rightLabel={`${breakdownDefenseStats.home.threePtPctAllowed.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.defense?.threePtPctAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.threePtPctAllowed.home ?? undefined}
                    isPercent
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.threePtPctAllowed })}
                  />
                  <TeamComparisonBar
                    label="FT% Allowed"
                    leftValue={breakdownDefenseStats.away.ftPctAllowed}
                    rightValue={breakdownDefenseStats.home.ftPctAllowed}
                    leftLabel={`${breakdownDefenseStats.away.ftPctAllowed.toFixed(1)}%`}
                    rightLabel={`${breakdownDefenseStats.home.ftPctAllowed.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.defense?.ftPctAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.ftPctAllowed.home ?? undefined}
                    isPercent
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.ftPctAllowed })}
                  />
                </>
              ) : null}
            </>
          ) : (breakdownStatType === 'offense' && breakdownUnavailable) ||
            (breakdownStatType === 'defense' && breakdownDefenseUnavailable) ? (
            <View style={styles.loadingPlaceholder}>
              <ThemedText style={[styles.breakdownLoadingText, { color: colors.textSecondary }]}>
                Team stats unavailable.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.loadingPlaceholder}>
              <ActivityIndicator size="small" color={colors.tint} />
              <ThemedText style={[styles.breakdownLoadingText, { color: colors.textSecondary }]}>
                Loading team stats…
              </ThemedText>
            </View>
          )}
        </View>
      )}

      {similarModalPlayer && (
        <SimilarPlayersModal
          visible={!!similarModalPlayer}
          onClose={() => setSimilarModalPlayer(null)}
          sourcePlayerName={formatPlayerName(similarModalPlayer.player.athlete_display_name, nameFormat)}
          similarPlayers={similarModalPlayer.similarPlayers}
          isLoading={similarModalPlayer.isLoading}
          opponentAbbrev={
            toThreeLetterAbbrev((similarModalPlayer.player.team_abbreviation ?? '').toUpperCase()) ===
            displayHomeAbbrev
              ? displayAwayAbbrev
              : displayHomeAbbrev
          }
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  venue: {
    fontSize: 14,
    marginTop: 4,
  },
  previousScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 0,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  previousScoreSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  previousScoreColumn: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  previousScoreHomeAway: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 14,
  },
  previousScoreTeamName: {
    marginTop: 2,
    fontWeight: '700',
  },
  previousScoreText: {
    fontSize: 40,
    fontWeight: '700',
    minWidth: 48,
    lineHeight: 48,
    textAlign: 'center',
  },
  previousScoreDash: {
    fontSize: 32,
  },
  scoreDash: {
    fontSize: 24,
  },
  sectionOpen: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(37, 37, 37, 0.5)',
  },
  seriesLine: {
    fontSize: 14,
    marginVertical: 16,
    textAlign: 'center',
  },
  dataFreshness: {
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  sidelinedStatLeaderRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    gap: 12,
    // borderWidth: 1,
    // borderColor: 'red',
  },
  sidelinedStatLeaderEmoji: {
    fontSize: 12,
    lineHeight: 18,
    borderRadius: 100,
    padding: 8
  },
  sidelinedStatLeaderBody: {
    flex: 1,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'left',
  },
  expandPreviousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 25,
    width: 200,
    alignSelf: 'center',
    marginBottom: 16,
  },
  expandPreviousText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  breakdownFilterRow: {
    marginBottom: 12,
  },
  previousMatchupDateChip: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  previousMatchupDateChipText: {
    fontSize: 14,
  },
  breakdownFilterRowFirst: {
    paddingLeft: 24,
  },
  insightCarousel: {
    marginBottom: 12,
  },
  breakdownTeamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  breakdownTeamHeaderAway: {
    flex: 1,
    flexDirection: 'column',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  breakdownTeamHeaderAwayText: {
    textAlign: 'right',
    paddingRight: 4,
  },
  breakdownTeamHeaderHome: {
    flex: 1,
    flexDirection: 'column',
    minWidth: 0,
    alignSelf: 'stretch',
    paddingLeft: 20,
  },
  breakdownTeamHeaderHomeText: {
    textAlign: 'left',
  },
  teamAbbrev: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  breakdownLoadingText: {
    fontSize: 14,
  },
  alertCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  alertText: {
    fontSize: 14,
  },
  matchupGrid: {
    gap: 16,
  },
  matchupRow: {
    marginBottom: 16,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerMeta: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  playerTeamAbbrev: {
    fontSize: 14,
    fontWeight: '400',
  },
  playerStat: {
    fontSize: 13,
    marginTop: 2,
  },
  vsLine: {
    fontSize: 12,
    marginTop: 2,
  },
  similarSection: {
    marginTop: 8,
    marginLeft: 56,
  },
  seeSimilarBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  seeSimilarText: {
    fontSize: 14,
    fontWeight: '500',
  },
  boxScoreList: {
    gap: 12,
  },
  boxScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  boxScoreMeta: {
    flex: 1,
  },
  boxScoreName: {
    fontSize: 15,
    fontWeight: '600',
  },
  boxScoreStat: {
    fontSize: 13,
    marginTop: 2,
  },
});
