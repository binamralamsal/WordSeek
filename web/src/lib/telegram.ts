import type { TelegramWebApp } from "./telegram-types";

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function telegramInitData(): string {
  return getTelegramWebApp()?.initData ?? "";
}

export function telegramStartParam(): string | undefined {
  return getTelegramWebApp()?.initDataUnsafe.start_param;
}

export function initTelegram() {
  const app = getTelegramWebApp();
  if (!app) return null;

  app.ready();
  app.expand();
  app.disableVerticalSwipes?.();

  try {
    app.setHeaderColor("secondary_bg_color");
    app.setBackgroundColor("bg_color");
    app.setBottomBarColor?.("bg_color");
  } catch {
    // Older Telegram clients ignore these calls.
  }

  return app;
}

export function hapticImpact(
  style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light",
) {
  try {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred(style);
  } catch {
    // Haptics are best-effort.
  }
}

export function hapticNotification(type: "error" | "success" | "warning") {
  try {
    getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type);
  } catch {
    // Haptics are best-effort.
  }
}

export function hapticSelection() {
  try {
    getTelegramWebApp()?.HapticFeedback?.selectionChanged();
  } catch {
    // Haptics are best-effort.
  }
}

export async function shareText(text: string): Promise<"shared" | "copied"> {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      // The user dismissed the sheet; fall through to copying.
    }
  }

  await navigator.clipboard.writeText(text);
  return "copied";
}

export function isTelegramMiniApp() {
  return Boolean(getTelegramWebApp()?.initData);
}
