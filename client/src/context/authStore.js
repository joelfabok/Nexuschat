import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: err.response?.data?.error || 'Login failed' };
        }
      },

      register: async (username, email, password, displayName) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/register', { username, email, password, displayName });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: err.response?.data?.error || 'Registration failed' };
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        try { await api.post('/auth/logout', { refreshToken }); } catch (_) {}
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, accessToken: null, refreshToken: null });
      },

      setTokens: (accessToken, refreshToken) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        set({ accessToken, refreshToken });
      },

      updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'nexus-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken }),
      // After rehydration, set the token on the api instance
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.accessToken}`;
        }
      },
    }
  )
);
