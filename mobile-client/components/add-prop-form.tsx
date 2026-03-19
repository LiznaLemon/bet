import { FilterOptionButtons } from '@/components/filter-option-buttons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  computeHitRatesByWindow,
  getSeasonAvgFromGameLog,
} from '@/lib/props/compute-prop-stats';
import { usePlayersPaginated, type PaginatedPlayer } from '@/lib/queries/players';
import type { GameLogEntry, Player } from '@/lib/types';
import type { CombinedProp, PlayerProp, PropStatKey, SingleProp } from '@/lib/types/props';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PROP_STAT_OPTIONS: { key: PropStatKey; label: string }[] = [
  { key: 'points', label: 'PTS' },
  { key: 'rebounds', label: 'REB' },
  { key: 'assists', label: 'AST' },
  { key: 'steals', label: 'STL' },
  { key: 'blocks', label: 'BLK' },
  { key: 'minutes', label: 'MIN' },
  { key: 'turnovers', label: 'TOV' },
  { key: 'fouls', label: 'PF' },
  { key: 'two_pt_made', label: '2PT' },
  { key: 'three_pt_made', label: '3PT' },
  { key: 'free_throws_made', label: 'FT' },
];

const DOUBLE_DOUBLE_COMBOS: PropStatKey[][] = [
  ['points', 'rebounds'],
  ['points', 'assists'],
  ['points', 'steals'],
  ['points', 'blocks'],
  ['rebounds', 'assists'],
  ['rebounds', 'steals'],
  ['rebounds', 'blocks'],
  ['assists', 'steals'],
  ['assists', 'blocks'],
  ['steals', 'blocks'],
];

const TRIPLE_DOUBLE_STATS: PropStatKey[] = ['points', 'rebounds', 'assists'];
const LINE_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];

const PROP_STAT_TO_SORT_KEY: Record<PropStatKey, string> = {
  points: 'ppg',
  rebounds: 'rpg',
  assists: 'apg',
  steals: 'spg',
  blocks: 'bpg',
  minutes: 'mpg',
  turnovers: 'ppg',
  fouls: 'ppg',
  two_pt_made: 'ppg',
  three_pt_made: '3pm',
  free_throws_made: 'ppg',
};
const LINE_CHIP_FADE_WIDTH = 24;
const STAT_HARD_CAP: Partial<Record<PropStatKey, number>> = {
  points: 60,
  rebounds: 30,
  assists: 20,
  steals: 8,
  blocks: 8,
  minutes: 60,
  turnovers: 12,
  fouls: 6,
  two_pt_made: 25,
  three_pt_made: 15,
  free_throws_made: 20,
};

function getQuantile(sortedAscValues: number[], q: number): number {
  if (sortedAscValues.length === 0) return 0;
  const idx = (sortedAscValues.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAscValues[lo] ?? 0;
  const loVal = sortedAscValues[lo] ?? 0;
  const hiVal = sortedAscValues[hi] ?? 0;
  return loVal + (hiVal - loVal) * (idx - lo);
}

type LineChipRailProps = {
  lineOptions: number[];
  centerLine: number;
  direction: 'over' | 'under';
  selectedLines?: number[];
  onToggleLine: (lineValue: number) => void;
  formatLineLabel: (lineValue: number) => string;
  getLineHitRateText: (lineValue: number) => string;
  colors: {
    border: string;
    cardBackground: string;
    background: string;
    text: string;
    secondaryText: string;
    tint: string;
  };
};

function LineChipRail({
  lineOptions,
  centerLine,
  direction,
  selectedLines = [],
  onToggleLine,
  formatLineLabel,
  getLineHitRateText,
  colors,
}: LineChipRailProps) {
  const scrollRef = useRef<ScrollView>(null);
  const centeredOnceRef = useRef(false);
  const chipLayoutRef = useRef<Record<string, { x: number; width: number }>>({});
  const scrollViewWidthRef = useRef(0);
  const contentWidthRef = useRef(0);

  useEffect(() => {
    centeredOnceRef.current = false;
  }, [lineOptions.join('|'), centerLine]);

  const scrollToCenter = useCallback(() => {
    if (centeredOnceRef.current) return;
    const centerIdx = Math.max(
      0,
      lineOptions.findIndex((v) => Math.abs(v - centerLine) < 0.0001)
    );
    const approxChipWidth = 72;
    const targetX = Math.max(0, (centerIdx - 1) * approxChipWidth + LINE_CHIP_FADE_WIDTH);
    scrollRef.current?.scrollTo({ x: targetX, y: 0, animated: false });
    centeredOnceRef.current = true;
  }, [lineOptions, centerLine]);

  const scrollToSelected = useCallback(() => {
    if (selectedLines.length === 0 || scrollViewWidthRef.current <= 0) return;
    const lastSelected = selectedLines[selectedLines.length - 1];
    const key = String(lastSelected);
    const layout = chipLayoutRef.current[key];
    if (!layout || !scrollRef.current) return;
    const scrollX = LINE_CHIP_FADE_WIDTH + layout.x + layout.width / 2 - scrollViewWidthRef.current / 2;
    const maxScroll = Math.max(0, contentWidthRef.current - scrollViewWidthRef.current);
    const clampedX = Math.max(0, Math.min(scrollX, maxScroll));
    scrollRef.current.scrollTo({ x: clampedX, animated: true });
  }, [selectedLines]);

  useEffect(() => {
    const id = setTimeout(scrollToSelected, 50);
    return () => clearTimeout(id);
  }, [selectedLines, scrollToSelected]);

  const handleChipLayout = useCallback((lineValue: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    chipLayoutRef.current[String(lineValue)] = { x, width };
  }, []);

  const backgroundColor = colors.background;

  return (
    <View style={styles.lineChipRailWrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => {
          scrollViewWidthRef.current = e.nativeEvent.layout.width;
          scrollToCenter();
        }}
        onContentSizeChange={(w) => {
          contentWidthRef.current = w;
          scrollToCenter();
        }}
        contentContainerStyle={styles.lineChipScroll}>
        {lineOptions.map((lineValue) => {
          const isActive = selectedLines.some((v) => Math.abs(v - lineValue) < 0.0001);
          return (
            <Pressable
              key={lineValue}
              hitSlop={6}
              onLayout={(e) => handleChipLayout(lineValue, e)}
              style={({ pressed }) => [
                styles.lineChip,
                {
                  borderColor: isActive ? colors.tint : colors.border,
                  backgroundColor: isActive ? colors.cardBackground : colors.background,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={() => onToggleLine(lineValue)}>
              <ThemedText style={[styles.lineChipText, { color: isActive ? colors.tint : colors.text, lineHeight: 16 }]}>
                {/* {direction === 'over' ? 'O' : 'U'} */} {formatLineLabel(lineValue)}+
              </ThemedText>
              <ThemedText style={[styles.lineChipSubText, { color: colors.secondaryText, lineHeight: 12 }]}>
                {getLineHitRateText(lineValue)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      <LinearGradient
        colors={[backgroundColor, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.lineChipFadeEdge, styles.lineChipFadeLeft]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', backgroundColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.lineChipFadeEdge, styles.lineChipFadeRight]}
        pointerEvents="none"
      />
    </View>
  );
}

function generateId(): string {
  return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type AddPropFormProps = {
  players: Player[];
  isLoading: boolean;
  onAddProp: (prop: PlayerProp) => void;
  /** Optional callback fired after Add Selected Props batch submit completes. */
  onSubmitSelected?: () => void;
  /** Min games in game_log to show player. Default 5. Use 0 for live sim (no game_log). */
  minGamesRequired?: number;
  /** Set of athlete IDs currently on court (from play-by-play). When null/undefined, no on-court badge is shown. */
  onCourtPlayerIds?: Set<string> | null;
  /** When true, hide the "Select Props" title (e.g. when used in a screen with native header). */
  hideTitle?: boolean;
  /** When set, the form fetches paginated players from the DB instead of relying solely on `players` for listing. */
  paginationSeason?: number;
};

type SelectedPropDraft = {
  key: string;
  playerId: string;
  playerName: string;
  playerHeadshot: string;
  prop: PlayerProp;
  label: string;
};

export function AddPropForm({
  players,
  isLoading,
  onAddProp,
  onSubmitSelected,
  minGamesRequired = 5,
  onCourtPlayerIds,
  hideTitle = false,
  paginationSeason,
}: AddPropFormProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [propType, setPropType] = useState<'over_under' | 'double_double' | 'triple_double'>('over_under');
  const [stat, setStat] = useState<PropStatKey>('points');
  const [direction, setDirection] = useState<'over' | 'under'>('over');
  const [combinedCombo, setCombinedCombo] = useState<PropStatKey[]>(['points', 'rebounds']);
  const combinedComboKey = combinedCombo.join('+');
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPropDrafts, setSelectedPropDrafts] = useState<SelectedPropDraft[]>([]);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const lineStatLabel = useMemo(
    () => PROP_STAT_OPTIONS.find((o) => o.key === stat)?.label ?? stat,
    [stat]
  );

  // --- Pagination ---
  const paginationEnabled = paginationSeason != null;
  const deferredSearch = useDeferredValue(playerSearch);
  const sortKey = paginationEnabled
    ? (propType === 'over_under' ? (PROP_STAT_TO_SORT_KEY[stat] ?? 'ppg') : 'ppg')
    : 'ppg';
  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isPaginatedLoading,
  } = usePlayersPaginated(paginationSeason ?? 2026, deferredSearch, sortKey, paginationEnabled);

  const fullPlayerMap = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of players) m.set(p.athlete_id, p);
    return m;
  }, [players]);

  const paginatedPlayers = useMemo<Player[]>(() => {
    if (!paginationEnabled) return [];
    const raw: PaginatedPlayer[] = paginatedData?.pages.flatMap((p) => p.players) ?? [];
    return raw.map((pp) => {
      const full = fullPlayerMap.get(pp.athlete_id);
      if (full) return full;
      return {
        ...pp,
        game_log: (pp.recent_game_log ?? []).map((g) => ({ ...g }) as unknown as GameLogEntry),
      } as Player;
    });
  }, [paginationEnabled, paginatedData, fullPlayerMap]);

  const handlePaginatedScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!paginationEnabled || !hasNextPage || isFetchingNextPage) return;
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 400) {
        fetchNextPage();
      }
    },
    [paginationEnabled, hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  const getPlayerGameLog = useCallback((player: Player): GameLogEntry[] => {
    return ((player.game_log ?? []) as GameLogEntry[]).slice().sort((a, b) => {
      const dateCmp = String(b.game_date ?? '').localeCompare(String(a.game_date ?? ''));
      if (dateCmp !== 0) return dateCmp;
      return String(b.game_id ?? '').localeCompare(String(a.game_id ?? ''));
    });
  }, []);

  const getPlayerAvg = useCallback((player: Player, selectedStat: PropStatKey): number => {
    const log = getPlayerGameLog(player);
    if (log.length > 0) return getSeasonAvgFromGameLog(log, selectedStat);
    const fallbackByStat: Partial<Record<PropStatKey, number>> = {
      points: Number(player.ppg ?? 0),
      rebounds: Number(player.rpg ?? 0),
      assists: Number(player.apg ?? 0),
      steals: Number(player.spg ?? 0),
      blocks: Number(player.bpg ?? 0),
      minutes: Number(player.mpg ?? 0),
      turnovers: Number(player.tpg ?? 0),
      fouls: Number(player.fpg ?? 0),
    };
    return fallbackByStat[selectedStat] ?? 0;
  }, [getPlayerGameLog]);

  const getSortValue = useCallback((player: Player): number => {
    if (propType === 'over_under') return getPlayerAvg(player, stat);
    const stats = propType === 'double_double' ? combinedCombo : TRIPLE_DOUBLE_STATS;
    return stats.reduce((sum, s) => sum + getPlayerAvg(player, s), 0);
  }, [propType, combinedCombo, stat, getPlayerAvg]);

  const buildCombinedProp = useCallback((player: Player): CombinedProp => {
    const type = propType === 'double_double' ? 'double_double' : 'triple_double';
    const stats = type === 'double_double' ? combinedCombo : TRIPLE_DOUBLE_STATS;
    return {
      id: generateId(),
      type,
      playerId: player.athlete_id,
      stats,
    };
  }, [propType, combinedCombo]);

  const formatLineLabel = useCallback((lineValue: number): string => {
    return String(Math.round(lineValue));
  }, []);

  const roundToStep = useCallback((value: number, step: number): number => {
    return Math.round(value / step) * step;
  }, []);

  const clampLineByStat = useCallback((lineValue: number, selectedStat: PropStatKey): number => {
    const nonNegative = Math.max(0, lineValue);
    const hardCap = STAT_HARD_CAP[selectedStat];
    if (hardCap != null) return Math.min(hardCap, nonNegative);
    return nonNegative;
  }, []);

  const getLineOptionsForPlayer = useCallback((player: Player, selectedStat: PropStatKey): number[] => {
    const avg = getPlayerAvg(player, selectedStat);
    const center = clampLineByStat(roundToStep(avg, 1), selectedStat);
    const statSeries = getPlayerGameLog(player).map((g) => {
      if (selectedStat === 'two_pt_made') {
        const fgm = g.field_goals_made ?? 0;
        const tpm = g.three_point_made ?? 0;
        return Math.max(0, fgm - tpm);
      }
      if (selectedStat === 'three_pt_made') return g.three_point_made ?? 0;
      if (selectedStat === 'free_throws_made') return g.free_throws_made ?? 0;
      return Number((g[selectedStat as keyof GameLogEntry] as number) ?? 0);
    });

    const fallbackValues = LINE_OFFSETS.map((offset) => center + offset)
      .map((v) => clampLineByStat(v, selectedStat))
      .filter((v, idx, arr) => arr.findIndex((x) => Math.abs(x - v) < 0.0001) === idx)
      .sort((a, b) => a - b);

    if (statSeries.length < 8) return fallbackValues;

    const sortedAsc = statSeries.slice().sort((a, b) => a - b);
    const p10 = getQuantile(sortedAsc, 0.1);
    const p90 = getQuantile(sortedAsc, 0.9);
    const rangeMin = clampLineByStat(Math.floor(p10), selectedStat);
    const rangeMax = clampLineByStat(Math.ceil(p90), selectedStat);

    const percentileValues: number[] = [];
    for (let v = rangeMin; v <= rangeMax; v++) {
      percentileValues.push(v);
    }
    const values = percentileValues
      .filter((v, idx, arr) => arr.findIndex((x) => Math.abs(x - v) < 0.0001) === idx)
      .sort((a, b) => a - b);

    if (values.length >= 3) return values;
    return fallbackValues;
  }, [getPlayerAvg, roundToStep, clampLineByStat, getPlayerGameLog]);

  const filteredPlayers = useMemo(() => {
    if (paginationEnabled) return paginatedPlayers;
    const minGames = minGamesRequired ?? 5;
    const withEnoughGames = players.filter((p) => (p.game_log ?? []).length >= minGames);
    const q = playerSearch.trim().toLowerCase();
    const searched = !q
      ? withEnoughGames
      : withEnoughGames.filter(
          (p) =>
            p.athlete_display_name?.toLowerCase().includes(q) ||
            p.team_abbreviation?.toLowerCase().includes(q)
        );
    return searched.slice().sort((a, b) => getSortValue(b) - getSortValue(a));
  }, [paginationEnabled, paginatedPlayers, players, playerSearch, minGamesRequired, getSortValue]);

  const buildSingleProp = useCallback((player: Player, lineValue: number): SingleProp => {
    return {
      id: generateId(),
      type: 'over_under',
      playerId: player.athlete_id,
      stat,
      line: Math.round(lineValue),
      direction,
    };
  }, [stat, direction]);

  const getDraftKey = useCallback((prop: PlayerProp): string => {
    if (prop.type === 'over_under') {
      return `${prop.playerId}|over_under|${prop.stat}|${prop.direction}|${prop.line}`;
    }
    return `${prop.playerId}|${prop.type}|${prop.stats.join('+')}`;
  }, []);

  const formatDraftLabel = useCallback((prop: PlayerProp): string => {
    if (prop.type === 'over_under') {
      const statLabel = PROP_STAT_OPTIONS.find((o) => o.key === prop.stat)?.label ?? prop.stat;
      return `${prop.direction === 'over' ? 'O' : 'U'} ${formatLineLabel(prop.line)} ${statLabel}`;
    }
    const typeLabel = prop.type === 'double_double' ? 'Double-Double' : 'Triple-Double';
    const comboLabel = prop.stats
      .map((s) => PROP_STAT_OPTIONS.find((o) => o.key === s)?.label ?? s)
      .join('+');
    return `${comboLabel} ${typeLabel}`;
  }, [formatLineLabel]);

  const toggleDraft = useCallback((draft: SelectedPropDraft) => {
    setSelectedPropDrafts((prev) => {
      const exists = prev.some((d) => d.key === draft.key);
      if (exists) return prev.filter((d) => d.key !== draft.key);
      return [...prev, draft];
    });
  }, []);

  const selectedKeySet = useMemo(
    () => new Set(selectedPropDrafts.map((d) => d.key)),
    [selectedPropDrafts]
  );

  const selectedCount = selectedPropDrafts.length;

  useEffect(() => {
    if (selectedCount === 0) setSheetExpanded(false);
  }, [selectedCount]);

  const addSelectedLines = useCallback(() => {
    for (const draft of selectedPropDrafts) {
      const propWithId = { ...draft.prop, id: generateId() } as PlayerProp;
      onAddProp(propWithId);
    }
    setSelectedPropDrafts([]);
    onSubmitSelected?.();
  }, [selectedPropDrafts, onAddProp, onSubmitSelected]);

  const groupedSelectedByPlayer = useMemo(() => {
    const groups = new Map<
      string,
      { playerId: string; playerName: string; playerHeadshot: string; items: SelectedPropDraft[] }
    >();
    for (const draft of selectedPropDrafts) {
      const existing = groups.get(draft.playerId);
      if (existing) existing.items.push(draft);
      else {
        groups.set(draft.playerId, {
          playerId: draft.playerId,
          playerName: draft.playerName,
          playerHeadshot: draft.playerHeadshot,
          items: [draft],
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.playerName.localeCompare(b.playerName));
  }, [selectedPropDrafts]);

  const renderPlayerItem = useCallback(
    (item: Player) => {
      const isOnCourt =
        onCourtPlayerIds != null &&
        (onCourtPlayerIds.has(item.athlete_id) || onCourtPlayerIds.has(String(Number(item.athlete_id))));
      const gameLog = getPlayerGameLog(item);
      const lineOptions = propType === 'over_under' ? getLineOptionsForPlayer(item, stat) : [];
      const centerLine = lineOptions[Math.floor(lineOptions.length / 2)] ?? 0;
      const playerAvg = getPlayerAvg(item, stat);
      const selectedLinesForCurrentContext =
        propType === 'over_under'
          ? lineOptions.filter((lineValue) =>
              selectedKeySet.has(
                getDraftKey({
                  id: 'preview',
                  type: 'over_under',
                  playerId: item.athlete_id,
                  stat,
                  line: lineValue,
                  direction,
                })
              )
            )
          : [];
      const combinedDraft =
        propType !== 'over_under'
          ? (() => {
              const combinedProp = buildCombinedProp(item);
              return {
                key: getDraftKey(combinedProp),
                playerId: item.athlete_id,
                playerName: item.athlete_display_name,
                playerHeadshot: item.athlete_headshot_href,
                prop: combinedProp,
                label: formatDraftLabel(combinedProp),
              } as SelectedPropDraft;
            })()
          : null;
      const isCombinedSelected = combinedDraft != null && selectedKeySet.has(combinedDraft.key);
      return (
        <View style={[styles.playerCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <View style={styles.playerCardHeader}>
            <View style={styles.avatarColumn}>
              <Image
                source={{ uri: item.athlete_headshot_href }}
                style={[styles.playerItemImage, { backgroundColor: colors.border }]}
              />
              <View
                style={[
                  styles.avatarAvgBadge,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.cardBackground,
                  },
                ]}>
                <ThemedText style={styles.avatarAvgText}>
                  {playerAvg.toFixed(1)} {lineStatLabel}
                </ThemedText>
              </View>
            </View>
            <View style={styles.playerItemInfo}>
              <View style={styles.playerItemNameRow}>
                <ThemedText style={styles.playerItemName}>{item.athlete_display_name}</ThemedText>
                {/* {isOnCourt && (
                  <View style={styles.onCourtBadge}>
                    <ThemedText style={styles.onCourtBadgeText}>ON</ThemedText>
                  </View>
                )} */}
              </View>
              {/* <ThemedText style={styles.playerItemTeam}>
                {item.team_abbreviation} • {gameLog.length} games • avg {getPlayerAvg(item, stat).toFixed(1)} {lineStatLabel}
              </ThemedText> */}
              {propType === 'over_under' ? (
                <LineChipRail
                  lineOptions={lineOptions}
                  centerLine={centerLine}
                  direction={direction}
                  selectedLines={selectedLinesForCurrentContext}
                  onToggleLine={(lineValue) => {
                    const singleProp = buildSingleProp(item, lineValue);
                    const draft: SelectedPropDraft = {
                      key: getDraftKey(singleProp),
                      playerId: item.athlete_id,
                      playerName: item.athlete_display_name,
                      playerHeadshot: item.athlete_headshot_href,
                      prop: singleProp,
                      label: formatDraftLabel(singleProp),
                    };
                    toggleDraft(draft);
                  }}
                  formatLineLabel={formatLineLabel}
                  getLineHitRateText={(lineValue) => {
                    const lineProp: SingleProp = {
                      id: 'line-preview',
                      type: 'over_under',
                      playerId: item.athlete_id,
                      stat,
                      line: lineValue,
                      direction,
                    };
                    const lineHit = computeHitRatesByWindow(gameLog, lineProp);
                    return lineHit.season.totalGames > 0 ? `${Math.round(lineHit.season.hitRate * 100)}%` : '--';
                  }}
                  colors={{
                    border: colors.border,
                    cardBackground: colors.cardBackground,
                    background: colors.background,
                    text: colors.text,
                    secondaryText: colors.secondaryText,
                    tint: colors.tint,
                  }}
                />
              ) : null}
            </View>
          </View>

          {propType !== 'over_under' ? (
            <Pressable
              style={({ pressed }) => [
                styles.combinedAddBtn,
                {
                  backgroundColor: isCombinedSelected ? colors.cardBackground : colors.tint,
                  borderColor: isCombinedSelected ? colors.tint : colors.border,
                  borderWidth: 1,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={() => {
                if (combinedDraft) toggleDraft(combinedDraft);
              }}>
              <ThemedText style={[styles.combinedAddBtnText, { color: isCombinedSelected ? colors.tint : '#000000' }]}>
                {isCombinedSelected ? 'Selected' : 'Select'} {propType === 'double_double' ? 'Double-Double' : 'Triple-Double'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      );
    },
    [
      onCourtPlayerIds,
      getPlayerGameLog,
      getLineOptionsForPlayer,
      propType,
      stat,
      direction,
      buildCombinedProp,
      colors.border,
      colors.background,
      colors.secondaryText,
      colors.cardBackground,
      colors.tint,
      colors.text,
      formatLineLabel,
      getPlayerAvg,
      lineStatLabel,
      selectedKeySet,
      buildSingleProp,
      getDraftKey,
      formatDraftLabel,
      toggleDraft,
    ]
  );

  return (
    <ThemedView style={[styles.container, { borderColor: colors.border }]}>
      {!hideTitle && (
        <View style={styles.stickyTitleWrap}>
          <ThemedText style={styles.formTitle}>Select Props</ThemedText>
        </View>
      )}
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={[
          styles.formScrollContent,
          selectedCount > 0 && { paddingBottom: sheetExpanded ? 220 + insets.bottom : 110 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={paginationEnabled ? handlePaginatedScroll : undefined}
        scrollEventThrottle={paginationEnabled ? 200 : undefined}>
        <View style={styles.propTypeRow}>
          <ThemedText style={styles.label}>Prop type</ThemedText>
          <FilterOptionButtons
            options={[
              { key: 'over_under', label: 'Over/Under' },
              { key: 'double_double', label: 'Double-Double' },
              { key: 'triple_double', label: 'Triple-Double' },
            ]}
            value={propType}
            onSelect={(k) => setPropType(k as typeof propType)}
            colorScheme={colorScheme}
            scrollable
          />
        </View>

        {propType === 'over_under' && (
          <>
            <View style={styles.row}>
              <ThemedText style={styles.label}>Stat</ThemedText>
              <FilterOptionButtons
                options={PROP_STAT_OPTIONS}
                value={stat}
                onSelect={(k) => setStat(k as PropStatKey)}
                colorScheme={colorScheme}
                scrollable
              />
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.label}>Direction</ThemedText>
              <View style={styles.directionRow}>
                <FilterOptionButtons
                  options={[
                    { key: 'over', label: 'Over' },
                    { key: 'under', label: 'Under' },
                  ]}
                  value={direction}
                  onSelect={(k) => setDirection(k as 'over' | 'under')}
                  colorScheme={colorScheme}
                  scrollable
                />
              </View>
            </View>
          </>
        )}

        {propType === 'double_double' && (
          <View style={styles.row}>
            <ThemedText style={styles.label}>Combo</ThemedText>
            <FilterOptionButtons
              options={DOUBLE_DOUBLE_COMBOS.map((combo) => ({
                key: combo.join('+'),
                label: combo.map((s) => PROP_STAT_OPTIONS.find((o) => o.key === s)?.label ?? s).join('+'),
              }))}
              value={combinedComboKey}
              onSelect={(k) => setCombinedCombo(k.split('+') as PropStatKey[])}
              colorScheme={colorScheme}
              scrollable
            />
          </View>
        )}

        <View style={styles.row}>
          <ThemedText style={styles.label}>Players</ThemedText>
          <TextInput
            style={[
              styles.searchInputInline,
              {
                backgroundColor: colors.cardBackground,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Search players..."
            placeholderTextColor={colors.tabIconDefault}
            value={playerSearch}
            onChangeText={setPlayerSearch}
          />
        </View>

        {(paginationEnabled ? isPaginatedLoading : isLoading) ? (
          <ActivityIndicator style={styles.loader} color={colors.tint} />
        ) : (
          <View style={styles.playerListContent}>
            {filteredPlayers.map((player) => (
              <View key={player.athlete_id}>{renderPlayerItem(player)}</View>
            ))}
            {paginationEnabled && isFetchingNextPage && (
              <ActivityIndicator style={styles.loader} color={colors.tint} />
            )}
            {paginationEnabled && !hasNextPage && filteredPlayers.length > 0 && (
              <ThemedText style={styles.endOfListText}>All players loaded</ThemedText>
            )}
          </View>
        )}
      </ScrollView>

      {selectedCount > 0 && (
        <View
          style={[
            styles.bottomSheet,
            {
              borderColor: colors.border,
              // backgroundColor: colors.cardBackground,
              backgroundColor: colors.background,
              paddingBottom: 10 + insets.bottom,
            },
          ]}>
          <View style={styles.bottomSheetHeader}>
            <ThemedText style={styles.selectionCartTitle}>Selected ({selectedCount})</ThemedText>
            <Pressable
              style={[styles.expandButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              hitSlop={8}
              onPress={() => setSheetExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={sheetExpanded ? 'Collapse selected props' : 'Expand selected props'}>
              <ThemedText style={[styles.sheetArrow, { color: colors.secondaryText }]}>
                {sheetExpanded ? '▼' : '▲'}
              </ThemedText>
            </Pressable>
          </View>

          {sheetExpanded && (
            <View style={styles.selectedGroupsWrap}>
              {groupedSelectedByPlayer.map((group) => (
                <View key={group.playerId} style={{ flexDirection: 'column', gap: 8 }}>
                  <View
                    style={[
                      styles.selectedGroupCard,
                      // { borderColor: colors.border, backgroundColor: colors.background },
                    ]}>
                    <Image
                      source={{ uri: group.playerHeadshot }}
                      style={[styles.selectedItemAvatar, { backgroundColor: colors.border }]}
                    />
                    <ThemedText style={styles.selectedGroupTitle}>{group.playerName}</ThemedText>
                  </View>
                  <View style={styles.selectedGroupItems}>
                    {group.items.map((draft) => (
                      <View key={draft.key} style={[styles.selectedItemRow, { borderColor: colors.border }]}>
                        <ThemedText style={styles.selectedItemText}>{draft.label}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.bottomSheetButtonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.clearSelectedBtn,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
              onPress={() => setSelectedPropDrafts([])}
              accessibilityRole="button"
              accessibilityLabel="Clear selected props">
              <ThemedText style={[styles.clearSelectedBtnText, { color: colors.secondaryText }]}>Clear</ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.addSelectedBtn,
                { backgroundColor: colors.tint, opacity: pressed ? 0.82 : 1 },
              ]}
              onPress={addSelectedLines}
              accessibilityRole="button"
              accessibilityLabel={`Add ${selectedCount} selected props`}>
              <ThemedText style={styles.addSelectedBtnText}>Add Selected Props</ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderColor: 'transparent',
    position: 'relative',
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  stickyTitleWrap: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    opacity: 0.9,
  },
  propTypeRow: {
    marginBottom: 12,
  },
  row: {
    marginBottom: 12,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputInline: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  loader: {
    marginVertical: 24,
  },
  endOfListText: {
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.5,
    paddingVertical: 16,
  },
  playerListContent: {
    gap: 10,
  },
  playerCard: {
    // borderWidth: 1,
    // borderRadius: 10,
    // padding: 10,
    paddingVertical: 8,
  },
  playerCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarColumn: {
    position: 'relative',
    width: 96,
    alignItems: 'center',
  },
  playerItemImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarAvgBadge: {
    position: 'absolute',
    bottom: -20,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    // width: '100%',
  },
  avatarAvgText: {
    fontSize: 14,
    fontWeight: '600',
  },
  playerItemInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  playerItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  onCourtBadge: {
    backgroundColor: '#24d169',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  onCourtBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  playerItemTeam: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  hitRatesRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  hitRateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  bottomSheet: {
    position: 'absolute',
    left: -16,
    right: -16,
    bottom: 0,
    borderWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expandButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetArrow: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectionCartTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectionCartClear: {
    fontSize: 12,
    fontWeight: '500',
  },
  bottomSheetButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 2,
  },
  clearSelectedBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  clearSelectedBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectionPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  selectedGroupsWrap: {
    gap: 10,
    marginBottom: 10,
  },
  selectedGroupCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  selectedGroupItems: {
    gap: 6,
    // maxWidth: 100,
    // borderWidth: 1,
    // borderColor: 'red',
    paddingLeft: 32,
  },
  selectedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 100,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    // gap: 8,
  },
  selectedItemAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  selectedItemText: {
    fontSize: 11,
    flexShrink: 1,
  },
  selectionPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectionPillText: {
    fontSize: 11,
  },
  addSelectedBtn: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addSelectedBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  lineChipRailWrapper: {
    marginTop: 8,
    overflow: 'hidden',
  },
  lineChipScroll: {
    paddingHorizontal: LINE_CHIP_FADE_WIDTH,
    gap: 8,
  },
  lineChipFadeEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: LINE_CHIP_FADE_WIDTH,
    zIndex: 1,
  },
  lineChipFadeLeft: {
    left: 0,
  },
  lineChipFadeRight: {
    right: 0,
  },
  lineChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 4,
    minWidth: 48,
    alignItems: 'center',
  },
  lineChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  lineChipSubText: {
    fontSize: 10,
  },
  combinedAddBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  combinedAddBtnText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 12,
  },
});
