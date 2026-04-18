import { Asset } from 'expo-asset';
import { Image } from 'expo-image';

// These are the five images the onboarding screen renders. Warming them up at
// app startup (before AuthGate decides to route to /(onboarding)) moves the
// PNG decode work off the render frame of the stack's slide-in animation,
// which otherwise sometimes drops frames on cold launch.
const ONBOARDING_IMAGE_MODULES = [
  require('../assets/images/onboarding/iphone.png'),
  require('../assets/images/onboarding/iphone-shadow.png'),
  require('../assets/images/onboarding/matchup-preview.png'),
  require('../assets/images/onboarding/player-trends.png'),
  require('../assets/images/onboarding/play-by-play.png'),
];

// Max time we're willing to hold the splash screen waiting for image decode
// before giving up and showing onboarding anyway. Prevents a deadlock if
// prefetch ever hangs on a bad network / corrupted asset.
const PREFETCH_TIMEOUT_MS = 2500;

let readyPromise: Promise<void> | null = null;

function runPrefetch(): Promise<void> {
  return (async () => {
    const assets = ONBOARDING_IMAGE_MODULES.map((mod) => Asset.fromModule(mod));
    await Promise.all(
      assets.map(async (asset) => {
        if (!asset.downloaded) {
          await asset.downloadAsync();
        }
      }),
    );
    const uris = assets
      .map((asset) => asset.localUri ?? asset.uri)
      .filter((uri): uri is string => Boolean(uri));
    if (uris.length > 0) {
      await Image.prefetch(uris, 'memory-disk');
    }
  })();
}

// Kicks off the prefetch (idempotent) and returns a promise that resolves when
// the decode is complete. Safe to call from module scope and to await from
// React; the underlying work happens exactly once.
export function prefetchOnboardingAssets(): Promise<void> {
  if (readyPromise) return readyPromise;
  readyPromise = runPrefetch().catch((error) => {
    console.warn('Failed to prefetch onboarding assets', error);
  });
  return readyPromise;
}

// Convenience wrapper: resolves when prefetch is complete OR when the timeout
// elapses — whichever happens first. Use this to gate UI that should not be
// blocked indefinitely on image decode.
export function whenOnboardingAssetsReady(): Promise<void> {
  const prefetch = prefetchOnboardingAssets();
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, PREFETCH_TIMEOUT_MS));
  return Promise.race([prefetch, timeout]);
}
