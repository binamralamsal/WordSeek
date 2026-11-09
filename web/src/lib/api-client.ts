import type { ApiResponse } from "@shared/miniapp";

import { telegramInitData } from "./telegram";

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": telegramInitData(),
      ...(import.meta.env.VITE_DEV_USER_ID
        ? { "X-Dev-User-Id": import.meta.env.VITE_DEV_USER_ID }
        : {}),
      ...options.headers,
    },
  });
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !("data" in body)) {
    throw new Error("error" in body ? body.error.message : "Request failed.");
  }
  return body.data;
}
