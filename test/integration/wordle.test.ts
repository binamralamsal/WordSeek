import { describe, expect, test } from "bun:test";

import { redisKeys } from "#/core/redis-keys.constants";
import { ALL_WORDS } from "#/features/wordle/shared/helpers/words.helper";

import { setupTestEnvironment } from "../helpers/env";
import { seedChatTopic, seedGame, seedUser } from "../helpers/fixtures";
import { TestBot } from "../helpers/harness";

const env = setupTestEnvironment();

const PLAYER_ID = 7_001;
const GROUP_ID = -1_000_007_001;

async function startGame(bot: TestBot, command = "/new") {
  await bot.sendText(command, { id: PLAYER_ID });
  return env.db.selectFrom("games").selectAll().executeTakeFirstOrThrow();
}

function pick5(solution: string): string {
  return ALL_WORDS[5].find((word) => word !== solution)!;
}

describe("/new", () => {
  test("starts a default 5-letter game", async () => {
    const bot = new TestBot();

    const game = await startGame(bot);

    expect(bot.lastText()).toBe("Game started! Guess the 5-letter word!");
    expect(game.word).toHaveLength(5);
    expect(game.activeChat).toBe(String(PLAYER_ID));
    expect(game.topicId).toBe("general");
  });

  test("starts explicit lengths", async () => {
    const bot = new TestBot();

    await bot.sendText("/new4", { id: PLAYER_ID });
    expect(bot.lastText()).toContain("4-letter");
    expect(
      (
        await env.db
          .selectFrom("games")
          .select("word")
          .executeTakeFirstOrThrow()
      ).word,
    ).toHaveLength(4);
  });

  test("reads a length argument", async () => {
    const bot = new TestBot();

    await bot.sendText("/new 6", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("6-letter");
  });

  test("rejects unsupported lengths", async () => {
    const bot = new TestBot();

    await bot.sendText("/new 9", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("Only these lengths are allowed");
    expect(await env.db.selectFrom("games").selectAll().execute()).toHaveLength(
      0,
    );
  });

  test("honours the topic length configuration", async () => {
    await seedChatTopic(env.db, {
      chatId: String(GROUP_ID),
      topicId: "5",
      allowedLengths: [4],
    });
    const bot = new TestBot();

    await bot.sendText("/new", {
      id: PLAYER_ID,
      chatType: "forum",
      messageThreadId: 5,
    });
    expect(bot.lastText()).toContain("4-letter");

    await bot.sendText("/new6", {
      id: PLAYER_ID,
      chatType: "forum",
      messageThreadId: 5,
    });
    expect(bot.lastText()).toContain("Only these lengths are allowed");
  });
});

describe("regular guesses", () => {
  test("records a wrong guess with rich feedback", async () => {
    await seedUser(env.db, { id: String(PLAYER_ID) });
    const bot = new TestBot();
    const game = await startGame(bot);

    const guess = pick5(game.word);
    await bot.sendText(guess, { id: PLAYER_ID });

    const rich = bot.lastCall("sendRichMessage");
    expect(rich?.payload.rich_message.html).toContain("1/30 guesses");
    expect(
      await env.db.selectFrom("guesses").selectAll().execute(),
    ).toHaveLength(1);
  });

  test("rejects words outside the dictionary", async () => {
    const bot = new TestBot();
    await startGame(bot);

    await bot.sendText("zzzzz", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("is not a valid 5-letter word");
  });

  test("rejects duplicate guesses", async () => {
    await seedUser(env.db, { id: String(PLAYER_ID) });
    const bot = new TestBot();
    const game = await startGame(bot);
    const guess = pick5(game.word);

    await bot.sendText(guess, { id: PLAYER_ID });
    await bot.sendText(guess, { id: PLAYER_ID });

    expect(bot.lastText()).toContain("Someone has already guessed your word");
  });

  test("ignores guesses with the wrong length", async () => {
    const bot = new TestBot();
    await startGame(bot);
    const callsBefore = bot.calls.length;

    await bot.sendText("word", { id: PLAYER_ID });

    expect(bot.calls.slice(callsBefore)).toHaveLength(0);
  });

  test("ignores guesses when no game exists", async () => {
    const bot = new TestBot();

    await bot.sendText("crane", { id: PLAYER_ID });

    expect(bot.texts()).toHaveLength(0);
  });

  test("awards points and closes the game on a correct guess", async () => {
    await seedUser(env.db, { id: String(PLAYER_ID), name: "Ada" });
    const bot = new TestBot();
    const game = await startGame(bot);

    await bot.sendText(game.word, { id: PLAYER_ID });

    expect(bot.lastText()).toContain("Congrats! You guessed it correctly");
    expect(bot.lastText()).toContain("Added 30 to the leaderboard");

    const scores = await env.db
      .selectFrom("leaderboard")
      .select(["userId", "score", "wordLength"])
      .execute();
    expect(scores).toHaveLength(1);
    expect(scores[0]).toMatchObject({
      userId: String(PLAYER_ID),
      score: 30,
      wordLength: "5",
    });
    expect(await env.db.selectFrom("games").selectAll().execute()).toHaveLength(
      0,
    );
  });

  test("closes the game after 30 guesses", async () => {
    await seedUser(env.db, { id: String(PLAYER_ID) });
    const bot = new TestBot();
    const game = await startGame(bot);

    const decoys = ALL_WORDS[5].filter((word) => word !== game.word);
    for (const guess of decoys.slice(0, 29)) {
      await env.db
        .insertInto("guesses")
        .values({
          gameId: game.id,
          guess,
          chatId: String(PLAYER_ID),
        })
        .execute();
    }

    await bot.sendText(decoys[29]!, { id: PLAYER_ID });

    expect(bot.lastText()).toContain("Game Over! The word was");
    expect(await env.db.selectFrom("games").selectAll().execute()).toHaveLength(
      0,
    );
  });

  test("respects topic restrictions in forum groups", async () => {
    await seedUser(env.db, { id: String(PLAYER_ID) });
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: String(PLAYER_ID),
      topicId: "5",
    });
    await seedChatTopic(env.db, {
      chatId: String(GROUP_ID),
      topicId: "5",
    });

    const bot = new TestBot();
    await bot.sendText("crane", {
      id: PLAYER_ID,
      chatType: "forum",
      messageThreadId: 9,
    });

    expect(bot.texts()).toHaveLength(0);
  });
});

describe("/end", () => {
  test("reports when no game is running", async () => {
    const bot = new TestBot();

    await bot.sendText("/end", { id: PLAYER_ID });

    expect(bot.lastText()).toBe("There is no game in progress.");
  });

  test("ends immediately in private chats", async () => {
    const bot = new TestBot();
    await startGame(bot);

    await bot.sendText("/end", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("Game Ended");
    expect(await env.db.selectFrom("games").selectAll().execute()).toHaveLength(
      0,
    );
  });

  test("allows the game starter to end without a vote", async () => {
    await seedUser(env.db, { id: String(PLAYER_ID), name: "Ada" });
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: String(PLAYER_ID),
    });
    const bot = new TestBot();

    await bot.sendText("/end", { id: PLAYER_ID, chatType: "group" });

    expect(bot.lastText()).toContain("Ended by game starter");
  });

  test("allows group admins and system admins to end", async () => {
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: "4242",
    });
    const bot = new TestBot();
    bot.chatMemberStatus = "administrator";

    await bot.sendText("/end", { id: 7001, chatType: "group" });
    expect(bot.lastText()).toContain("Ended by group administrator");
  });

  test("allows authorized users to end", async () => {
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: "4242",
    });
    await env.db
      .insertInto("authorizedUsers")
      .values({
        chatId: String(GROUP_ID),
        userId: String(PLAYER_ID),
        authorizedBy: "999",
      })
      .execute();
    const bot = new TestBot();

    await bot.sendText("/end", { id: PLAYER_ID, chatType: "group" });

    expect(bot.lastText()).toContain("Ended by authorized user");
  });

  test("starts a vote for ordinary members", async () => {
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: "4242",
    });
    const bot = new TestBot();

    await bot.sendText("/end", { id: PLAYER_ID, chatType: "group" });

    expect(bot.lastText()).toContain("Vote to End Game");
    expect(bot.lastText()).toContain("1/3");

    const vote = await env.redis.get(redisKeys.vote(GROUP_ID));
    expect(vote).toContain(String(PLAYER_ID));
  });

  test("blocks a second vote while one is active", async () => {
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: "4242",
    });
    await env.redis.setex(
      redisKeys.vote(GROUP_ID),
      300,
      JSON.stringify({ voters: ["1"], initiatedAt: Date.now() }),
    );
    const bot = new TestBot();

    await bot.sendText("/end", { id: PLAYER_ID, chatType: "group" });

    expect(bot.lastText()).toContain("already in progress");
  });

  test("enforces the topic guard", async () => {
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: "4242",
      topicId: "5",
    });
    await seedChatTopic(env.db, {
      chatId: String(GROUP_ID),
      topicId: "5",
    });
    const bot = new TestBot();

    await bot.sendText("/end", {
      id: 7001,
      chatType: "forum",
      messageThreadId: 9,
    });

    expect(bot.lastText()).toContain("not set for the game");
  });
});

describe("end-game voting", () => {
  test("ends the game after three votes", async () => {
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: "4242",
    });
    await env.redis.setex(
      redisKeys.vote(GROUP_ID),
      300,
      JSON.stringify({ voters: ["1", "2"], initiatedAt: Date.now() }),
    );

    const bot = new TestBot();
    await bot.click(`vote_end ${GROUP_ID}`, {
      id: 7001,
      chatId: GROUP_ID,
      chatType: "group",
    });

    expect(bot.lastText()).toContain("Game ended");
    expect(bot.callsTo("answerCallbackQuery").at(-1)?.payload.text).toContain(
      "Voting threshold reached",
    );
    expect(await env.db.selectFrom("games").selectAll().execute()).toHaveLength(
      0,
    );
  });

  test("records a vote and updates the message", async () => {
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: "4242",
    });
    await env.redis.setex(
      redisKeys.vote(GROUP_ID),
      300,
      JSON.stringify({ voters: ["1"], initiatedAt: Date.now() }),
    );
    const bot = new TestBot();

    await bot.click(`vote_end ${GROUP_ID}`, {
      id: 7001,
      chatId: GROUP_ID,
      chatType: "group",
    });

    expect(bot.lastCall("editMessageText")?.payload.text).toContain(
      "Current votes: 2/3",
    );
    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toContain(
      "1 more votes needed",
    );
  });

  test("lets an admin end the game immediately", async () => {
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: "4242",
    });
    await env.redis.setex(
      redisKeys.vote(GROUP_ID),
      300,
      JSON.stringify({ voters: ["1"], initiatedAt: Date.now() }),
    );
    const bot = new TestBot();
    bot.chatMemberStatus = "administrator";

    await bot.click(`vote_end ${GROUP_ID}`, {
      id: 7001,
      chatId: GROUP_ID,
      chatType: "group",
    });

    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toContain(
      "Game ended by admin/game starter",
    );
  });

  test("rejects duplicate votes", async () => {
    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: "4242",
    });
    await env.redis.setex(
      redisKeys.vote(GROUP_ID),
      300,
      JSON.stringify({ voters: ["7001"], initiatedAt: Date.now() }),
    );
    const bot = new TestBot();

    await bot.click(`vote_end ${GROUP_ID}`, {
      id: 7001,
      chatId: GROUP_ID,
      chatType: "group",
    });

    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toBe(
      "You have already voted.",
    );
  });

  test("reports foreign, missing and expired votes", async () => {
    const bot = new TestBot();

    await bot.click("vote_end -1009", { id: 7001, chatType: "group" });
    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toBe(
      "This vote is not for this chat.",
    );

    await bot.click(`vote_end ${GROUP_ID}`, {
      id: 7001,
      chatId: GROUP_ID,
      chatType: "group",
    });
    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toBe(
      "No active game found.",
    );

    await seedGame(env.db, {
      activeChat: String(GROUP_ID),
      word: "crane",
      startedBy: "4242",
    });
    await bot.click(`vote_end ${GROUP_ID}`, {
      id: 7001,
      chatId: GROUP_ID,
      chatType: "group",
    });
    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toBe(
      "The voting session has expired.",
    );
  });
});

describe("wordle hint callback", () => {
  test("explains the tapped letter", async () => {
    const bot = new TestBot();

    await bot.click("wh:correct:A");

    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toContain(
      "right spot",
    );
  });

  test("acknowledges malformed hint payloads", async () => {
    const bot = new TestBot();

    await bot.click("wh:oops");

    expect(bot.callsTo("answerCallbackQuery")).toHaveLength(1);
    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toBeUndefined();
  });
});
