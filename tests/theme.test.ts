import { afterEach, beforeEach, expect, test } from "bun:test";
import { initializeTheme, preferredColorMode, THEME_STORAGE_KEY, useThemeStore } from "../src/stores/themeStore";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
let saved: string | null;
let systemDark: boolean;
let storageBlocked: boolean;
let cleanup: (() => void) | undefined;
let storageListener: (event: { key: string | null }) => void;
let systemListener: () => void;
let root: { dataset: { theme?: string }; style: { colorScheme?: string } };

beforeEach(() => {
  saved = null;
  systemDark = false;
  storageBlocked = false;
  root = { dataset: {}, style: {} };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: root } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: {
      getItem: () => { if (storageBlocked) throw new Error("Storage blocked"); return saved; },
      setItem: (key: string, value: string) => {
        if (storageBlocked) throw new Error("Storage blocked");
        expect(key).toBe(THEME_STORAGE_KEY);
        saved = value;
      },
    },
    matchMedia: () => ({ matches: systemDark, addEventListener: (_: string, listener: () => void) => { systemListener = listener; }, removeEventListener() {} }),
    addEventListener: (_: string, listener: typeof storageListener) => { storageListener = listener; },
    removeEventListener() {},
  } });
  useThemeStore.setState({ mode: "light" });
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  useThemeStore.setState({ mode: "light" });
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

test("saved appearance takes priority over the system and invalid preferences fall back safely", () => {
  systemDark = true;
  expect(preferredColorMode()).toBe("dark");
  saved = "light";
  expect(preferredColorMode()).toBe("light");
  systemDark = false;
  saved = "dark";
  expect(preferredColorMode()).toBe("dark");
  saved = "invalid";
  expect(preferredColorMode()).toBe("light");
});

test("toggle applies and saves both modes for the next page load", () => {
  useThemeStore.getState().toggle();
  expect(useThemeStore.getState().mode).toBe("dark");
  expect(root.dataset.theme).toBe("dark");
  expect(root.style.colorScheme).toBe("dark");
  expect(preferredColorMode()).toBe("dark");
  useThemeStore.getState().toggle();
  expect(saved).toBe("light");
  expect(root.dataset.theme).toBe("light");
});

test("blocked local storage does not prevent changing appearance", () => {
  systemDark = true;
  storageBlocked = true;
  expect(preferredColorMode()).toBe("dark");
  expect(() => useThemeStore.getState().toggle()).not.toThrow();
  expect(useThemeStore.getState().mode).toBe("dark");
  expect(root.dataset.theme).toBe("dark");
});

test("appearance follows other tabs and system changes until a preference is saved", () => {
  cleanup = initializeTheme();
  systemDark = true;
  systemListener();
  expect(useThemeStore.getState().mode).toBe("dark");
  saved = "light";
  storageListener({ key: THEME_STORAGE_KEY });
  expect(root.dataset.theme).toBe("light");
  systemListener();
  expect(root.dataset.theme).toBe("light");
  saved = null;
  storageListener({ key: null });
  expect(root.dataset.theme).toBe("dark");
});
