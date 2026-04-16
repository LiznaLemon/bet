import Feather from '@expo/vector-icons/Feather';
import { useNavigationState } from '@react-navigation/native';
import {
  Fit,
  type RiveFile,
  RiveView,
  useRive,
  useRiveBoolean,
  useRiveFile,
  useViewModelInstance,
} from '@rive-app/react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

const RIVE_MENU_ICONS = require('../assets/rive/menu_icons-v3.riv');

const ICON_SIZE = 26;

/** Rive RN lists artboards + view models on `RiveFile`; state machine names are not in this API. */
let loggedMenuIconsRiveInventory = false;

function logMenuIconsRiveInventoryOnce(riveFile: RiveFile) {
  if (!__DEV__ || loggedMenuIconsRiveInventory) return;
  loggedMenuIconsRiveInventory = true;

  const artboards = [...riveFile.artboardNames];
  const viewModels: string[] = [];
  const vmCount = riveFile.viewModelCount;
  if (typeof vmCount === 'number' && vmCount > 0) {
    for (let i = 0; i < vmCount; i++) {
      try {
        const vm = riveFile.viewModelByIndex(i);
        if (vm) viewModels.push(vm.modelName);
      } catch {
        /* ignore */
      }
    }
  }

  console.log('[RiveMenuTabIcon] menu_icons.riv — RiveFile inventory (one-shot)', {
    artboardCount: riveFile.artboardCount,
    artboards,
    viewModelCount: vmCount ?? 'unknown',
    viewModels,
    stateMachines:
      'not on RiveFile in @rive-app/react-native — open the .riv in Rive to see state machines per artboard',
  });
}

export type RiveMenuTabIconProps = {
  /** Artboard name in the Rive file (`Schedule`, `Players`, …). */
  artboardName: string;
  /** State machine name on that artboard (`ScheduleSM`, `PlayersSM`, …). */
  stateMachineName: string;
  /**
   * File-level ViewModel name (`ScheduleVM`, `PlayersVM`). Prefer this when the artboard
   * has no default ViewModel in Rive — otherwise `useViewModelInstance(artboardOnly)` returns null and nothing renders.
   */
  viewModelName?: string;
  /**
   * Rive **instance** name from the editor (passed to `createInstanceByName`).
   * Use when the .riv exports a specific instance; if omitted, `createDefaultInstance()` is used.
   */
  viewModelExportedInstanceName?: string;
  /** `(tabs)` screen name when this tab is selected (e.g. `index`, `players`). */
  activeWhenRouteName: string;
  /**
   * Binds Rive ViewModel boolean `isLightMode`. When omitted, derived from `useColorScheme()`
   * (`true` when not dark). Prefer passing from tab layout so it matches tab bar styling.
   */
  isLightMode?: boolean;
  /** Feather icon if Rive fails to bind (keeps layout from looking empty). */
  fallbackFeather?: 'calendar' | 'clipboard' | 'users';
};

/**
 * Rive-driven tab icon: named artboard + state machine, ViewModel via artboard default or `viewModelName`.
 * React Navigation renders tabBarIcon twice (focused/unfocused instances); both instances
 * read the same route from `useNavigationState` so `isActive` updates in sync when tabs change.
 */
export const RiveMenuTabIcon = memo(function RiveMenuTabIcon({
  artboardName,
  stateMachineName,
  viewModelName: viewModelNameProp,
  viewModelExportedInstanceName,
  activeWhenRouteName,
  isLightMode: isLightModeProp,
  fallbackFeather,
}: RiveMenuTabIconProps) {
  const systemScheme = useColorScheme();
  const isLightMode = isLightModeProp ?? (systemScheme ?? 'light') !== 'dark';

  const { riveFile, isLoading, error: riveLoadError } = useRiveFile(RIVE_MENU_ICONS);
  const { riveViewRef, setHybridRef } = useRive();

  const viewModelParams = useMemo(() => {
    if (viewModelNameProp) {
      return {
        viewModelName: viewModelNameProp,
        ...(viewModelExportedInstanceName
          ? { instanceName: viewModelExportedInstanceName }
          : {}),
      } as const;
    }
    return { artboardName } as const;
  }, [viewModelNameProp, artboardName, viewModelExportedInstanceName]);

  const viewModelInstance = useViewModelInstance(riveFile, viewModelParams);
  const {
    setValue: setRiveIsActive,
    error: isActiveHookError,
  } = useRiveBoolean('isActive', viewModelInstance);
  const {
    setValue: setRiveIsLightMode,
    error: isLightModeHookError,
  } = useRiveBoolean('isLightMode', viewModelInstance);

  const isActive = useNavigationState(
    (state) => state.routes[state.index]?.name === activeWhenRouteName
  );

  const rafRef = useRef<number | null>(null);

  /** Drive `isActive` on the same ViewModel instance passed to `RiveView` `dataBind`. */
  useLayoutEffect(() => {
    if (!viewModelInstance || !riveViewRef) return;

    const activeProp = viewModelInstance.booleanProperty('isActive');
    if (!activeProp) {
      console.warn(
        `[RiveMenuTabIcon] No boolean property "isActive" on ViewModel for "${artboardName}" ` +
          `(file VM: ${viewModelNameProp ?? 'artboard default'}). ` +
          'Add a boolean `isActive` on ScheduleVM / PlayersVM in Rive.'
      );
    } else {
      activeProp.value = isActive;
      setRiveIsActive(isActive);
    }

    const lightProp = viewModelInstance.booleanProperty('isLightMode');
    if (!lightProp) {
      console.warn(
        `[RiveMenuTabIcon] No boolean property "isLightMode" on ViewModel for "${artboardName}" ` +
          `(file VM: ${viewModelNameProp ?? 'artboard default'}). ` +
          'Add a boolean `isLightMode` on the tab ViewModels in menu_icons.riv.'
      );
    } else {
      lightProp.value = isLightMode;
      setRiveIsLightMode(isLightMode);
    }

    riveViewRef.playIfNeeded();

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
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
  }, [
    viewModelInstance,
    riveViewRef,
    isActive,
    isLightMode,
    setRiveIsActive,
    setRiveIsLightMode,
    artboardName,
    viewModelNameProp,
  ]);

  useEffect(() => {
    if (isActiveHookError) {
      console.warn(
        `[RiveMenuTabIcon] useRiveBoolean("isActive") (${artboardName}):`,
        isActiveHookError.message
      );
    }
  }, [isActiveHookError, artboardName]);

  useEffect(() => {
    if (isLightModeHookError) {
      console.warn(
        `[RiveMenuTabIcon] useRiveBoolean("isLightMode") (${artboardName}):`,
        isLightModeHookError.message
      );
    }
  }, [isLightModeHookError, artboardName]);

  useEffect(() => {
    if (riveLoadError) {
      console.warn(`[RiveMenuTabIcon] useRiveFile error (${artboardName}):`, riveLoadError);
    }
  }, [riveLoadError, artboardName]);

  useEffect(() => {
    if (!isLoading && riveFile) {
      logMenuIconsRiveInventoryOnce(riveFile);
    }
  }, [isLoading, riveFile]);

  useEffect(() => {
    if (!isLoading && riveFile && !viewModelInstance) {
      console.warn(
        `[RiveMenuTabIcon] No ViewModel instance for artboard "${artboardName}" / stateMachine "${stateMachineName}". ` +
          (viewModelNameProp
            ? `Check ViewModel name "${viewModelNameProp}" in menu_icons.riv.`
            : 'Set `viewModelName` (e.g. PlayersVM) if this artboard has no default ViewModel.')
      );
    }
  }, [isLoading, riveFile, viewModelInstance, artboardName, stateMachineName, viewModelNameProp]);

  if (isLoading || !riveFile) {
    return <View style={styles.placeholder} />;
  }

  if (riveLoadError || !viewModelInstance) {
    if (fallbackFeather) {
      return (
        <View style={styles.wrap}>
          <Feather name={fallbackFeather} size={ICON_SIZE} color="rgba(160,160,160,0.9)" />
        </View>
      );
    }
    return <View style={styles.placeholder} />;
  }

  return (
    <View style={styles.wrap}>
      <RiveView
        hybridRef={setHybridRef}
        file={riveFile}
        artboardName={artboardName}
        stateMachineName={stateMachineName}
        dataBind={viewModelInstance}
        fit={Fit.Contain}
        autoPlay={true}
        style={styles.rive}
        onError={(e) => console.warn(`[RiveMenuTabIcon] RiveView error (${artboardName}):`, e.message)}
      />
    </View>
  );
});

/** Schedule tab — artboard `Schedule`, state machine `ScheduleSM`, ViewModel `isActive`. */
export type RiveTabIconLightModeProps = {
  /** When set, drives Rive `isLightMode` (e.g. match tab bar). Omit to use `useColorScheme()`. */
  isLightMode?: boolean;
};

export const RiveScheduleTabIcon = memo(function RiveScheduleTabIcon({ isLightMode }: RiveTabIconLightModeProps) {
  return (
    <RiveMenuTabIcon
      artboardName="Schedule"
      stateMachineName="ScheduleSM"
      activeWhenRouteName="schedule"
      isLightMode={isLightMode}
      fallbackFeather="calendar"
    />
  );
});

/** Players tab — artboard `Players`, state machine `PlayersSM`, binds `PlayersVM.isActive`. */
export const RivePlayersTabIcon = memo(function RivePlayersTabIcon({ isLightMode }: RiveTabIconLightModeProps) {
  return (
    <RiveMenuTabIcon
      artboardName="Players"
      stateMachineName="PlayersSM"
      viewModelName="PlayersVM"
      activeWhenRouteName="players"
      isLightMode={isLightMode}
      fallbackFeather="users"
    />
  );
});

/** Settings tab — artboard `Settings`, state machine `SettingsSM`, binds `SettingsVM.isActive`. */
export const RiveSettingsTabIcon = memo(function RiveSettingsTabIcon({ isLightMode }: RiveTabIconLightModeProps) {
  return (
    <RiveMenuTabIcon
      artboardName="Settings"
      stateMachineName="SettingsSM"
      viewModelName="SettingsVM"
      activeWhenRouteName="settings"
      isLightMode={isLightMode}
      fallbackFeather="clipboard"
    />
  );
});

/** Props tab — artboard `Props`, state machine `PropsSM`, binds `PropsVM.isActive`. */
export const RivePropsTabIcon = memo(function RivePropsTabIcon({ isLightMode }: RiveTabIconLightModeProps) {
  return (
    <RiveMenuTabIcon
      artboardName="Props"
      stateMachineName="PropsSM"
      viewModelName="PropsVM"
      activeWhenRouteName="props"
      isLightMode={isLightMode}
      fallbackFeather="clipboard"
    />
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
