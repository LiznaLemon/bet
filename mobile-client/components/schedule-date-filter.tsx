import { Colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/** Number of days to show in the past (scrollable calendar) */
export const SCHEDULE_DAYS_PAST = 60;
/** Number of days to show in the future (scrollable calendar) */
export const SCHEDULE_DAYS_FUTURE = 60;
/** Base fetch window: days behind today to fetch initially */
export const SCHEDULE_FETCH_DAYS_PAST = 7;
/** Base fetch window: days ahead of today to fetch initially */
export const SCHEDULE_FETCH_DAYS_FUTURE = 7;

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FADE_WIDTH = 24;
const CELL_GAP = 4;

function formatDateStr(dateStr: string): { dayLetter: string; dayNum: number } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    dayLetter: DAY_LETTERS[d.getDay()],
    dayNum: d.getDate(),
  };
}

function getDateStrForOffset(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type ScheduleDateFilterProps = {
  selectedDate: string;
  onDateChange: (dateStr: string) => void;
  colorScheme?: 'light' | 'dark';
};

export function ScheduleDateFilter({ selectedDate, onDateChange, colorScheme = 'dark' }: ScheduleDateFilterProps) {
  const colors = Colors[colorScheme];
  const [dayWidth, setDayWidth] = useState(44);
  const scrollRef = useRef<ScrollView>(null);
  const layoutRef = useRef<Record<number, { x: number; width: number }>>({});
  const scrollViewWidthRef = useRef(0);
  const contentWidthRef = useRef(0);

  const dates = useMemo(() => {
    const out: string[] = [];
    for (let i = -SCHEDULE_DAYS_PAST; i <= SCHEDULE_DAYS_FUTURE; i++) {
      out.push(getDateStrForOffset(i));
    }
    return out;
  }, []);

  const selectedIndex = useMemo(
    () => dates.findIndex((d) => d === selectedDate),
    [dates, selectedDate]
  );

  const scrollToSelected = useCallback(() => {
    const layout = layoutRef.current[selectedIndex];
    if (!layout || !scrollRef.current || scrollViewWidthRef.current <= 0) return;
    const scrollX =
      layout.x + layout.width / 2 - scrollViewWidthRef.current / 2;
    const maxScroll = Math.max(
      0,
      contentWidthRef.current - scrollViewWidthRef.current
    );
    const clampedX = Math.max(0, Math.min(scrollX, maxScroll));
    scrollRef.current.scrollTo({ x: clampedX, animated: true });
  }, [selectedIndex]);

  const handleWrapperLayout = useCallback((e: LayoutChangeEvent) => {
    scrollViewWidthRef.current = e.nativeEvent.layout.width;
    const w = e.nativeEvent.layout.width - FADE_WIDTH * 2;
    const daysVisible = 7;
    const itemWidth = Math.max(36, Math.min(56, w / daysVisible));
    setDayWidth(itemWidth);
  }, []);

  const handleCellLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layoutRef.current[index] = { x, width };
  }, []);

  useEffect(() => {
    const id = setTimeout(scrollToSelected, 100);
    return () => clearTimeout(id);
  }, [selectedDate, scrollToSelected]);

  const handleContentSizeChange = useCallback(
    (w: number) => {
      contentWidthRef.current = w;
      setTimeout(scrollToSelected, 50);
    },
    [scrollToSelected]
  );

  const todayStr = getDateStrForOffset(0);

  return (
    <View style={styles.wrapper} onLayout={handleWrapperLayout}>
      <View style={[styles.container, styles.scrollableWrapper]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={handleContentSizeChange}
        >
          {dates.map((dateStr, index) => {
            const { dayLetter, dayNum } = formatDateStr(dateStr);
            const isSelected = dateStr === selectedDate;
            const isPast = dateStr < todayStr;

            return (
              <View
                key={dateStr}
                onLayout={(e) => handleCellLayout(index, e)}
                collapsable={false}
                style={index > 0 ? { marginLeft: CELL_GAP } : undefined}
              >
                <Pressable
                  onPress={() => onDateChange(dateStr)}
                  style={[
                    styles.dayCell,
                    { width: dayWidth, minWidth: dayWidth },
                    isSelected && {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.tint,
                    },
                    isPast && !isSelected && styles.dayCellPast,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayLetter,
                      isSelected && { color: colors.tint },
                    ]}
                  >
                    {dayLetter}
                  </Text>
                  <Text
                    style={[
                      styles.dayNum,
                      isSelected && { color: colors.tint },
                    ]}
                  >
                    {dayNum}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
        <LinearGradient
          colors={['#000000', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fadeEdge, styles.fadeLeft]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fadeEdge, styles.fadeRight]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  container: {
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  scrollableWrapper: {
    overflow: 'hidden',
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: FADE_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.35)',
    backgroundColor: '#000000',
  },
  dayCellPast: {
    opacity: 0.5,
  },
  fadeEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: FADE_WIDTH,
    zIndex: 1,
  },
  fadeLeft: {
    left: 0,
  },
  fadeRight: {
    right: 0,
  },
  dayLetter: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 2,
  },
  dayNum: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
  },
});
