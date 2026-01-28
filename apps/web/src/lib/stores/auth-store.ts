import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@airshare/shared';
import { api } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  fetchUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(email, password);
          if (response.success && response.data) {
            const { user, accessToken } = response.data;
            api.setAccessToken(accessToken);
            set({
              user,
              accessToken,
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          } else {
            set({
              error: response.error?.message || 'Login failed',
              isLoading: false,
            });
            return false;
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
          return false;
        }
      },

      register: async (email, password, displayName) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register({ email, password, displayName });
          if (response.success && response.data) {
            const { user, accessToken } = response.data;
            api.setAccessToken(accessToken);
            set({
              user,
              accessToken,
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          } else {
            set({
              error: response.error?.message || 'Registration failed',
              isLoading: false,
            });
            return false;
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Registration failed',
            isLoading: false,
          });
          return false;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore errors during logout
        }
        api.setAccessToken(null);
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
      },

      refreshToken: async () => {
        try {
          const response = await authApi.refresh();
          if (response.success && response.data) {
            api.setAccessToken(response.data.accessToken);
            set({ accessToken: response.data.accessToken });
            return true;
          }
        } catch {
          // Token refresh failed
        }
        return false;
      },

      fetchUser: async () => {
        const { accessToken } = get();
        if (!accessToken) return;

        set({ isLoading: true });
        try {
          const response = await authApi.me();
          if (response.success && response.data) {
            set({ user: response.data.user, isLoading: false });
          } else {
            // Token might be invalid
            set({
              user: null,
              accessToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch {
          set({ isLoading: false });
        }
      },

      updateUser: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.updateProfile(data);
          if (response.success && response.data) {
            set({ user: response.data.user, isLoading: false });
          } else {
            set({
              error: response.error?.message || 'Update failed',
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Update failed',
            isLoading: false,
          });
        }
      },

      clearError: () => set({ error: null }),

      initialize: async () => {
        const { accessToken, fetchUser } = get();
        if (accessToken) {
          api.setAccessToken(accessToken);
          await fetchUser();
        }
        set({ isInitialized: true });
      },
    }),
    {
      name: 'airshare-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
