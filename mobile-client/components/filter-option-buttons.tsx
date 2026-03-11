import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';

export type FilterOption = {
  key: string;
  label: string;
};

type FilterOptionButtonsProps = {
  options: FilterOption[];
  value: string;
  onSelect: (key: string) => void;
  colorScheme: 'light' | 'dark';
  /** When true, horizontal scroll when overflow + fade edges. Default false. */
  scrollable?: boolean;
};

const FADE_WIDTH = 24;

/**
 * Reusable filter/sort option buttons. All buttons use cardBackground;
 * the selected option shows a tint border. Matches the players list sort UI.
 * Uses consistent border width and font weight to prevent layout shift on selection.
 */
export function FilterOptionButtons({
  options,
  value,
  onSelect,
  colorScheme,
  scrollable = false,
}: FilterOptionButtonsProps) {
  const colors = Colors[colorScheme];
  const backgroundColor = colors.background;
  const scrollRef = useRef<ScrollView>(null);
  const layoutRef = useRef<Record<string, { x: number; width: number }>>({});
  const scrollViewWidthRef = useRef(0);
  const contentWidthRef = useRef(0);

  const scrollToSelected = useCallback(() => {
    const layout = layoutRef.current[value];
    if (!layout || !scrollRef.current || scrollViewWidthRef.current <= 0) return;
    const scrollX = FADE_WIDTH + layout.x + layout.width / 2 - scrollViewWidthRef.current / 2;
    const maxScroll = Math.max(0, contentWidthRef.current - scrollViewWidthRef.current);
    const clampedX = Math.max(0, Math.min(scrollX, maxScroll));
    scrollRef.current.scrollTo({ x: clampedX, animated: true });
  }, [value]);

  useEffect(() => {
    if (!scrollable) return;
    // Defer until layout is measured
    const id = setTimeout(scrollToSelected, 50);
    return () => clearTimeout(id);
  }, [scrollable, value, scrollToSelected]);

  const handleButtonLayout = useCallback((key: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layoutRef.current[key] = { x, width };
  }, []);

  const buttons = (
    <View style={styles.buttonRow}>
      {options.map((option) => {
        const isActive = value === option.key;
        return (
          <View
            key={option.key}
            onLayout={(e) => handleButtonLayout(option.key, e)}
            collapsable={false}
          >
            <Pressable
              onPress={() => onSelect(option.key)}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: isActive ? colors.cardBackground : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                  borderWidth: 1,
                  borderColor: isActive ? colors.tint : Colors[colorScheme ?? 'light'].border,
                },
              ]}>
              <ThemedText style={[styles.buttonText, { color: isActive ? colors.tint : Colors[colorScheme ?? 'light'].secondaryText }]}>
                {option.label}
              </ThemedText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  if (!scrollable) {
    return <View style={styles.container}>{buttons}</View>;
  }

  return (
    <View
      style={[styles.container, styles.scrollableWrapper]}
      onLayout={(e) => { scrollViewWidthRef.current = e.nativeEvent.layout.width; }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={(w) => { contentWidthRef.current = w; }}
      >
        {buttons}
      </ScrollView>
      <LinearGradient
        colors={[backgroundColor, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fadeEdge, styles.fadeLeft]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', backgroundColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fadeEdge, styles.fadeRight]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 36,
  },
  scrollableWrapper: {
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: FADE_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
  },
  buttonText: {
    fontSize: 14,
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
});
