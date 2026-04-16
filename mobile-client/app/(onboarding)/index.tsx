import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingPhoneMockup } from '@/components/onboarding-phone-mockup';
import { ThemedText } from '@/components/themed-text';
import { ONBOARDING_SLIDES } from '@/constants/onboarding-content';
import { useOnboardingState } from '@/lib/onboarding-state';

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { completeOnboarding: persistOnboardingCompletion } = useOnboardingState();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const activeSlide = ONBOARDING_SLIDES[index];
  const isLast = index === ONBOARDING_SLIDES.length - 1;
  const pageWidth = width; // full screen width; slideArea uses negative margin to escape container padding
  const phoneWidth = Math.min(width * 0.78, 360);
  const bottomHeroHeight = Math.min(Math.max(height * 0.42, 320), 460);

  const scrollToIndex = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * pageWidth, animated: true });
  };

  const finishOnboarding = async () => {
    setIsSubmitting(true);
    try {
      await persistOnboardingCompletion();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 },
      ]}>
      <View
        style={styles.slideArea}
        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
        {contentHeight > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
              setIndex(newIndex);
            }}
            style={styles.pager}
            contentContainerStyle={styles.pagerContent}>
            {ONBOARDING_SLIDES.map((slide) => (
              <View key={slide.id} style={{ width: pageWidth, height: contentHeight, paddingBottom: 24 }}>
                {slide.layout === 'copy-top' ? (
                  <>
                    <View style={styles.copyWrapTop}>
                      <View style={styles.badgePill}>
                        <ThemedText style={styles.badgeText}>{slide.badge}</ThemedText>
                      </View>
                      <ThemedText style={styles.title}>{slide.title}</ThemedText>
                    </View>

                    <View style={[styles.deviceStage, styles.deviceStageTop]}>
                      <OnboardingPhoneMockup
                        screenshotSource={slide.screenshotSource}
                        width={phoneWidth}
                        scale={slide.phoneScale}
                        offsetY={slide.phoneOffsetY}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <View
                      style={[styles.deviceStage, styles.deviceStageBottom, { height: bottomHeroHeight }]}>
                      <OnboardingPhoneMockup
                        screenshotSource={slide.screenshotSource}
                        width={phoneWidth}
                        scale={slide.phoneScale}
                        offsetY={slide.phoneOffsetY}
                      />
                    </View>

                    <View style={styles.copyWrapBottom}>
                      <View style={styles.badgePill}>
                        <ThemedText style={styles.badgeText}>{slide.badge}</ThemedText>
                      </View>
                      <ThemedText style={styles.title}>{slide.title}</ThemedText>
                    </View>

                    <View style={styles.spacer} />
                  </>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.pagination}>
        {ONBOARDING_SLIDES.map((slide, dotIndex) => {
          const selected = dotIndex === index;
          return (
            <View
              key={slide.id}
              style={[
                styles.dot,
                {
                  width: selected ? 24 : 8,
                  backgroundColor: selected ? '#111111' : '#D4D4D8',
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          disabled={isSubmitting}
          onPress={() => {
            if (isLast) {
              void finishOnboarding();
            } else {
              const next = index + 1;
              setIndex(next);
              scrollToIndex(next);
            }
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            { opacity: pressed || isSubmitting ? 0.75 : 1 },
          ]}>
          <ThemedText style={styles.primaryText}>
            {isLast ? (isSubmitting ? 'Finishing...' : 'Get started') : 'Next'}
          </ThemedText>
        </Pressable>

        {!isLast && (
          <Pressable
            disabled={isSubmitting}
            onPress={() => void finishOnboarding()}
            style={({ pressed }) => [
              styles.skipButton,
              { opacity: pressed || isSubmitting ? 0.5 : 1 },
            ]}>
            <ThemedText style={styles.skipText}>Skip</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  slideArea: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: -24, // break out of container paddingHorizontal so slides are full width
  },
  pager: {
    flex: 1,
  },
  pagerContent: {
    flexDirection: 'row',
  },
  copyWrapTop: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 16,
  },
  copyWrapBottom: {
    paddingHorizontal: 24,
    marginTop: 18,
    gap: 16,
  },
  badgePill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  deviceStage: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  deviceStageTop: {
    flex: 1,
    marginTop: 8,
    justifyContent: 'flex-start',
  },
  deviceStageBottom: {
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  title: {
    color: '#111111',
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  pagination: {
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 999,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 3,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  skipText: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '600',
  },
});
