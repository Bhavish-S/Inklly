import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppMode, loadMode, saveMode } from './storage';

type ModeContextValue = {
  mode: AppMode | null;
  ready: boolean;
  setMode: (mode: AppMode | null) => Promise<void>;
};

const ModeContext = createContext<ModeContextValue>({
  mode: null,
  ready: false,
  setMode: async () => undefined,
});

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadMode().then((m) => {
      setModeState(m);
      setReady(true);
    });
  }, []);

  const setMode = useCallback(async (next: AppMode | null) => {
    setModeState(next);
    await saveMode(next);
  }, []);

  const value = useMemo(() => ({ mode, ready, setMode }), [mode, ready, setMode]);
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
