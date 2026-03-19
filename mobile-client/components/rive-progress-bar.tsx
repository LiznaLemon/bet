import {
  Fit,
  RiveView,
  useRive,
  useRiveFile,
  useViewModelInstance,
} from '@rive-app/react-native';
import { memo, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export type RiveProgressBarProps = {
  currentValue: number;
  line: number;
  direction: 'over' | 'under';
  seasonAvg?: number;
  projectedValue?: number | null;
  averageProjectedValue?: number | null;
  statLabel: string;
  colorScheme: 'light' | 'dark';
  isGameOver?: boolean;
};

const RIVE_PROGRESS_BAR_PATH = require('../assets/rive/prop-tracker-progress-bar.riv');

export const RiveProgressBar = memo(function RiveProgressBar({
  currentValue,
  line,
  projectedValue,
  averageProjectedValue,
}: RiveProgressBarProps) {
  const { riveFile, isLoading, error } = useRiveFile(RIVE_PROGRESS_BAR_PATH);
  const viewModelInstance = useViewModelInstance(riveFile);
  const { riveViewRef, setHybridRef } = useRive();
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!viewModelInstance) return;

    const currentProp = viewModelInstance.numberProperty('currentValue');
    const targetProp = viewModelInstance.numberProperty('target');
    const topMarkerProp = viewModelInstance.numberProperty('topMarkerValue');
    const bottomMarkerProp =
      viewModelInstance.numberProperty('bottomMarkerValue');

    if (currentProp) currentProp.value = currentValue;
    if (targetProp) targetProp.value = line;
    // Use target as fallback when projected/average values are absent
    if (topMarkerProp)
      topMarkerProp.value = projectedValue ?? line;
    if (bottomMarkerProp)
      bottomMarkerProp.value = averageProjectedValue ?? line;

    // Force the state machine to advance so data binding updates are rendered.
    // State machines can "settle" when idle; playIfNeeded unsettles them.
    // Call immediately first, then defer to next frame as fallback for timing edge cases.
    // See: https://rive.app/docs/runtimes/data-binding
    riveViewRef?.playIfNeeded();

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      riveViewRef?.playIfNeeded();
    });
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    viewModelInstance,
    currentValue,
    line,
    projectedValue,
    averageProjectedValue,
    riveViewRef,
  ]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (error || !riveFile) {
    return null;
  }

  if (!viewModelInstance) {
    return null;
  }

  return (
    <View style={styles.container}>
      <RiveView
        hybridRef={setHybridRef}
        file={riveFile}
        dataBind={viewModelInstance}
        fit={Fit.Contain}
        autoPlay={true}
        style={styles.rive}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 8,
    marginBottom: 4,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: 'blue',
  },
  rive: {
    width: '100%',
    height: 90,
    // backgroundColor: 'red',
    // paddingLeft: 10,
  },
});
