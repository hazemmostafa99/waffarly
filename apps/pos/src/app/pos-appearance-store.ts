import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PosTheme = 'light' | 'dark' | 'system';
export type PosAccent = 'orange' | 'plum' | 'teal' | 'blue';

interface PosAppearanceState {
  theme: PosTheme;
  accent: PosAccent;
  setTheme: (theme: PosTheme) => void;
  setAccent: (accent: PosAccent) => void;
}

export const usePosAppearanceStore = create<PosAppearanceState>()(
  persist(
    (set) => ({
      theme: 'dark',
      accent: 'orange',
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
    }),
    {
      name: 'waffarly:pos:appearance:v1',
      version: 3,
      migrate: (persistedState) => ({
        ...(persistedState as Partial<PosAppearanceState>),
        accent: 'orange' as const,
      }),
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme, accent: state.accent }),
    },
  ),
);
