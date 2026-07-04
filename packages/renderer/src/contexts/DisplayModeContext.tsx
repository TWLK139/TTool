import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { DisplayMode } from '@ttool/plugin-types';

interface DisplayModeContextType {
  mode: DisplayMode;
  setMode: (mode: DisplayMode, path?: string) => void;
  previousPath: string;
}

const DisplayModeContext = createContext<DisplayModeContextType | null>(null);

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DisplayMode>('normal');
  const [previousPath, setPreviousPath] = useState('');

  useEffect(() => {
    window.ttool?.displayMode.get().then(setMode);

    const off = window.ttool?.displayMode.onChanged((newMode, path) => {
      setMode(newMode);
      if (path) {
        setPreviousPath(path);
      }
    });

    return () => {
      off?.();
    };
  }, []);

  const handleSetMode = useCallback(async (newMode: DisplayMode, path?: string) => {
    await window.ttool?.displayMode.set(newMode, path);
  }, []);

  return (
    <DisplayModeContext.Provider value={{ mode, setMode: handleSetMode, previousPath }}>
      {children}
    </DisplayModeContext.Provider>
  );
}

export function useDisplayMode() {
  const context = useContext(DisplayModeContext);
  if (!context) {
    throw new Error('useDisplayMode must be used within DisplayModeProvider');
  }
  return context;
}