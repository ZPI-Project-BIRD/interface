import { create } from "zustand";
import type { QueryClient } from "react-query";
import { api, apiClient, ApiError, type AuthenticatedUser, type LoginCredentials } from "../api";
import { createSessionQueryClient } from "../queryClient";
import type { AnnotationDraft, DraftUpdate } from "../projects/annotationDrafts";

interface AuthState {
  user: AuthenticatedUser | null;
  sessionId: number;
  queryClient: QueryClient;
  initialized: boolean;
  loading: boolean;
  loggingOut: boolean;
  sessionExpired: boolean;
  error: string | null;
  annotationDrafts: Record<string, AnnotationDraft>;
  setAnnotationDraft: (sessionId: number, key: string, update: DraftUpdate) => void;
  initialize: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  clearSession: (expired?: boolean) => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const useAuthStore = create<AuthState>((set, get) => {
  function replaceSession(user: AuthenticatedUser | null, loggingOut = false, expired = false) {
    const previous = get();
    apiClient.resetSession();
    void previous.queryClient.cancelQueries({}, { silent: true });
    void previous.queryClient.cancelMutations();
    previous.queryClient.clear();
    set({
      user,
      sessionId: previous.sessionId + 1,
      queryClient: createSessionQueryClient(),
      initialized: true,
      loading: loggingOut,
      loggingOut,
      sessionExpired: expired,
      error: null,
      annotationDrafts: {},
    });
  }

  return {
    user: null,
    sessionId: 0,
    queryClient: createSessionQueryClient(),
    initialized: false,
    loading: false,
    loggingOut: false,
    sessionExpired: false,
    error: null,
    annotationDrafts: {},
    setAnnotationDraft: (sessionId, key, update) => set((state) => {
      if (state.sessionId !== sessionId || !state.user || state.loggingOut) return state;
      const draft = typeof update === "function" ? update(state.annotationDrafts[key]) : update;
      const annotationDrafts = { ...state.annotationDrafts };
      if (draft) annotationDrafts[key] = draft;
      else delete annotationDrafts[key];
      return { annotationDrafts };
    }),

    initialize: async () => {
      if (get().initialized || get().loading) return;
      const attempt = get().sessionId;
      set({ loading: true, error: null });
      try {
        const user = await api.auth.me();
        if (get().sessionId === attempt) replaceSession(user);
      } catch (error) {
        if (get().sessionId !== attempt) return;
        replaceSession(null);
        set({
          error: error instanceof ApiError && error.status === 401
            ? null
            : getErrorMessage(error, "Unable to verify your session."),
        });
      }
    },

    login: async (credentials) => {
      if (get().loading) throw new Error("Please wait for the current authentication request.");
      if (get().user) replaceSession(null);
      const attempt = get().sessionId;
      set({ initialized: true, loading: true, error: null, sessionExpired: false });
      try {
        const user = await api.auth.login(credentials);
        if (get().sessionId !== attempt) throw new DOMException("The session changed.", "AbortError");
        replaceSession(user);
      } catch (error) {
        if (get().sessionId === attempt) {
          set({ loading: false, error: getErrorMessage(error, "Unable to log in.") });
        }
        throw error;
      }
    },

    logout: async () => {
      if (get().loading) return;
      replaceSession(get().user, true);
      const attempt = get().sessionId;
      try {
        await api.auth.logout();
        if (get().sessionId === attempt) replaceSession(null);
      } catch (error) {
        if (get().sessionId !== attempt) return;
        if (error instanceof ApiError && error.status === 401) {
          replaceSession(null);
          return;
        }
        set({ loading: false, loggingOut: false, error: getErrorMessage(error, "Unable to log out.") });
        throw error;
      }
    },

    clearError: () => set({ error: null }),
    clearSession: (expired = false) => replaceSession(null, false, expired),
  };
});

apiClient.setUnauthorizedHandler(() => {
  const state = useAuthStore.getState();
  if (state.user && !state.loggingOut) state.clearSession(true);
});

export function isCurrentSession(sessionId: number) {
  const state = useAuthStore.getState();
  return state.sessionId === sessionId && state.user !== null && !state.loggingOut;
}

export async function withSession<T>(sessionId: number, request: () => Promise<T>): Promise<T> {
  if (!isCurrentSession(sessionId)) throw new DOMException("The session changed.", "AbortError");
  const result = await request();
  if (!isCurrentSession(sessionId)) throw new DOMException("The session changed.", "AbortError");
  return result;
}
