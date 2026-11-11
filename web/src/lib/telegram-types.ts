export type ThemeMode = "auto" | "light" | "dark";

export interface TelegramHapticFeedback {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      language_code?: string;
    };
    chat?: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    start_param?: string;
  };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string | undefined>;
  platform: string;
  version: string;
  viewportHeight: number;
  headerColor: string;
  backgroundColor: string;
  isExpanded: boolean;
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  disableVerticalSwipes?(): void;
  enableClosingConfirmation?(): void;
  onEvent(
    event: "themeChanged" | "viewportChanged" | "safeAreaChanged",
    handler: () => void,
  ): void;
  offEvent(
    event: "themeChanged" | "viewportChanged" | "safeAreaChanged",
    handler: () => void,
  ): void;
  openTelegramLink(url: string): void;
  openLink(url: string): void;
  HapticFeedback?: TelegramHapticFeedback;
  BackButton?: {
    show(): void;
    hide(): void;
    onClick(handler: () => void): void;
    offClick(handler: () => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
