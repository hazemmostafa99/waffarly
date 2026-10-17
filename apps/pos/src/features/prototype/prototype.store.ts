import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { draftLine, type DraftLine } from './prototype-model.js';

type Theme = 'light' | 'dark' | 'system';
export type PosAccent = 'orange' | 'plum' | 'teal' | 'blue';
interface PrototypeState {
  theme: Theme;
  accent: PosAccent;
  orderId: string;
  drafts: Record<string, DraftLine[]>;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: PosAccent) => void;
  selectOrder: (orderId: string) => void;
  addLine: (line: DraftLine) => void;
  replaceLine: (line: DraftLine) => void;
  updateLine: (id: string, quantity: number) => void;
  clearDraft: () => void;
}
export const usePrototypeStore = create<PrototypeState>()(
  persist(
    (set) => ({
      theme: 'light',
      accent: 'orange',
      orderId: 'sample-1048',
      drafts: { 'sample-1048': [draftLine('classic')] },
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      selectOrder: (orderId) => set({ orderId }),
      addLine: (line) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [state.orderId]: [...(state.drafts[state.orderId] ?? []), line],
          },
        })),
      replaceLine: (line) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [state.orderId]: (state.drafts[state.orderId] ?? []).map((item) =>
              item.id === line.id ? line : item,
            ),
          },
        })),
      updateLine: (id, quantity) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [state.orderId]: (state.drafts[state.orderId] ?? [])
              .map((line) =>
                line.id === id ? { ...line, quantity: Math.min(99, quantity) } : line,
              )
              .filter((line) => line.quantity > 0),
          },
        })),
      clearDraft: () => set((state) => ({ drafts: { ...state.drafts, [state.orderId]: [] } })),
    }),
    {
      name: 'waffarly:isolated-pos-design-preview:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme, accent: state.accent }),
    },
  ),
);
