import { create } from "zustand";

export type ColorMode = "light" | "dark";
export const THEME_STORAGE_KEY = "bird-color-mode";

export function preferredColorMode(): ColorMode {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* Keep the toggle usable when browser storage is unavailable. */ }
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
    try { window.localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* Session-only preference. */ }
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
