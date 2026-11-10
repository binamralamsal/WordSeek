export type SizeOption = "small" | "medium" | "large";
export type InputMethod = "onscreen" | "system";

export type MiniAppPreferences = {
  keyboardSize: SizeOption;
  tileSize: number;
  inputMethod: InputMethod;
};

const STORAGE_KEY = "wordseek:game-preferences";
export const MIN_TILE_SIZE = 24;
export const MAX_TILE_SIZE = 64;

export const DEFAULT_PREFERENCES: MiniAppPreferences = {
  keyboardSize: "medium",
  tileSize: 56,
  inputMethod: "onscreen",
};

export function readPreferences(): MiniAppPreferences {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<MiniAppPreferences> | null;
    return {
      keyboardSize: isSizeOption(parsed?.keyboardSize)
        ? parsed.keyboardSize
        : DEFAULT_PREFERENCES.keyboardSize,
      tileSize: normalizeTileSize(parsed?.tileSize),
      inputMethod: parsed?.inputMethod === "system" ? "system" : "onscreen",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function storePreferences(value: MiniAppPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function isSizeOption(value: unknown): value is SizeOption {
  return value === "small" || value === "medium" || value === "large";
}

function normalizeTileSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    return DEFAULT_PREFERENCES.tileSize;
  const clamped = Math.min(MAX_TILE_SIZE, Math.max(MIN_TILE_SIZE, value));
  return MIN_TILE_SIZE + Math.round((clamped - MIN_TILE_SIZE) / 2) * 2;
}
