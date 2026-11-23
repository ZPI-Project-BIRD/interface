import { create } from "zustand";

export type ColorMode = "light" | "dark";
export const THEME_STORAGE_KEY = "bird-color-mode";

function readSavedColorMode(): ColorMode | null {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

export function preferredColorMode(): ColorMode {
  if (typeof window === "undefined") return "light";
  const saved = readSavedColorMode();
  if (saved) return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyColorMode(mode: ColorMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

export const useThemeStore = create<{
  mode: ColorMode;
  toggle: () => void;
}>(() => ({
  mode: preferredColorMode(),
  toggle: () => {
    const mode = useThemeStore.getState().mode === "dark" ? "light" : "dark";
    useThemeStore.setState({ mode });
    applyColorMode(mode);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { return; }
  },
}));

export function initializeTheme() {
  applyColorMode(useThemeStore.getState().mode);
  const syncPreference = () => {
    const mode = preferredColorMode();
    useThemeStore.setState({ mode });
    applyColorMode(mode);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) syncPreference();
  };
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark") return;
    } catch { return; }
    syncPreference();
  };
  window.addEventListener("storage", onStorage);
  system.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    system.removeEventListener("change", onSystemChange);
  };
}
