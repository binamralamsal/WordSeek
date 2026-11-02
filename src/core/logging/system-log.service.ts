import { bot } from "#/config/bot";
import { env } from "#/config/env";
import { escapeHtml } from "#/core/format/escape-html.helper";

import { createLogger } from "./logger.service";

const log = createLogger("system-log");

const DEDUPE_WINDOW_MS = 60_000;
const MAX_MESSAGE_LENGTH = 3_500;

export type SystemLogLevel = "error" | "fatal";

const recentMessages = new Map<string, number>();
const queue: string[] = [];
let flushing = false;

export function formatSystemLogMessage(
  level: SystemLogLevel,
  message: string,
  meta?: Record<string, unknown>,
): string {
  const icon = level === "fatal" ? "💥" : "🔴";
  const lines = [`${icon} <strong>[${level}] WordSeek</strong>`, ""];

  const body = escapeHtml(message.slice(0, MAX_MESSAGE_LENGTH));
  lines.push(`<pre>${body}</pre>`);

  if (meta && Object.keys(meta).length > 0) {
    const serialized = escapeHtml(
      JSON.stringify(meta, null, 2).slice(0, MAX_MESSAGE_LENGTH),
    );
    lines.push("", `<pre>${serialized}</pre>`);
  }

  return lines.join("\n");
}

/**
 * Sends important system failures to the dedicated system-log channel.
 *
 * `LOGS_CHANNEL` is intentionally not used here: it exists solely for
 * suspicious-message tracking. Errors are deduplicated within a short window
 * so a burst of failures cannot flood Telegram.
 */
export async function reportSystemLog(
  level: SystemLogLevel,
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (!env.SYSTEM_LOG_CHANNEL) return;

  const key = `${level}:${message}`;
  const now = Date.now();
  const lastSentAt = recentMessages.get(key);

  if (lastSentAt && now - lastSentAt < DEDUPE_WINDOW_MS) return;
  recentMessages.set(key, now);

  queue.push(formatSystemLogMessage(level, message, meta));
  await flushSystemLogs();
}

export async function flushSystemLogs(): Promise<void> {
  if (flushing || !env.SYSTEM_LOG_CHANNEL) return;

  flushing = true;
  try {
    while (queue.length > 0) {
      const text = queue.shift()!;
      try {
        await bot.api.sendMessage(env.SYSTEM_LOG_CHANNEL, text, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        });
      } catch (error) {
        log.warn({ err: error }, "Failed to deliver system log to Telegram");
      }
    }
  } finally {
    flushing = false;
  }
}

/** Test-only helper: clears dedupe state and any queued messages. */
export function resetSystemLogState(): void {
  recentMessages.clear();
  queue.length = 0;
  flushing = false;
}
