import { Elysia } from "elysia";
import { z } from "zod";

import { env } from "#/config/env";
import {
  abandonClassicGame,
  getClassicState,
  getClassicStates,
  submitClassicGuess,
} from "#/features/miniapp/services/classic.service";
import {
  getLeaderboardPage,
  getMyRanking,
} from "#/features/miniapp/services/leaderboard.service";
import {
  findMiniAppUser,
  getMiniAppProfile,
  getMiniAppPublicProfile,
  getMiniAppUserIdByProfileId,
  updateNickname,
} from "#/features/miniapp/services/profile.service";
import {
  getDailyState,
  submitDailyGuess,
} from "#/features/wordle/daily/services/daily-play.service";
import {
  type ApiResponse,
  CLASSIC_ATTEMPTS,
  DAILY_ATTEMPTS,
  type LeaderboardPage,
  type MiniAppBootstrap,
  type MiniAppClassicState,
  type MiniAppDailyState,
  type MiniAppLeaderboardPage,
  type MiniAppLeaderboardScope,
  type MiniAppProfile,
  type MiniAppPublicProfile,
  type NicknameUpdateResponse,
} from "#/shared/miniapp";
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from "#/shared/nickname";
import {
  isLeaderboardPeriod,
  isWordLength,
  type LeaderboardPeriod,
  type WordLength,
} from "#/types";

import type { AuthContext } from "./auth";
import { AuthError } from "./auth";

const guessSchema = z.object({
  guess: z.string().min(1).max(6),
});

const startClassicSchema = z.object({
  wordLength: z.coerce.number().int(),
});
const classicGuessSchema = guessSchema.extend({
  wordLength: z.coerce.number().int(),
});

const nicknameSchema = z.object({
  nickname: z.unknown(),
});
const profileIdSchema = z.string().uuid();

function json<T>(data: T, status = 200): Response {
  return Response.json({ data } satisfies ApiResponse<T>, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(code: string, message: string, status = 400): Response {
  return Response.json(
    { error: { code, message } } satisfies ApiResponse<never>,
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function requireGroupChatId(auth: AuthContext): string {
  if (!auth.group) {
    throw new ApiRouteError(
      "GROUP_CONTEXT_REQUIRED",
      "Open WordSeek from a group to see that group's ranking.",
      400,
    );
  }

  return auth.group.chatId;
}

class ApiRouteError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ApiRouteError";
    this.code = code;
    this.status = status;
  }
}

function parseLeaderboardFilters(url: URL): {
  scope: MiniAppLeaderboardScope;
  period: LeaderboardPeriod;
  wordLength: WordLength;
  page: number;
  pageSize: number;
} {
  const scopeRaw = url.searchParams.get("scope") ?? "global";
  const periodRaw = url.searchParams.get("period") ?? "week";
  const lengthRaw = Number(url.searchParams.get("length") ?? "5");
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? "10");

  if (scopeRaw !== "global" && scopeRaw !== "group" && scopeRaw !== "private") {
    throw new ApiRouteError("INVALID_SCOPE", "Unknown leaderboard scope.");
  }

  if (!isLeaderboardPeriod(periodRaw)) {
    throw new ApiRouteError("INVALID_PERIOD", "Unknown leaderboard period.");
  }

  if (!isWordLength(lengthRaw)) {
    throw new ApiRouteError("INVALID_LENGTH", "Word length must be 4, 5 or 6.");
  }

  return {
    scope: scopeRaw,
    period: periodRaw,
    wordLength: lengthRaw,
    page: Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1,
    pageSize: Number.isFinite(pageSizeRaw) ? pageSizeRaw : 10,
  };
}

function withIsMe(
  page: LeaderboardPage,
  userId: string,
): MiniAppLeaderboardPage {
  return {
    ...page,
    rows: page.rows.map(({ userId: rowUserId, ...row }) => ({
      ...row,
      isMe: rowUserId === userId,
    })),
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiRouteError("INVALID_BODY", "Request body must be JSON.");
  }
}

async function handleBootstrap(auth: AuthContext): Promise<Response> {
  const [profile, daily, classicGames] = await Promise.all([
    getMiniAppProfile(auth.userId, auth.group),
    getDailyState(auth.userId),
    getClassicStates(auth.userId),
  ]);

  if (!profile) {
    throw new ApiRouteError(
      "USER_NOT_FOUND",
      "Your WordSeek profile could not be loaded.",
      404,
    );
  }

  if (!daily.ok) {
    throw new ApiRouteError(daily.code, daily.message, 503);
  }

  return json<MiniAppBootstrap>({
    profile,
    daily: daily.state,
    classicGames,
    config: {
      dailyAttempts: DAILY_ATTEMPTS,
      classicAttempts: CLASSIC_ATTEMPTS,
      nickname: {
        minLength: NICKNAME_MIN_LENGTH,
        maxLength: NICKNAME_MAX_LENGTH,
      },
    },
  });
}

async function handleDailyGuess(
  request: Request,
  auth: AuthContext,
): Promise<Response> {
  const parsed = guessSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    throw new ApiRouteError("INVALID_GUESS", "Send a word guess.");
  }

  const result = await submitDailyGuess(auth.userId, parsed.data.guess);

  if (!result.ok) {
    return fail(result.code, result.message);
  }

  return json<MiniAppDailyState>(result.state);
}

async function handleClassicGuess(
  request: Request,
  auth: AuthContext,
): Promise<Response> {
  const parsed = classicGuessSchema.safeParse(await readJson(request));

  if (!parsed.success || !isWordLength(parsed.data.wordLength)) {
    throw new ApiRouteError("INVALID_GUESS", "Send a guess and word length.");
  }

  const result = await submitClassicGuess(
    auth.userId,
    parsed.data.guess,
    parsed.data.wordLength,
  );

  if (!result.ok) {
    return fail(result.code, result.message);
  }

  return json<MiniAppClassicState>(result.state);
}

async function handleAbandonClassic(
  request: Request,
  auth: AuthContext,
): Promise<Response> {
  const parsed = startClassicSchema.safeParse(await readJson(request));
  if (!parsed.success || !isWordLength(parsed.data.wordLength)) {
    throw new ApiRouteError("INVALID_LENGTH", "Word length must be 4, 5 or 6.");
  }
  await abandonClassicGame(auth.userId, parsed.data.wordLength);
  return json(await getClassicState(auth.userId, parsed.data.wordLength));
}

async function handleLeaderboard(
  url: URL,
  auth: AuthContext,
): Promise<Response> {
  const filters = parseLeaderboardFilters(url);
  const chatId = leaderboardChatId(filters.scope, auth);

  const page = await getLeaderboardPage({
    ...filters,
    chatId,
  });

  return json(withIsMe(page, auth.userId));
}

async function handleMyRanking(url: URL, auth: AuthContext): Promise<Response> {
  const filters = parseLeaderboardFilters(url);
  const chatId = leaderboardChatId(filters.scope, auth);

  const ranking = await getMyRanking({
    scope: filters.scope,
    period: filters.period,
    wordLength: filters.wordLength,
    chatId,
    userId: auth.userId,
  });

  return json(ranking);
}

async function handlePublicProfileSearch(url: URL): Promise<Response> {
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 1 || query.length > 64) {
    throw new ApiRouteError(
      "INVALID_QUERY",
      "Enter a Telegram username or user ID.",
    );
  }

  const user = await findMiniAppUser(query);
  if (!user) {
    throw new ApiRouteError(
      "PROFILE_NOT_FOUND",
      "No WordSeek player matches that username or ID.",
      404,
    );
  }
  return json(user);
}

async function handlePublicProfile(
  profileIdInput: string,
  auth: AuthContext,
): Promise<Response> {
  const parsed = profileIdSchema.safeParse(profileIdInput);
  if (!parsed.success) {
    throw new ApiRouteError(
      "PROFILE_NOT_FOUND",
      "Player profile not found.",
      404,
    );
  }

  const profile = await getMiniAppPublicProfile(parsed.data, auth.group);
  if (!profile) {
    throw new ApiRouteError(
      "PROFILE_NOT_FOUND",
      "Player profile not found.",
      404,
    );
  }
  return json<MiniAppPublicProfile>(profile);
}

async function handlePublicProfileRanking(
  profileIdInput: string,
  url: URL,
  auth: AuthContext,
): Promise<Response> {
  const parsed = profileIdSchema.safeParse(profileIdInput);
  if (!parsed.success) {
    throw new ApiRouteError(
      "PROFILE_NOT_FOUND",
      "Player profile not found.",
      404,
    );
  }

  const userId = await getMiniAppUserIdByProfileId(parsed.data);
  if (!userId) {
    throw new ApiRouteError(
      "PROFILE_NOT_FOUND",
      "Player profile not found.",
      404,
    );
  }

  const filters = parseLeaderboardFilters(url);
  const ranking = await getMyRanking({
    scope: filters.scope,
    period: filters.period,
    wordLength: filters.wordLength,
    chatId: leaderboardChatId(filters.scope, auth, userId),
    userId,
  });
  return json(ranking);
}

function leaderboardChatId(
  scope: MiniAppLeaderboardScope,
  auth: AuthContext,
  privateUserId = auth.userId,
): string | undefined {
  if (scope === "group") return requireGroupChatId(auth);
  if (scope === "private") return privateUserId;
  return undefined;
}

async function handleProfile(auth: AuthContext): Promise<Response> {
  const profile = await getMiniAppProfile(auth.userId, auth.group);

  if (!profile) {
    throw new ApiRouteError(
      "USER_NOT_FOUND",
      "Your WordSeek profile could not be loaded.",
      404,
    );
  }

  return json<MiniAppProfile>(profile);
}

async function handleNickname(
  request: Request,
  auth: AuthContext,
): Promise<Response> {
  const parsed = nicknameSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    throw new ApiRouteError("INVALID_BODY", "Send a nickname.");
  }

  const result = await updateNickname(auth.userId, parsed.data.nickname);

  if (!result.ok) {
    return fail(
      result.code,
      result.message,
      result.code === "USER_NOT_FOUND" ? 404 : 400,
    );
  }

  return json<NicknameUpdateResponse>(result.data);
}

export function createMiniAppApi(auth: AuthContext) {
  return new Elysia({ prefix: "/api" })
    .get("/bootstrap", () => handleBootstrap(auth))
    .get("/me", () => handleBootstrap(auth))
    .get("/daily", async () => {
      const result = await getDailyState(auth.userId);
      return result.ok
        ? json<MiniAppDailyState>(result.state)
        : fail(result.code, result.message, 503);
    })
    .post("/daily/guess", ({ request }) => handleDailyGuess(request, auth))
    .get("/classic", async ({ request }) => {
      const length = Number(
        new URL(request.url).searchParams.get("length") ?? "5",
      );
      if (!isWordLength(length)) {
        throw new ApiRouteError(
          "INVALID_LENGTH",
          "Word length must be 4, 5 or 6.",
        );
      }
      return json<MiniAppClassicState>(
        await getClassicState(auth.userId, length),
      );
    })
    .post("/classic/guess", ({ request }) => handleClassicGuess(request, auth))
    .post("/classic/abandon", ({ request }) =>
      handleAbandonClassic(request, auth),
    )
    .get("/leaderboard", ({ request }) =>
      handleLeaderboard(new URL(request.url), auth),
    )
    .get("/leaderboard/me", ({ request }) =>
      handleMyRanking(new URL(request.url), auth),
    )
    .get("/profile/search", ({ request }) =>
      handlePublicProfileSearch(new URL(request.url)),
    )
    .get("/profile/:profileId/ranking", ({ params, request }) =>
      handlePublicProfileRanking(params.profileId, new URL(request.url), auth),
    )
    .get("/profile", () => handleProfile(auth))
    .get("/profile/:profileId", ({ params }) =>
      handlePublicProfile(params.profileId, auth),
    )
    .patch("/profile", ({ request }) => handleNickname(request, auth))
    .post("/nickname", ({ request }) => handleNickname(request, auth))
    .all("/*", () => {
      throw new ApiRouteError("NOT_FOUND", "API route not found.", 404);
    })
    .onError(({ error, set }) => {
      const response = apiErrorResponse(error);
      set.status = response.status;
      return response;
    });
}

export async function handleApiRequest(
  request: Request,
  auth: AuthContext,
): Promise<Response> {
  return await createMiniAppApi(auth).handle(request);
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return fail(error.code, error.message, error.status);
  }

  if (error instanceof ApiRouteError) {
    return fail(error.code, error.message, error.status);
  }

  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}

export function apiConfig() {
  return {
    dailyAttempts: DAILY_ATTEMPTS,
    classicAttempts: CLASSIC_ATTEMPTS,
    nickname: {
      minLength: NICKNAME_MIN_LENGTH,
      maxLength: NICKNAME_MAX_LENGTH,
    },
    miniappUrl: env.MINIAPP_URL ?? null,
  };
}
