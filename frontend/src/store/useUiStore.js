import { create } from "zustand";

export const useUiStore = create((set) => ({
  sidebarOpen: true,
  chatOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setChatOpen: (open) => set({ chatOpen: open }),
}));
