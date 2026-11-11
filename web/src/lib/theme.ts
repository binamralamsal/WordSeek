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

const themeFallbacks = {
  light: {
    background: "#ffffff",
    foreground: "#17212b",
    card: "#ffffff",
    primary: "#2481cc",
    primaryForeground: "#ffffff",
    mutedForeground: "#707579",
    accentForeground: "#2481cc",
    destructive: "#d94b4b",
  },
  dark: {
    background: "#17212b",
    foreground: "#f5f5f5",
    card: "#202b36",
    primary: "#3a9cda",
    primaryForeground: "#ffffff",
    mutedForeground: "#8e8e93",
    accentForeground: "#6ab3e0",
    destructive: "#e45c5c",
  },
} as const;

function isNeutralNearBlack(value: string) {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (!hex) return false;
  const normalized =
    hex.length === 3 ? [...hex].map((part) => part + part).join("") : hex;
  const channels = normalized
    .match(/.{2}/g)
    ?.map((part) => Number.parseInt(part, 16));
  if (!channels || channels.length !== 3) return false;
  return (
    Math.max(...channels) < 58 &&
    Math.max(...channels) - Math.min(...channels) < 22
  );
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
  const activeSchemeMatches =
    !app || app.colorScheme === (dark ? "dark" : "light");
  const params = activeSchemeMatches ? (app?.themeParams ?? {}) : {};
  const fallback = themeFallbacks[dark ? "dark" : "light"];
  const color = (key: keyof typeof params, backup: string) =>
    params[key] || backup;
  const telegramBackground = color("bg_color", fallback.background);
  const foreground = color("text_color", fallback.foreground);
  const telegramCard = dark
    ? color("section_bg_color", color("secondary_bg_color", fallback.card))
    : telegramBackground;
  const neutralDark = dark && isNeutralNearBlack(telegramBackground);
  const background = telegramBackground;
  const card = neutralDark
    ? `color-mix(in srgb, ${telegramCard} 34%, #303030)`
    : telegramCard;
  const primary = color("button_color", color("link_color", fallback.primary));
  const primaryForeground = color(
    "button_text_color",
    fallback.primaryForeground,
  );
  const mutedForeground = color(
    "subtitle_text_color",
    color("hint_color", fallback.mutedForeground),
  );
  const accentForeground = color(
    "accent_text_color",
    color("link_color", fallback.accentForeground),
  );
  const destructive = color("destructive_text_color", fallback.destructive);
  const variables: Record<string, string> = {
    "--background": background,
    "--foreground": foreground,
    "--card": card,
    "--card-foreground": foreground,
    "--popover": card,
    "--popover-foreground": foreground,
    "--primary": primary,
    "--primary-foreground": primaryForeground,
    "--secondary": `color-mix(in srgb, ${foreground} 7%, ${card})`,
    "--secondary-foreground": foreground,
    "--muted": `color-mix(in srgb, ${foreground} 4%, ${card})`,
    "--muted-foreground": mutedForeground,
    "--accent": `color-mix(in srgb, ${primary} 13%, ${card})`,
    "--accent-foreground": accentForeground,
    "--destructive": destructive,
    "--destructive-foreground": "#ffffff",
    "--border":
      color("section_separator_color", "") ||
      `color-mix(in srgb, ${foreground} 10%, transparent)`,
    "--input": `color-mix(in srgb, ${foreground} 6%, ${card})`,
    "--ring": `color-mix(in srgb, ${primary} 55%, transparent)`,
    "--nav-shadow-color": dark
      ? "rgba(0, 0, 0, 0.38)"
      : "rgba(23, 33, 43, 0.14)",
    "--nav-inset-highlight": dark
      ? "rgba(255, 255, 255, 0.045)"
      : "rgba(255, 255, 255, 0.76)",
    "--nav-pill-shadow": dark
      ? "inset 0 1px 1px rgba(255,255,255,.05), 0 2px 8px rgba(0,0,0,.34)"
      : "inset 0 1px 1px rgba(255,255,255,.7), 0 2px 8px rgba(23,33,43,.12)",
  };
  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }
  root.dataset.themeMode = mode;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", background);

  if (!app) return;

  try {
    app.setHeaderColor(color("header_bg_color", background));
    app.setBackgroundColor(background);
    app.setBottomBarColor?.(color("bottom_bar_bg_color", background));
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
