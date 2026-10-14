import { create } from 'zustand';

interface AdminUiState {
  sidebarCollapsed: boolean;
  mobileNavigationOpen: boolean;
  toggleSidebar: () => void;
  setMobileNavigationOpen: (open: boolean) => void;
}

export const useAdminUiStore = create<AdminUiState>((set) => ({
  sidebarCollapsed: false,
  mobileNavigationOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileNavigationOpen: (mobileNavigationOpen) => set({ mobileNavigationOpen }),
}));
