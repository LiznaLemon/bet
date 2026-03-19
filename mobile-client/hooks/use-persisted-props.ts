import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerProp } from '@/lib/types/props';

const STORAGE_KEY_PREFIX = 'live-sim-props-';

function getStorageKey(gameId: string): string {
  return `${STORAGE_KEY_PREFIX}${gameId}`;
}

const storage =
  AsyncStorage && typeof AsyncStorage.getItem === 'function'
    ? AsyncStorage
    : typeof localStorage !== 'undefined'
      ? {
          getItem: (k: string) => Promise.resolve(localStorage.getItem(k)),
          setItem: (k: string, v: string) => Promise.resolve(localStorage.setItem(k, v)),
        }
      : null;

export function usePersistedProps(
  gameId: string | undefined
): [PlayerProp[], (props: PlayerProp[] | ((prev: PlayerProp[]) => PlayerProp[])) => void, () => void] {
  const [props, setPropsState] = useState<PlayerProp[]>([]);
  const isHydratedRef = useRef(false);

  const refreshFromStorage = useCallback(() => {
    if (!gameId || !storage) return;
    storage
      .getItem(getStorageKey(gameId))
      .then((raw) => {
        let parsed: PlayerProp[] = [];
        if (raw) {
          try {
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
              parsed = data.filter(
                (p): p is PlayerProp =>
                  p && typeof p === 'object' && typeof p.id === 'string' && typeof p.playerId === 'string'
              );
            }
          } catch {
            // Invalid JSON - use empty
          }
        }
        setPropsState(parsed);
      })
      .catch(() => {});
  }, [gameId]);

  const setProps = useCallback((update: PlayerProp[] | ((prev: PlayerProp[]) => PlayerProp[])) => {
    setPropsState((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!gameId) {
      setPropsState([]);
      isHydratedRef.current = false;
      return;
    }

    let cancelled = false;
    isHydratedRef.current = false;

    if (!storage) {
      isHydratedRef.current = true;
      return;
    }

    storage.getItem(getStorageKey(gameId))
      .then((raw) => {
        if (cancelled) return;
        let parsed: PlayerProp[] = [];
        if (raw) {
          try {
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
              parsed = data.filter(
                (p): p is PlayerProp =>
                  p && typeof p === 'object' && typeof p.id === 'string' && typeof p.playerId === 'string'
              );
            }
          } catch {
            // Invalid JSON - use empty
          }
        }
        setPropsState((prev) => {
          if (prev.length > 0) {
            const ids = new Set(prev.map((p) => p.id));
            const fromStorage = parsed.filter((p) => !ids.has(p.id));
            return [...prev, ...fromStorage];
          }
          return parsed;
        });
        isHydratedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) isHydratedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !isHydratedRef.current || !storage) return;
    storage.setItem(getStorageKey(gameId), JSON.stringify(props)).catch(() => {
      // Ignore save errors
    });
  }, [gameId, props]);

  return [props, setProps, refreshFromStorage];
}
