import {
  DataBindMode,
  Fit,
  RiveView,
  useRive,
  useRiveBoolean,
  useRiveFile,
  useViewModelInstance,
} from '@rive-app/react-native';
import { useNavigationState } from '@react-navigation/native';
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

const RIVE_SCHEDULE_MENU_ICON = require('../assets/rive/schedule-menu-icon.riv');

const ICON_SIZE = 24;

/**
 * React Navigation renders tabBarIcon TWICE simultaneously — once with focused=true
 * and once with focused=false — then cross-fades between them via opacity.
 * This means each instance has a FIXED `focused` prop that never changes, so reacting
 * to `focused` never triggers the Rive animation.
 *
 * Fix: read the actual navigation state with useNavigationState so that BOTH instances
 * derive isActive from the same source and change together when the tab switches.
 * The tab bar's cross-fade then determines which instance is visible, while Rive's
 * animation plays correctly in the visible one.
 */
export const RiveScheduleTabIcon = memo(function RiveScheduleTabIcon() {
  const { riveFile, isLoading, error } = useRiveFile(RIVE_SCHEDULE_MENU_ICON);
  const { riveViewRef, setHybridRef } = useRive();
  const viewModelInstance = useViewModelInstance(riveViewRef);
  const { setValue: setRiveIsActive } = useRiveBoolean('isActive', viewModelInstance);

  // Both rendered instances share the same navigation state, so isActive changes
  // simultaneously in both when the tab switches.
  const isActive = useNavigationState(
    (state) => state.routes[state.index]?.name === 'index',
  );

  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!viewModelInstance || !riveViewRef) return;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    setRiveIsActive(isActive);
    riveViewRef.playIfNeeded();

    // Follow-up nudge on the next frame in case the SM needed one tick to pick up the value.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      riveViewRef.playIfNeeded();
    });

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [viewModelInstance, isActive, setRiveIsActive, riveViewRef]);

  if (isLoading || error || !riveFile) {
    return <View style={styles.placeholder} />;
  }

  return (
    <View style={styles.wrap}>
      <RiveView
        hybridRef={setHybridRef}
        file={riveFile}
        dataBind={DataBindMode.Auto}
        fit={Fit.Contain}
        autoPlay={true}
        style={styles.rive}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    overflow: 'hidden',
  },
  rive: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  placeholder: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
});
