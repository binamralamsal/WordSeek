import { getTelegramWebApp } from "./telegram";
import type { ThemeMode } from "./telegram-types";

const STORAGE_KEY = "wordseek:theme";

export function readStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "auto"
    ? stored
    : "auto";
}

export function storeTheme(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

function applyTelegramThemeVars() {
  const app = getTelegramWebApp();
  if (!app) return;

  for (const [key, value] of Object.entries(app.themeParams)) {
    if (!value) continue;
    document.documentElement.style.setProperty(
      `--tg-theme-${key.replaceAll("_", "-")}`,
      value,
    );
  }
}

function prefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function resolveDark(mode: ThemeMode) {
  if (mode === "dark") return true;
  if (mode === "light") return false;

  const app = getTelegramWebApp();
  return app ? app.colorScheme === "dark" : prefersDark();
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const app = getTelegramWebApp();

  applyTelegramThemeVars();

  const dark = resolveDark(mode);

  root.dataset.themeMode = mode;
  root.classList.toggle("dark", dark);

  const background =
    mode === "auto"
      ? (app?.themeParams.bg_color ?? (dark ? "#0f1115" : "#f2f5f9"))
      : dark
        ? "#0f1115"
        : "#f2f5f9";
  const header =
    mode === "auto"
      ? (app?.themeParams.secondary_bg_color ?? background)
      : background;

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", background);

  if (!app) return;

  try {
    app.setHeaderColor(header);
    app.setBackgroundColor(background);
    app.setBottomBarColor?.(background);
  } catch {
    // Older clients may not support every colour setter.
  }
}

export function subscribeToTheme(
  mode: ThemeMode,
  onChange: () => void,
): () => void {
  const app = getTelegramWebApp();
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");

  const handle = () => {
    applyTheme(mode);
    onChange();
  };

  app?.onEvent("themeChanged", handle);

  if (mode === "auto") {
    media?.addEventListener("change", handle);
  }

  return () => {
    app?.offEvent("themeChanged", handle);
    media?.removeEventListener("change", handle);
  };
}
