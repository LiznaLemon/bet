import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingPhoneMockup } from '@/components/onboarding-phone-mockup';
import { ThemedText } from '@/components/themed-text';
import { ONBOARDING_SLIDES } from '@/constants/onboarding-content';
import { useOnboardingState } from '@/lib/onboarding-state';

// Rough estimate of the non-slide chrome height (pagination + button row + gaps).
// Used only to seed the initial slide-area height so the first render is already
// laid out correctly; the actual height is corrected by onLayout below.
const CHROME_HEIGHT_ESTIMATE = 8 /* container paddingTop extra */ + 20 /* container paddingBottom extra */ + 8 /* dot height */ + 18 /* pagination marginBottom */ + 52 /* button row height */;

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { completeOnboarding: persistOnboardingCompletion } = useOnboardingState();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Seed the slide height from window metrics so the ScrollView (and all three
  // slides + images) can mount on the first render, before the stack's slide-in
  // animation begins. onLayout below trues it up if the estimate is off.
  const estimatedSlideHeight = Math.max(
    height - insets.top - insets.bottom - CHROME_HEIGHT_ESTIMATE,
    320,
  );
  const [contentHeight, setContentHeight] = useState(estimatedSlideHeight);

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
        onLayout={(e) => {
          const measured = e.nativeEvent.layout.height;
          // Only re-render if the measurement disagrees meaningfully with the
          // seeded estimate. This avoids an extra render pass in the common case.
          if (Math.abs(measured - contentHeight) > 1) {
            setContentHeight(measured);
          }
        }}>
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
