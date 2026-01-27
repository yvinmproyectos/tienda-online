import { create } from 'zustand';

export const useAuthStore = create((set) => ({
    user: null,
    isLoading: true,
    setUser: (user) => set({ user, isLoading: false }),
    setLoading: (isLoading) => set({ isLoading }),
    logout: () => set({ user: null })
}));
