import type { ImageSourcePropType } from 'react-native';

import { toThreeLetterAbbrev } from '@/lib/utils/team-abbreviation';

/**
 * Static optional underlay assets for initials-mode avatars.
 * Add mappings as assets become available:
 *   ATL: require('@/assets/team-underlays/atl.png'),
 */
const TEAM_AVATAR_UNDERLAYS: Partial<Record<string, ImageSourcePropType>> = {};

export function getTeamAvatarUnderlay(teamAbbrev?: string | null): ImageSourcePropType | undefined {
  if (!teamAbbrev) return undefined;
  const normalized = toThreeLetterAbbrev(teamAbbrev);
  return TEAM_AVATAR_UNDERLAYS[normalized];
}

