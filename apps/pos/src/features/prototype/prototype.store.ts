import { create } from 'zustand';
import { draftLine, type DraftLine } from './prototype-model.js';

interface PrototypeState {
  orderId: string;
  drafts: Record<string, DraftLine[]>;
  selectOrder: (orderId: string) => void;
  addLine: (line: DraftLine) => void;
  replaceLine: (line: DraftLine) => void;
  updateLine: (id: string, quantity: number) => void;
  clearDraft: () => void;
}
export const usePrototypeStore = create<PrototypeState>()((set) => ({
  orderId: 'sample-1048',
  drafts: { 'sample-1048': [draftLine('classic')] },
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
          .map((line) => (line.id === id ? { ...line, quantity: Math.min(99, quantity) } : line))
          .filter((line) => line.quantity > 0),
      },
    })),
  clearDraft: () => set((state) => ({ drafts: { ...state.drafts, [state.orderId]: [] } })),
}));
