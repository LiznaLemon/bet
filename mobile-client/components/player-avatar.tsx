import { getTeamAvatarUnderlay } from '@/constants/team-avatar-underlays';
import { getTeamColor } from '@/constants/team-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDisplayPreferences, type AvatarMode } from '@/lib/display-preferences';
import { getPlayerInitials } from '@/lib/utils/player-display';
import { Image } from 'expo-image';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ThemedText } from './themed-text';

interface PlayerAvatarProps {
  uri?: string | null;
  displayName?: string | null;
  teamAbbrev?: string | null;
  mode?: AvatarMode;
  showTeamImageUnderlay?: boolean;
  overlayOpacity?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const isShort = clean.length === 3;
  const full = isShort
    ? clean.split('').map((ch) => `${ch}${ch}`).join('')
    : clean;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return `rgba(0, 0, 0, ${alpha})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function initialsTextColor(backgroundHex: string) {
  const clean = backgroundHex.replace('#', '');
  const isShort = clean.length === 3;
  const full = isShort
    ? clean.split('').map((ch) => `${ch}${ch}`).join('')
    : clean;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return '#FFFFFF';
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#101214' : '#FFFFFF';
}

export function PlayerAvatar({
  uri,
  displayName,
  teamAbbrev,
  mode,
  showTeamImageUnderlay = false,
  overlayOpacity = 0.78,
  size = 44,
  style,
}: PlayerAvatarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const { avatarMode } = useDisplayPreferences();
  const neutralBackgroundColor = Colors[colorScheme].border;
  const resolvedMode = mode ?? avatarMode;
  const shouldShowImage = resolvedMode === 'image' && !!uri;
  const initials = getPlayerInitials(displayName);
  const canShowInitials = initials.length > 0;
  // Keep small avatars readable while leaving breathing room around initials.
  const fallbackFontSize = Math.max(10, Math.round(size * 0.28));
  const teamColor = teamAbbrev ? getTeamColor(teamAbbrev) : neutralBackgroundColor;
  const hasTeamColor = !!teamAbbrev;
  const fallbackBackgroundColor = hasTeamColor ? teamColor : neutralBackgroundColor;
  const textColor = hasTeamColor ? initialsTextColor(teamColor) : Colors[colorScheme].text;
  const underlaySource = showTeamImageUnderlay ? getTeamAvatarUnderlay(teamAbbrev) : undefined;
  const overlayColor = hexToRgba(teamColor, Math.max(0, Math.min(1, overlayOpacity)));

  const computedStyle = [
    styles.base,
    { width: size, height: size, borderRadius: size / 2, backgroundColor: fallbackBackgroundColor },
    style,
  ];

  if (!shouldShowImage) {
    return (
      <View style={[computedStyle, styles.fallback]}>
        {underlaySource ? (
          <>
            <Image source={underlaySource} style={styles.overlayFill} contentFit="cover" />
            <View style={[styles.overlayFill, { backgroundColor: overlayColor }]} />
          </>
        ) : null}
        {canShowInitials ? (
          <ThemedText
            style={[
              styles.initials,
              {
                color: textColor,
                fontSize: fallbackFontSize,
                lineHeight: fallbackFontSize,
              },
            ]}>
            {initials}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={computedStyle}
      contentFit="cover"
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  overlayFill: {
    ...StyleSheet.absoluteFillObject,
  },
});
