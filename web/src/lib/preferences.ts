export type SizeOption = "small" | "medium" | "large";
export type InputMethod = "onscreen" | "system";

export type MiniAppPreferences = {
  keyboardSize: SizeOption;
  tileSize: SizeOption;
  inputMethod: InputMethod;
};

const STORAGE_KEY = "wordseek:game-preferences";

export const DEFAULT_PREFERENCES: MiniAppPreferences = {
  keyboardSize: "medium",
  tileSize: "medium",
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
      tileSize: isSizeOption(parsed?.tileSize)
        ? parsed.tileSize
        : DEFAULT_PREFERENCES.tileSize,
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
