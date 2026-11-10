import type { Api } from "grammy";

import { expect, test } from "bun:test";

import { env } from "#/config/env";
import { createMiniAppAvatarApi } from "#/web/avatar";

import { setupTestEnvironment } from "../helpers/env";

setupTestEnvironment();

test("proxies Telegram avatar files without exposing the bot token to clients", async () => {
  const fileId = "avatar-file-id-123456";
  let requestedUrl = "";
  let apiCalls = 0;
  const api = {
    getFile: async () => {
      apiCalls += 1;
      return {
        file_id: fileId,
        file_unique_id: "avatar-file-unique",
        file_path: "photos/profile.jpg",
      };
    },
  } as unknown as Api;
  const avatarApi = createMiniAppAvatarApi(api, async (input) => {
    requestedUrl = String(input);
    return new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image/jpeg" },
    });
  });

  const response = await avatarApi.handle(
    new Request(`http://localhost/api/avatar/${fileId}`),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(requestedUrl).toBe(
    `${env.CUSTOM_API_ROOT}/file/bot${env.BOT_TOKEN}/photos/profile.jpg`,
  );
  expect(requestedUrl).not.toContain("/api/avatar/");
  expect(apiCalls).toBe(1);
});

test("rejects malformed avatar file identifiers", async () => {
  let apiCalled = false;
  const api = {
    getFile: async () => {
      apiCalled = true;
      return { file_path: "photos/profile.jpg" };
    },
  } as unknown as Api;
  const avatarApi = createMiniAppAvatarApi(api);

  const response = await avatarApi.handle(
    new Request("http://localhost/api/avatar/bad"),
  );

  expect(response.status).toBe(404);
  expect(apiCalled).toBe(false);
});
