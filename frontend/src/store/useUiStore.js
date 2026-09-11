import { create } from "zustand";

export const useUiStore = create((set) => ({
  sidebarOpen: true,
  chatOpen: false,
  reportModalOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setChatOpen: (open) => set({ chatOpen: open }),
  setReportModalOpen: (open) => set({ reportModalOpen: open }),
}));
