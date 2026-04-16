import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const PHONE_FRAME = require('../assets/images/onboarding/iphone.png');
const PHONE_SHADOW = require('../assets/images/onboarding/iphone-shadow.png');

const FRAME_ASPECT_RATIO = 516 / 1080;

type OnboardingPhoneMockupProps = {
  screenshotSource: number;
  width: number;
  scale?: number;
  offsetY?: number;
};

export function OnboardingPhoneMockup({
  screenshotSource,
  width,
  scale = 1,
  offsetY = 0,
}: OnboardingPhoneMockupProps) {
  const phoneWidth = width * scale;
  const phoneHeight = phoneWidth / FRAME_ASPECT_RATIO;
  const screenInsetX = phoneWidth * 0.058;
  const screenInsetTop = phoneHeight * 0.028;
  const screenInsetBottom = phoneHeight * 0.026;
  const screenRadius = phoneWidth * 0.095;

  return (
    <View
      style={[
        styles.root,
        {
          width: phoneWidth,
          height: phoneHeight,
          transform: [{ translateY: offsetY }],
        },
      ]}>
      <Image
        source={PHONE_SHADOW}
        style={styles.fullBleed}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />

      <View
        style={[
          styles.screenClip,
          {
            top: screenInsetTop,
            left: screenInsetX,
            right: screenInsetX,
            bottom: screenInsetBottom,
            borderRadius: screenRadius,
          },
        ]}>
        <Image
          source={screenshotSource}
          style={styles.fullBleed}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      </View>

      <Image
        source={PHONE_FRAME}
        style={styles.fullBleed}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
    justifyContent: 'center',
  },
  fullBleed: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  screenClip: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
});
