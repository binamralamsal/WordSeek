import type { Kysely } from "kysely";

import type { DB, WordLength } from "#/database/schema";

export interface SeedUserInput {
  id: string;
  name?: string;
  username?: string | null;
}

export async function seedUser(
  db: Kysely<DB>,
  user: SeedUserInput,
): Promise<void> {
  await db
    .insertInto("users")
    .values({
      id: user.id,
      name: user.name ?? `User ${user.id}`,
      username: user.username ?? null,
    })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        name: user.name ?? `User ${user.id}`,
        username: user.username ?? null,
      }),
    )
    .execute();
}

async function ensureUser(db: Kysely<DB>, id: string): Promise<void> {
  await db
    .insertInto("users")
    .values({ id, name: `User ${id}`, username: null })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
}

export interface SeedScoreInput {
  userId: string;
  chatId?: string;
  score?: number;
  wordLength?: WordLength;
  createdAt?: Date;
}

export async function seedScore(
  db: Kysely<DB>,
  input: SeedScoreInput,
): Promise<void> {
  await ensureUser(db, input.userId);

  await db
    .insertInto("leaderboard")
    .values({
      userId: input.userId,
      chatId: input.chatId ?? "-1001",
      score: input.score ?? 10,
      wordLength: input.wordLength ?? "5",
      createdAt: input.createdAt,
    })
    .execute();
}

export interface SeedGameInput {
  activeChat: string;
  word: string;
  startedBy?: string;
  topicId?: string;
}

export async function seedGame(
  db: Kysely<DB>,
  input: SeedGameInput,
): Promise<void> {
  if (input.startedBy) {
    await ensureUser(db, input.startedBy);
  }

  await db
    .insertInto("games")
    .values({
      activeChat: input.activeChat,
      word: input.word.toLowerCase(),
      startedBy: input.startedBy ?? null,
      topicId: input.topicId ?? "general",
    })
    .execute();
}

export async function seedChatTopic(
  db: Kysely<DB>,
  input: {
    chatId: string;
    topicId: string;
    name?: string;
    shouldRecreateOnExpire?: boolean;
    allowedLengths?: number[];
  },
): Promise<void> {
  await db
    .insertInto("chatGameTopics")
    .values({
      chatId: input.chatId,
      topicId: input.topicId,
      name: input.name ?? "WordSeek",
      shouldRecreateOnExpire: input.shouldRecreateOnExpire ?? false,
      allowedLengths: input.allowedLengths ?? [4, 5, 6],
    })
    .execute();
}

export async function seedDailyWord(
  db: Kysely<DB>,
  input: { word: string; date: string; meaning?: string },
): Promise<number> {
  const inserted = await db
    .insertInto("dailyWords")
    .values({
      word: input.word,
      date: new Date(input.date),
      meaning: input.meaning ?? null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return inserted.id;
}
