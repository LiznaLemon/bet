import type { PlayerNameFormat } from '@/lib/display-preferences';

const SUFFIX_TOKENS = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

function cleanToken(token: string) {
  return token.replace(/[.,]/g, '');
}

function normalizeName(name?: string | null) {
  return (name ?? '').trim().replace(/\s+/g, ' ');
}

export function formatPlayerName(name?: string | null, format: PlayerNameFormat = 'full') {
  const normalized = normalizeName(name);
  if (!normalized) return '';
  if (format === 'full') return normalized;

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length <= 1) return normalized;

  const suffixTokens: string[] = [];
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (!last) break;
    if (!SUFFIX_TOKENS.has(cleanToken(last).toLowerCase())) break;
    suffixTokens.unshift(tokens.pop() as string);
  }

  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (!first || !last) return normalized;

  const initial = cleanToken(first).charAt(0).toUpperCase();
  if (!initial) return normalized;

  return `${initial}. ${last}${suffixTokens.length ? ` ${suffixTokens.join(' ')}` : ''}`;
}

export function getPlayerInitials(name?: string | null) {
  const normalized = normalizeName(name);
  if (!normalized) return '';
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return '';

  const firstInitial = cleanToken(tokens[0] ?? '').charAt(0).toUpperCase();
  if (tokens.length === 1) {
    const second = cleanToken(tokens[0] ?? '').charAt(1).toUpperCase();
    return `${firstInitial}${second}`.trim();
  }

  let lastIndex = tokens.length - 1;
  while (lastIndex > 0 && SUFFIX_TOKENS.has(cleanToken(tokens[lastIndex] ?? '').toLowerCase())) {
    lastIndex -= 1;
  }

  const lastInitial = cleanToken(tokens[lastIndex] ?? '').charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}`.trim();
}
