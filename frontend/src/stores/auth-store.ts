import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, AuthTokens } from "@/types";
import { apiClient } from "@/lib/api";

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setTokens: (tokens: AuthTokens) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const tokens = await apiClient.post<AuthTokens>("/auth/login", {
          email,
          password,
        });
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);
        set({ tokens, isAuthenticated: true });
        await get().fetchUser();
      },

      register: async (email: string, password: string, nickname: string) => {
        const tokens = await apiClient.post<AuthTokens>("/auth/register", {
          email,
          password,
          nickname,
        });
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);
        set({ tokens, isAuthenticated: true });
        await get().fetchUser();
      },

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, tokens: null, isAuthenticated: false });
      },

      refreshToken: async () => {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) {
          get().logout();
          return;
        }
        try {
          const tokens = await apiClient.post<AuthTokens>("/auth/refresh", {
            refresh_token: refreshToken,
          });
          localStorage.setItem("access_token", tokens.access_token);
          localStorage.setItem("refresh_token", tokens.refresh_token);
          set({ tokens });
        } catch {
          get().logout();
        }
      },

      fetchUser: async () => {
        try {
          const user = await apiClient.get<User>("/auth/me");
          set({ user });
        } catch {
          get().logout();
        }
      },

      setTokens: (tokens: AuthTokens) => {
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);
        set({ tokens, isAuthenticated: true });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
