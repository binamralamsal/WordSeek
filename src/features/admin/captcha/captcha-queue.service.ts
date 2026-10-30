import { Queue, Worker } from "bullmq";

import { bot } from "#/config/bot";
import { redis } from "#/config/redis";
import { formatUserMention } from "#/core/format/mention.helper";
import { createLogger } from "#/core/logging/logger.service";
import { redisKeys } from "#/core/redis-keys.constants";

import { captchaSchema } from "./captcha.schema";

const log = createLogger("features.admin.captcha.captcha-queue.service");

const QUEUE_NAME = "captcha-expiry";

let queue: Queue | null = null;
let worker: Worker | null = null;

export interface CaptchaExpiryJob {
  chatId: string;
  userId: string;
  messageId: number;
}

type CaptchaEnqueuer = (job: CaptchaExpiryJob) => Promise<unknown>;

const defaultEnqueuer: CaptchaEnqueuer = (job) =>
  getCaptchaQueue().add("expire", job, {
    delay: 60_000,
    removeOnComplete: true,
  });

let enqueue: CaptchaEnqueuer = defaultEnqueuer;

/** Test seam so command tests never need a live BullMQ connection. */
export function setCaptchaEnqueuer(next: CaptchaEnqueuer | null): void {
  enqueue = next ?? defaultEnqueuer;
}

export function enqueueCaptchaExpiry(job: CaptchaExpiryJob): Promise<unknown> {
  return enqueue(job);
}

/**
 * BullMQ connects eagerly, so the queue is created lazily to keep importing the
 * command modules side-effect free (tests mount the real routers).
 */
export function getCaptchaQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: redis });
    queue.on("error", (error) => {
      log.error({ err: error }, "Captcha queue error");
    });
  }
  return queue;
}

export function startCaptchaWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { chatId, userId, messageId } = job.data;

      const key = redisKeys.captcha(chatId, userId);
      const raw = await redis.get(key);

      if (!raw) return;

      const session = captchaSchema.parse(JSON.parse(raw));

      await redis.del(key);

      const mention = formatUserMention({
        id: session.userId,
        name: session.name,
        username: session.username,
      });

      try {
        await bot.api.editMessageText(
          chatId,
          messageId,
          `⏰ <b>Verification timed out</b>\n\n${mention} didn't complete it in time.`,
          { parse_mode: "HTML" },
        );
      } catch (e) {
        log.error({ err: e }, "Captcha timeout edit failed");
      }

      try {
        await bot.api.sendMessage(
          session.adminId,
          `⏰ ${mention} did not complete the captcha in time.`,
          { parse_mode: "HTML" },
        );
      } catch (e) {
        log.error({ err: e }, "Failed to notify captcha admin");
      }
    },
    { connection: redis },
  );

  worker.on("error", (error) => {
    log.error({ err: error }, "Captcha worker error");
  });

  return worker;
}

export async function closeCaptchaQueue(): Promise<void> {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}
