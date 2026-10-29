import { z } from "zod";

import { redis } from "#/config/redis";
import { createLogger } from "#/core/logging/logger.service";
import { redisKeys } from "#/core/redis-keys.constants";

const log = createLogger("features.admin.broadcast.broadcast-state.service");

export const broadcastStateSchema = z.object({
  messageId: z.number(),
  chatId: z.number(),
  totalChats: z.number(),
  currentIndex: z.number(),
  successCount: z.number(),
  blockedCount: z.number(),
  deletedCount: z.number(),
  unknownErrorCount: z.number(),
  startTime: z.number(),
  statusMessageId: z.number(),
  statusChatId: z.number(),
});

export type BroadcastState = z.infer<typeof broadcastStateSchema>;

export async function saveBroadcastState(state: BroadcastState) {
  await redis.set(redisKeys.broadcastState, JSON.stringify(state), "EX", 86400);
}

export async function getBroadcastState() {
  const data = await redis.get(redisKeys.broadcastState);
  if (!data) return null;

  try {
    return broadcastStateSchema.parse(JSON.parse(data));
  } catch (error) {
    log.error({ err: error }, "Invalid broadcast state in Redis:");
    return null;
  }
}

export async function clearBroadcastState() {
  await redis.del(redisKeys.broadcastState);
  await redis.del(redisKeys.broadcastLock);
}

export async function acquireBroadcastLock() {
  const result = await redis.set(
    redisKeys.broadcastLock,
    "1",
    "EX",
    3600,
    "NX",
  );
  return result === "OK";
}
