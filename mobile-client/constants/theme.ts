/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

/**
 * For LinearGradient end stops: `'transparent'` is rgba(0,0,0,0), so blending from a light
 * opaque color interpolates through gray (dirty edge fades). Use same RGB @ alpha 0 instead.
 * Accepts #RGB, #RRGGBB, or #RRGGBBAA; returns #RRGGBB00.
 */
export function gradientFadeClear(solidColor: string): string {
  let h = solidColor.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  let body: string;
  if (h.length === 4) {
    body = h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  } else if (h.length === 7) {
    body = h.slice(1);
  } else if (h.length === 9) {
    body = h.slice(1, 7);
  } else {
    return '#FFFFFF00';
  }
  return `#${body}00`;
}

const tintColorLight = '#000';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    // text: '#11181C',
    text: '#000000',
    textPrimary: '#11181C',
    textSecondary: '#6B7280',
    textTertiary: '#8B949E',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    cardBackground: '#f0f0f0',
    // cardBackground: '#E5E7EB',
    border: '#e0e0e0',
    dividerSubtle: '#D1D5DB',
    chartBackground: '#e0e0e0',
    /** MiniBarChart solid fill (`useGradient: false`) */
    barBackground: '#000000',
    scoreWinner: '#16A34A',
    /** Final score for the team that lost (muted vs winner green). */
    scoreLoser: '#9CA3AF',
    scoreTeamLabel: '#11181C',
    statusLive: '#DC2626',
    chipBackgroundMuted: '#E5E7EB',
    chipText: '#374151',
    fadeEdgeBase: '#FFFFFF',
    /** Schedule date scroller strip behind day cells */
    scheduleDateStripSurface: '#ffffff',
    /** MiniBarChart gradient (`useGradient: true`) */
    chartBarGradientStart: '#000000',
    chartBarGradientEnd: '#000000',
    /** Pulsing placeholder blocks (schedule cards, matchup, player screens) */
    skeleton: '#E5E7EB',
  },
  dark: {
    text: '#ffffff',
    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    background: '#000000',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    cardBackground: '#1f2023',
    border: '#373737',
    dividerSubtle: '#3F3F46',
    chartBackground: '#373737',
    /** MiniBarChart solid fill — light on dark surfaces */
    barBackground: '#ffffff',
    // scoreWinner: '#22C55E',
    scoreWinner: '#16A34A',
    scoreLoser: '#373737',
    scoreTeamLabel: '#FFFFFF',
    statusLive: '#EF4444',
    chipBackgroundMuted: '#27272A',
    chipText: '#E5E7EB',
    fadeEdgeBase: '#000000',
    scheduleDateStripSurface: '#000000',
    /** MiniBarChart gradient on dark UI */
    chartBarGradientStart: '#58D5F0',
    chartBarGradientEnd: '#0A7EA4',
    skeleton: '#1e1e1e',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
