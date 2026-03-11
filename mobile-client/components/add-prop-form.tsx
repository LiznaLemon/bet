import { FilterOptionButtons } from '@/components/filter-option-buttons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Player } from '@/lib/types';
import type { CombinedProp, PlayerProp, PropStatKey, SingleProp } from '@/lib/types/props';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
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

function generateId(): string {
  return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type AddPropFormProps = {
  players: Player[];
  isLoading: boolean;
  onAddProp: (prop: PlayerProp) => void;
  /** Min games in game_log to show player. Default 5. Use 0 for live sim (no game_log). */
  minGamesRequired?: number;
};

export function AddPropForm({ players, isLoading, onAddProp, minGamesRequired = 5 }: AddPropFormProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [propType, setPropType] = useState<'over_under' | 'double_double' | 'triple_double'>('over_under');
  const [stat, setStat] = useState<PropStatKey>('points');
  const [line, setLine] = useState('');
  const [direction, setDirection] = useState<'over' | 'under'>('over');
  const [combinedCombo, setCombinedCombo] = useState<PropStatKey[]>(['points', 'rebounds']);
  const combinedComboKey = combinedCombo.join('+');
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const filteredPlayers = useMemo(() => {
    const minGames = minGamesRequired ?? 5;
    const withEnoughGames = players.filter((p) => (p.game_log ?? []).length >= minGames);
    if (!playerSearch.trim()) return withEnoughGames.slice(0, 50);
    const q = playerSearch.toLowerCase();
    return withEnoughGames.filter(
      (p) =>
        p.athlete_display_name?.toLowerCase().includes(q) ||
        p.team_abbreviation?.toLowerCase().includes(q)
    );
  }, [players, playerSearch, minGamesRequired]);

  const handleAddProp = useCallback(() => {
    if (!selectedPlayer) return;
    const id = generateId();
    if (propType === 'over_under') {
      const lineNum = parseFloat(line);
      if (Number.isNaN(lineNum)) return;
      const prop: SingleProp = {
        id,
        type: 'over_under',
        playerId: selectedPlayer.athlete_id,
        stat,
        line: lineNum,
        direction,
      };
      onAddProp(prop);
    } else {
      const stats = propType === 'double_double' ? combinedCombo : TRIPLE_DOUBLE_STATS;
      const prop: CombinedProp = {
        id,
        type: propType,
        playerId: selectedPlayer.athlete_id,
        stats,
      };
      onAddProp(prop);
    }
    setSelectedPlayer(null);
    setLine('');
    setShowPlayerPicker(false);
  }, [selectedPlayer, propType, stat, line, direction, combinedCombo, onAddProp]);

  const canAdd =
    selectedPlayer &&
    (propType === 'over_under' ? !Number.isNaN(parseFloat(line)) : true);

  const openPlayerPicker = useCallback(() => setShowPlayerPicker(true), []);
  const closePlayerPicker = useCallback(() => {
    setShowPlayerPicker(false);
    setPlayerSearch('');
  }, []);

  const selectPlayer = useCallback((p: Player) => {
    setSelectedPlayer(p);
    closePlayerPicker();
    Keyboard.dismiss();
  }, [closePlayerPicker]);

  const renderPlayerItem = useCallback(
    ({ item }: { item: Player }) => (
      <Pressable
        style={({ pressed }) => [
          styles.playerItem,
          { backgroundColor: colors.background },
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => selectPlayer(item)}>
        <Image source={{ uri: item.athlete_headshot_href }} style={[styles.playerItemImage, { backgroundColor: colors.border }]} />
        <View style={styles.playerItemInfo}>
          <ThemedText style={styles.playerItemName}>{item.athlete_display_name}</ThemedText>
          <ThemedText style={styles.playerItemTeam}>
            {item.team_abbreviation} • {(item.game_log ?? []).length} games
          </ThemedText>
        </View>
      </Pressable>
    ),
    [colors.background, selectPlayer]
  );

  return (
    <ThemedView style={[styles.container, { borderColor: colors.border }]}>
      <ThemedText style={styles.sectionTitle}>Add Prop</ThemedText>

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
            <ThemedText style={styles.label}>Line</ThemedText>
            <View style={styles.lineRow}>
              <FilterOptionButtons
                options={[
                  { key: 'over', label: 'Over' },
                  { key: 'under', label: 'Under' },
                ]}
                value={direction}
                onSelect={(k) => setDirection(k as 'over' | 'under')}
                colorScheme={colorScheme}
              />
              <TextInput
                style={[
                  styles.lineInput,
                  {
                    backgroundColor: colors.cardBackground,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="25.5"
                placeholderTextColor={colors.tabIconDefault}
                value={line}
                onChangeText={setLine}
                keyboardType="decimal-pad"
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

      <View style={styles.playerSelectRow}>
        <ThemedText style={styles.label}>Player</ThemedText>
        <Pressable
          style={[styles.playerSelectButton, { backgroundColor: colors.cardBackground }]}
          onPress={openPlayerPicker}>
          {selectedPlayer ? (
            <View style={styles.selectedPlayer}>
              <Image source={{ uri: selectedPlayer.athlete_headshot_href }} style={[styles.selectedPlayerImage, { backgroundColor: colors.border }]} />
              <ThemedText style={styles.selectedPlayerName}>{selectedPlayer.athlete_display_name}</ThemedText>
            </View>
          ) : (
            <ThemedText style={[styles.placeholder, { color: colors.tabIconDefault }]}>
              Tap to select player
            </ThemedText>
          )}
        </Pressable>
      </View>

      <Pressable
        style={[
          styles.addButton,
          { backgroundColor: colors.tint },
          !canAdd && styles.addButtonDisabled,
        ]}
        onPress={handleAddProp}
        disabled={!canAdd}>
        <ThemedText style={styles.addButtonText}>Add Prop</ThemedText>
      </Pressable>

      <Modal visible={showPlayerPicker} animationType="fade" transparent>
        <Pressable
          style={[styles.modalOverlay, { paddingTop: insets.top }]}
          onPress={closePlayerPicker}>
          <KeyboardAvoidingView behavior="padding" style={styles.keyboardAvoid}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Player</ThemedText>
              <Pressable onPress={closePlayerPicker} hitSlop={12}>
                <ThemedText style={[styles.modalClose, { color: colors.tint }]}>Done</ThemedText>
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.cardBackground,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Search by name or team..."
              placeholderTextColor={colors.tabIconDefault}
              value={playerSearch}
              onChangeText={setPlayerSearch}
              autoFocus
            />
            {isLoading ? (
              <ActivityIndicator style={styles.loader} color={colors.tint} />
            ) : (
              <FlatList
                data={filteredPlayers}
                keyExtractor={(item) => item.athlete_id}
                renderItem={renderPlayerItem}
                style={styles.playerList}
                keyboardShouldPersistTaps="handled"
              />
            )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
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
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lineInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minWidth: 80,
  },
  playerSelectRow: {
    marginBottom: 16,
  },
  playerSelectButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedPlayerImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  selectedPlayerName: {
    fontSize: 16,
  },
  placeholder: {
    fontSize: 16,
  },
  addButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#bbbbbb',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
  },
  keyboardAvoid: {
    flex: 1,
    width: '100%',
  },
  modalContent: {
    flex: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingBottom: 24,
    alignSelf: 'stretch',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '500',
  },
  searchInput: {
    marginHorizontal: 16,
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
  playerList: {
    flex: 1,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  playerItemImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  playerItemInfo: {
    flex: 1,
  },
  playerItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  playerItemTeam: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
});
