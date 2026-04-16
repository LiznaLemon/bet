import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type AvatarMode = 'image' | 'initials';
export type PlayerNameFormat = 'full' | 'initial_last';

type DisplayPreferencesContextValue = {
  avatarMode: AvatarMode;
  nameFormat: PlayerNameFormat;
  setAvatarMode: (mode: AvatarMode) => void;
  setNameFormat: (format: PlayerNameFormat) => void;
};

const DisplayPreferencesContext = createContext<DisplayPreferencesContextValue | null>(null);

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('initials');
  const [nameFormat, setNameFormat] = useState<PlayerNameFormat>('initial_last');

  const value = useMemo(
    () => ({
      avatarMode,
      nameFormat,
      setAvatarMode,
      setNameFormat,
    }),
    [avatarMode, nameFormat],
  );

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

export function useDisplayPreferences() {
  const context = useContext(DisplayPreferencesContext);
  if (!context) {
    throw new Error('useDisplayPreferences must be used within DisplayPreferencesProvider');
  }
  return context;
}
