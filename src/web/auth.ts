import type { Api } from "grammy";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "#/config/env";
import { upsertUser } from "#/core/services/users.service";
import { isUserBanned } from "#/features/miniapp/services/profile.service";
import type { MiniAppGroupContext } from "#/shared/miniapp";

export type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type TelegramWebAppChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

export type ValidatedInitData = {
  user: TelegramWebAppUser;
  chat?: TelegramWebAppChat;
  startParam?: string;
  authDate: number;
};

export type AuthContext = {
  userId: string;
  user: TelegramWebAppUser;
  group: MiniAppGroupContext | null;
};

export type AuthErrorCode =
  | "MISSING_INIT_DATA"
  | "INVALID_INIT_DATA"
  | "EXPIRED_INIT_DATA"
  | "BANNED"
  | "USER_NOT_FOUND";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;

  constructor(code: AuthErrorCode, message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

export function buildDataCheckString(params: URLSearchParams): string {
  const entries: string[] = [];

  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    entries.push(`${key}=${value}`);
  }

  return entries.sort().join("\n");
}

/**
 * Validates Telegram Web App `initData`.
 *
 * Telegram signs `sorted key=value` pairs with a secret derived from the bot
 * token. Compare the hex digest in constant time so the endpoint is not a
 * timing oracle.
 */
export function validateInitData(
  initData: string,
  options: {
    botToken?: string;
    maxAgeSeconds?: number;
    now?: number;
  } = {},
): { ok: true; data: ValidatedInitData } | { ok: false; reason: string } {
  if (!initData.trim()) {
    return { ok: false, reason: "Missing init data." };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    return { ok: false, reason: "Missing init data hash." };
  }

  const botToken = options.botToken ?? env.BOT_TOKEN;
  const secret = new Uint8Array(
    createHmac("sha256", "WebAppData").update(botToken).digest(),
  );
  const expected = new Uint8Array(
    createHmac("sha256", secret).update(buildDataCheckString(params)).digest(),
  );
  const received = new Uint8Array(Buffer.from(hash, "hex"));

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return { ok: false, reason: "Invalid init data signature." };
  }

  const authDateRaw = params.get("auth_date");
  const authDate = Number(authDateRaw);

  if (!Number.isFinite(authDate)) {
    return { ok: false, reason: "Missing init data timestamp." };
  }

  const maxAge = options.maxAgeSeconds ?? env.MINIAPP_AUTH_MAX_AGE_SECONDS;
  const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);

  if (nowSeconds - authDate > maxAge) {
    return { ok: false, reason: "Init data has expired." };
  }

  const userRaw = params.get("user");

  if (!userRaw) {
    return { ok: false, reason: "Missing Telegram user." };
  }

  let user: TelegramWebAppUser;

  try {
    const parsed = JSON.parse(userRaw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as TelegramWebAppUser).id !== "number"
    ) {
      return { ok: false, reason: "Invalid Telegram user." };
    }
    user = parsed as TelegramWebAppUser;
  } catch {
    return { ok: false, reason: "Invalid Telegram user." };
  }

  let chat: TelegramWebAppChat | undefined;

  const chatRaw = params.get("chat");
  if (chatRaw) {
    try {
      const parsed = JSON.parse(chatRaw) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as TelegramWebAppChat).id === "number"
      ) {
        chat = parsed as TelegramWebAppChat;
      }
    } catch {
      // A malformed chat context only disables group rankings.
    }
  }

  return {
    ok: true,
    data: {
      user,
      chat,
      startParam: params.get("start_param") ?? undefined,
      authDate,
    },
  };
}

const MEMBERSHIP_CACHE_TTL_MS = 5 * 60 * 1000;
const membershipCache = new Map<
  string,
  { allowed: boolean; expiresAt: number }
>();

function parseGroupIdFromStartParam(startParam: string | undefined) {
  if (!startParam) return null;

  const match = startParam.match(/^(?:g|group[_-]?)(-?\d+)$/);
  return match?.[1] ?? null;
}

async function isGroupMember(
  api: Api,
  chatId: string,
  userId: string,
): Promise<boolean> {
  const cacheKey = `${chatId}:${userId}`;
  const cached = membershipCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.allowed;
  }

  try {
    const member = await api.getChatMember(chatId, Number(userId));
    const status = member.status;
    const allowed =
      status === "creator" ||
      status === "administrator" ||
      status === "member" ||
      (status === "restricted" && member.is_member === true);

    membershipCache.set(cacheKey, {
      allowed,
      expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS,
    });

    return allowed;
  } catch {
    membershipCache.set(cacheKey, {
      allowed: false,
      expiresAt: Date.now() + 30_000,
    });
    return false;
  }
}

/**
 * Resolves the group a player opened the Mini App from. Either Telegram sends
 * the chat in `initData` (group Mini App) or a signed `start_param` carries a
 * group ID. In both cases membership is checked with the Bot API; the signed
 * parameter alone is not proof that the player belongs to the chat.
 */
export async function resolveGroupContext(
  data: ValidatedInitData,
  userId: string,
  api: Api,
): Promise<MiniAppGroupContext | null> {
  if (
    data.chat &&
    (data.chat.type === "group" || data.chat.type === "supergroup")
  ) {
    const chatId = String(data.chat.id);
    if (!(await isGroupMember(api, chatId, userId))) return null;

    return { chatId, title: data.chat.title ?? null };
  }

  const startChatId = parseGroupIdFromStartParam(data.startParam);
  if (!startChatId) return null;
  if (!(await isGroupMember(api, startChatId, userId))) return null;

  try {
    const chat = await api.getChat(startChatId);
    if (chat.type === "group" || chat.type === "supergroup") {
      return {
        chatId: startChatId,
        title: "title" in chat ? (chat.title ?? null) : null,
      };
    }
  } catch {
    // Membership already succeeded; the title is cosmetic.
  }

  return { chatId: startChatId, title: null };
}

export function displayNameForTelegramUser(user: TelegramWebAppUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

async function persistUser(
  userId: string,
  user: TelegramWebAppUser,
): Promise<void> {
  await upsertUser({
    id: userId,
    name: displayNameForTelegramUser(user),
    username: user.username ?? null,
    photoUrl: user.photo_url ?? null,
  });
}

/**
 * Authenticates an API request. In development, `MINIAPP_DEV_USER_ID` allows
 * opening the UI in a normal browser; it is ignored in production.
 */
export async function authenticateRequest(
  request: Request,
  api: Api,
): Promise<AuthContext> {
  const initData =
    request.headers.get("x-telegram-init-data") ??
    new URL(request.url).searchParams.get("initData") ??
    "";

  const devUserId =
    env.NODE_ENV !== "production" ? env.MINIAPP_DEV_USER_ID : undefined;
  const requestedDevUser = request.headers.get("x-dev-user-id");

  if (!initData && devUserId && requestedDevUser === devUserId) {
    const devUser: TelegramWebAppUser = {
      id: Number(devUserId),
      first_name: "Dev",
      last_name: "Player",
      username: "dev_player",
    };

    await persistUser(devUserId, devUser);

    if (await isUserBanned(devUserId)) {
      throw new AuthError(
        "BANNED",
        "Your WordSeek account is restricted.",
        403,
      );
    }

    return { userId: devUserId, user: devUser, group: null };
  }

  if (!initData) {
    throw new AuthError(
      "MISSING_INIT_DATA",
      "Open WordSeek from Telegram to continue.",
    );
  }

  const validation = validateInitData(initData);

  if (!validation.ok) {
    throw new AuthError(
      validation.reason.includes("expired")
        ? "EXPIRED_INIT_DATA"
        : "INVALID_INIT_DATA",
      validation.reason,
    );
  }

  const userId = String(validation.data.user.id);
  await persistUser(userId, validation.data.user);

  if (await isUserBanned(userId)) {
    throw new AuthError("BANNED", "Your WordSeek account is restricted.", 403);
  }

  return {
    userId,
    user: validation.data.user,
    group: await resolveGroupContext(validation.data, userId, api),
  };
}
