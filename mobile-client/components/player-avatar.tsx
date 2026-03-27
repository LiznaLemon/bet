import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Image } from 'expo-image';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface PlayerAvatarProps {
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function PlayerAvatar({ uri, size = 44, style }: PlayerAvatarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const backgroundColor = Colors[colorScheme].border;

  const computedStyle = [
    styles.base,
    { width: size, height: size, borderRadius: size / 2, backgroundColor },
    style,
  ];

  if (!uri) {
    return <View style={computedStyle} />;
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
});
