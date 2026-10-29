import { afterAll, describe, expect, test } from "bun:test";

import { setCaptchaEnqueuer } from "#/features/admin/captcha/captcha-queue.service";
import { captchaSchema } from "#/features/admin/captcha/captcha.schema";
import { SLOT_SYMBOLS } from "#/config/constants";
import { redisKeys } from "#/core/redis-keys.constants";

import { setupTestEnvironment } from "../helpers/env";
import { seedUser } from "../helpers/fixtures";
import { TestBot } from "../helpers/harness";

const env = setupTestEnvironment();

const CHAT_ID = -1_001;
const TARGET_ID = 4_242;
const ADMIN_ID = 999;

setCaptchaEnqueuer(async () => undefined);
afterAll(() => {
  setCaptchaEnqueuer(null);
});

async function createCaptcha() {
  await seedUser(env.db, {
    id: String(TARGET_ID),
    name: "Ada",
    username: "ada",
  });

  const creator = new TestBot();
  await creator.sendText(`/captcha ${CHAT_ID} ${TARGET_ID}`, { id: ADMIN_ID });

  const raw = await env.redis.get(redisKeys.captcha(String(CHAT_ID), String(TARGET_ID)));
  const session = captchaSchema.parse(JSON.parse(raw!));

  return { creator, session };
}

function clickCaptcha(bot: TestBot, data: string) {
  return bot.click(data, {
    id: TARGET_ID,
    chatId: CHAT_ID,
    chatType: "group",
  });
}

function wrongSequence(answer: readonly string[]): string[] {
  return answer.map((symbol) => SLOT_SYMBOLS.find((s) => s !== symbol)!);
}

describe("captcha callbacks", () => {
  test("records picks and completes successfully", async () => {
    const { session } = await createCaptcha();
    const bot = new TestBot();

    for (const symbol of session.answer) {
      await clickCaptcha(bot, `captcha_pick ${symbol}`);
    }

    expect(bot.lastText()).toContain("Verification successful");
    const adminMessage = bot
      .callsTo("sendMessage")
      .find((call) => String(call.payload.chat_id) === String(ADMIN_ID));
    expect(adminMessage?.payload.text).toContain("passed the captcha");
    expect(
      await env.redis.get(redisKeys.captcha(String(CHAT_ID), String(TARGET_ID))),
    ).toBeNull();
  });

  test("tracks progress, supports back and clear", async () => {
    const { session } = await createCaptcha();
    const bot = new TestBot();

    await clickCaptcha(bot, `captcha_pick ${SLOT_SYMBOLS[0]}`);
    let stored = captchaSchema.parse(
      JSON.parse(
        (await env.redis.get(
          redisKeys.captcha(String(CHAT_ID), String(TARGET_ID)),
        ))!,
      ),
    );
    expect(stored.progress).toHaveLength(1);

    await clickCaptcha(bot, "captcha_back");
    stored = captchaSchema.parse(
      JSON.parse(
        (await env.redis.get(
          redisKeys.captcha(String(CHAT_ID), String(TARGET_ID)),
        ))!,
      ),
    );
    expect(stored.progress).toHaveLength(0);

    await clickCaptcha(bot, `captcha_pick ${SLOT_SYMBOLS[1]}`);
    await clickCaptcha(bot, "captcha_clear");
    stored = captchaSchema.parse(
      JSON.parse(
        (await env.redis.get(
          redisKeys.captcha(String(CHAT_ID), String(TARGET_ID)),
        ))!,
      ),
    );
    expect(stored.progress).toHaveLength(0);

    expect(session.answer).toHaveLength(3);
  });

  test("awards three attempts before failing", async () => {
    const { session } = await createCaptcha();
    const bot = new TestBot();
    const wrong = wrongSequence(session.answer);

    for (let attempt = 1; attempt <= 3; attempt++) {
      for (const symbol of wrong) {
        await clickCaptcha(bot, `captcha_pick ${symbol}`);
      }

      if (attempt < 3) {
        expect(bot.lastText()).toContain("Incorrect selection");
      }
    }

    expect(bot.lastText()).toContain("Verification failed");
    const failure = bot
      .callsTo("sendMessage")
      .find((call) => String(call.payload.chat_id) === String(ADMIN_ID));
    expect(failure?.payload.text).toContain("failed the captcha");
    expect(
      await env.redis.get(redisKeys.captcha(String(CHAT_ID), String(TARGET_ID))),
    ).toBeNull();
  });

  test("alerts when the captcha has expired", async () => {
    const bot = new TestBot();

    await clickCaptcha(bot, `captcha_pick ${SLOT_SYMBOLS[0]}`);

    expect(bot.lastCall("answerCallbackQuery")?.payload).toMatchObject({
      text: "Captcha expired or, this captcha isn't for you.",
      show_alert: true,
    });
  });

  test("ignores clicks from users without a session", async () => {
    await createCaptcha();
    const bot = new TestBot();

    await bot.click("captcha_pick x", {
      id: 8_888,
      chatId: CHAT_ID,
      chatType: "group",
    });

    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toContain(
      "isn't for you",
    );
  });
});
