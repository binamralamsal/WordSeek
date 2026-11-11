import { Composer } from "grammy";

import { db } from "#/config/db";
import { redis } from "#/config/redis";
import { createLogger } from "#/core/logging/logger.service";
import { redisKeys } from "#/core/redis-keys.constants";
import { upsertBroadcastChat, upsertUser } from "#/core/services/users.service";

const log = createLogger("core.middleware.sync-user-chat.middleware");

const composer = new Composer();
const PROFILE_PHOTO_REFRESH_SECONDS = 24 * 60 * 60;

async function syncProfilePhoto(
  userId: string,
  name: string,
  username: string | null,
  getPhotos: () => Promise<{ photos: Array<Array<{ file_id: string }>> }>,
) {
  const key = redisKeys.profilePhotoSync(userId);
  const claimed = await redis.set(
    key,
    "1",
    "EX",
    PROFILE_PHOTO_REFRESH_SECONDS,
    "NX",
  );
  if (claimed !== "OK") return;

  try {
    const profile = await getPhotos();
    const photo = profile.photos[0]?.at(-1);
    if (photo) {
      await upsertUser({
        id: userId,
        name,
        username,
        photoUrl: `telegram-file:${photo.file_id}`,
      });
    } else {
      const user = await db
        .selectFrom("users")
        .select("photoUrl")
        .where("id", "=", userId)
        .executeTakeFirst();
      if (user?.photoUrl?.startsWith("telegram-file:")) {
        await upsertUser({ id: userId, name, username, photoUrl: null });
      }
    }
  } catch (error) {
    await redis.del(key);
    throw error;
  }
}

composer.use(async (ctx, next) => {
  try {
    const user = ctx.from;
    const chat = ctx.chat;

    if (user && !user.is_bot) {
      const userId = user.id.toString();
      const userName =
        user.first_name + (user.last_name ? " " + user.last_name : "");
      const userUsername = user.username || null;

      // Sync without blocking the update pipeline.
      void upsertUser({
        id: userId,
        name: userName,
        username: userUsername,
      }).catch((error) => log.error({ err: error }, "Error in user sync"));

      void syncProfilePhoto(userId, userName, userUsername, () =>
        ctx.api.getUserProfilePhotos(user.id, { limit: 1 }),
      ).catch((error) =>
        log.warn({ err: error, userId }, "Could not sync profile photo"),
      );
    }

    if (chat && chat.type !== "channel") {
      const chatId = chat.id.toString();
      const chatName =
        chat.type === "private"
          ? user
            ? user.first_name + (user.last_name ? " " + user.last_name : "")
            : null
          : chat.title;
      const chatUsername = chat.username || null;

      void upsertBroadcastChat({
        id: chatId,
        name: chatName,
        username: chatUsername,
      }).catch((error) => log.error({ err: error }, "Error in chat sync"));
    }
  } catch (error) {
    log.error({ err: error }, "Error in sync middleware:");
  }

  return next();
});

export const syncUserChatMiddleware = composer;
