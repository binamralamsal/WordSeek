import type { Api } from "grammy";

import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import { env as appEnv } from "#/config/env";
import { authenticateRequest, buildDataCheckString } from "#/web/auth";

import { setupTestEnvironment } from "../helpers/env";
import { seedUser } from "../helpers/fixtures";

const testEnv = setupTestEnvironment();

function signedInitData(user: Record<string, unknown>) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(user),
  });
  const secret = new Uint8Array(
    createHmac("sha256", "WebAppData").update(appEnv.BOT_TOKEN).digest(),
  );
  const hash = createHmac("sha256", secret)
    .update(buildDataCheckString(params))
    .digest("hex");

  params.set("hash", hash);
  return params.toString();
}

describe("Mini App Telegram profile photos", () => {
  test("keeps the stored photo when Telegram omits optional photo_url", async () => {
    await seedUser(testEnv.db, { id: "4242", name: "Ada Lovelace" });
    await testEnv.db
      .updateTable("users")
      .set({ photoUrl: "telegram-file:cached-telegram-photo" })
      .where("id", "=", "4242")
      .execute();

    const initData = signedInitData({ id: 4242, first_name: "Ada" });
    await authenticateRequest(
      new Request("http://localhost/api/bootstrap", {
        headers: { "x-telegram-init-data": initData },
      }),
      {} as Api,
    );

    const user = await testEnv.db
      .selectFrom("users")
      .select("photoUrl")
      .where("id", "=", "4242")
      .executeTakeFirstOrThrow();
    expect(user.photoUrl).toBe("telegram-file:cached-telegram-photo");
  });

  test("stores Telegram's signed Mini App photo URL when it is provided", async () => {
    await seedUser(testEnv.db, { id: "4242", name: "Ada Lovelace" });
    const photoUrl = "https://t.me/i/userpic/320/ada.jpg";
    const initData = signedInitData({
      id: 4242,
      first_name: "Ada",
      photo_url: photoUrl,
    });

    await authenticateRequest(
      new Request("http://localhost/api/bootstrap", {
        headers: { "x-telegram-init-data": initData },
      }),
      {} as Api,
    );

    const user = await testEnv.db
      .selectFrom("users")
      .select("photoUrl")
      .where("id", "=", "4242")
      .executeTakeFirstOrThrow();
    expect(user.photoUrl).toBe(photoUrl);
  });
});
