import { create } from 'zustand';

const useAssembleiaStore = create((set, get) => ({
  user: null,
  token: null,
  currentAssembleia: null,
  assembleiaState: null,
  socket: null,
  isConnected: false,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setCurrentAssembleia: (assembleia) => set({ currentAssembleia: assembleia }),
  setAssembleiaState: (state) => set({ assembleiaState: state }),
  setSocket: (socket) => set({ socket }),
  setIsConnected: (isConnected) => set({ isConnected }),

  updateAssembleiaState: (patch) => set((state) => ({
    assembleiaState: { ...state.assembleiaState, ...patch }
  })),

  logout: () => set({ user: null, token: null, currentAssembleia: null, assembleiaState: null, isConnected: false }),
}));

export default useAssembleiaStore;
