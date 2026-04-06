import { ThemedText } from '@/components/themed-text';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export type UnderlineTabItem<K extends string = string> = {
  key: K;
  label: string;
  /** Renders before the label inside the tab row (e.g. status dot). */
  leading?: ReactNode;
};

/**
 * Optional overrides per layout slot. Arrays/styles are merged in order: defaults, then each slot.
 * Consumer styles win for conflicting keys—this is the usual RN pattern for reusable primitives.
 */
export type UnderlineTabBarStyles = {
  root?: StyleProp<ViewStyle>;
  tab?: StyleProp<ViewStyle>;
  tabInner?: StyleProp<ViewStyle>;
  labelRow?: StyleProp<ViewStyle>;
  label?: StyleProp<TextStyle>;
  underlineTrack?: StyleProp<ViewStyle>;
  underline?: StyleProp<ViewStyle>;
};

export type UnderlineTabBarProps<K extends string = string> = {
  tabs: readonly UnderlineTabItem<K>[];
  activeKey: K;
  onSelect: (key: K) => void;
  activeColor: string;
  inactiveColor: string;
  /**
   * Active underline width as a fraction of each tab cell (0–1).
   * Scales with layout when tabs use equal flex; cap with maxUnderlineWidth if needed.
   */
  underlineWidthFraction?: number;
  /** Optional cap for underline width in dp (long labels + wide tabs). */
  maxUnderlineWidth?: number;
  underlineHeight?: number;
  labelFontSize?: number;
  labelFontWeight?: '400' | '500' | '600' | '700';
  leadingGap?: number;
  /** @deprecated Use `styles.root` instead. */
  style?: StyleProp<ViewStyle>;
  /** Per-slot style overrides (e.g. `styles.tab` for independent padding). */
  styles?: UnderlineTabBarStyles;
  /** Uniform inset for Pressable hit area (used for top/bottom; horizontal uses 6). */
  hitSlop?: number;
};

export function UnderlineTabBar<K extends string>({
  tabs,
  activeKey,
  onSelect,
  activeColor,
  inactiveColor,
  underlineWidthFraction = 0.68,
  maxUnderlineWidth,
  underlineHeight = 2,
  labelFontSize = 14,
  labelFontWeight = '600',
  leadingGap = 6,
  style,
  styles: slotStyles,
  hitSlop = 10,
}: UnderlineTabBarProps<K>) {
  const widthPercent = `${Math.round(Math.min(1, Math.max(0.05, underlineWidthFraction)) * 100)}%` as const;

  return (
    <View
      style={[sheet.row, slotStyles?.root, style]}
      accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(tab.key)}
            style={({ pressed }) => [
              sheet.tabCell,
              { opacity: pressed ? 0.75 : 1 },
              slotStyles?.tab,
            ]}
            hitSlop={{ top: hitSlop, bottom: hitSlop, left: 6, right: 6 }}>
            <View style={[sheet.tabInner, slotStyles?.tabInner]}>
              <View style={[sheet.labelRow, { gap: leadingGap }, slotStyles?.labelRow]}>
                {tab.leading}
                <ThemedText
                  style={[
                    sheet.label,
                    {
                      fontSize: labelFontSize,
                      fontWeight: labelFontWeight,
                      color: active ? activeColor : inactiveColor,
                      // borderWidth: 1,
                      // borderColor: 'red',
                      marginBottom: 8,
                    },
                    slotStyles?.label,
                  ]}>
                  {tab.label}
                </ThemedText>
              </View>
              <View style={[sheet.underlineTrack, { height: underlineHeight }, slotStyles?.underlineTrack]}>
                {active ? (
                  <View
                    style={[
                      sheet.underline,
                      {
                        height: underlineHeight,
                        width: widthPercent,
                        maxWidth: maxUnderlineWidth,
                        backgroundColor: activeColor,
                      },
                      slotStyles?.underline,
                    ]}
                  />
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const sheet = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  tabCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tabInner: {
    alignItems: 'center',
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
  underlineTrack: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  underline: {
    borderRadius: 1,
  },
});
