import { create } from "zustand";
import { api, apiClient, ApiError, type AuthenticatedUser, type LoginCredentials } from "../api";

interface AuthState {
  user: AuthenticatedUser | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  clearSession: () => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initialized: false,
  loading: false,
  error: null,

  initialize: async () => {
    if (get().initialized || get().loading) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const user = await api.auth.me();
      set({ user, initialized: true, loading: false });
    } catch (error) {
      set({
        user: null,
        initialized: true,
        loading: false,
        error:
          error instanceof ApiError && error.status === 401
            ? null
            : getErrorMessage(error, "Unable to verify your session."),
      });
    }
  },

  login: async (credentials) => {
    set({ loading: true, error: null });

    try {
      const user = await api.auth.login(credentials);
      set({ user, initialized: true, loading: false });
    } catch (error) {
      const message = getErrorMessage(error, "Unable to log in.");
      set({ user: null, initialized: true, loading: false, error: message });
      throw error;
    }
  },

  logout: async () => {
    set({ loading: true, error: null });

    try {
      await api.auth.logout();
      set({ user: null, initialized: true, loading: false });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        set({ user: null, initialized: true, loading: false });
        return;
      }

      const message = getErrorMessage(error, "Unable to log out.");
      set({ loading: false, error: message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  clearSession: () => set({ user: null, initialized: true, loading: false, error: null }),
}));

apiClient.setUnauthorizedHandler(() => {
  useAuthStore.getState().clearSession();
});
