export type OnboardingPhoneLayout = 'copy-top' | 'copy-bottom';

export type OnboardingSlide = {
  id: string;
  badge: string;
  title: string;
  description: string;
  screenshotSource: number;
  layout: OnboardingPhoneLayout;
  phoneScale?: number;
  phoneOffsetY?: number;
};

/**
 * Copy mapped from designs.pen onboarding frames:
 * - Onboarding 01 - Matchup Previews
 * - Onboarding 02 - Player Trends
 * - Onboarding 03 - Play by Play
 */
export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'matchups',
    badge: 'MATCHUP PREVIEWS',
    title: 'Stay in the know with the latest insights.',
    description:
      'Preview game matchups quickly so you can compare teams, pace, and context before tipoff.',
    screenshotSource: require('../assets/images/onboarding/matchup-preview.png'),
    layout: 'copy-top',
    phoneScale: 0.94,
    phoneOffsetY: 18,
  },
  {
    id: 'trends',
    badge: 'PLAYER TRENDS',
    title: 'Research trends from your top players.',
    description:
      'Track recent form, role changes, and consistency patterns to support smarter decisions.',
    screenshotSource: require('../assets/images/onboarding/player-trends.png'),
    layout: 'copy-bottom',
    phoneScale: 0.94,
    phoneOffsetY: -18,
  },
  {
    id: 'play-by-play',
    badge: 'PLAY BY PLAY',
    title: 'Get insights on player stats in real-time.',
    description:
      'Use live play-by-play context to understand momentum shifts and stat opportunities as games unfold.',
    screenshotSource: require('../assets/images/onboarding/play-by-play.png'),
    layout: 'copy-top',
    phoneScale: 0.94,
    phoneOffsetY: 18,
  },
];
