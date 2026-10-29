import { describe, expect, test } from "bun:test";

import { env } from "#/config/env";
import { formatSystemLogMessage } from "#/core/logging/system-log.service";

describe("formatSystemLogMessage", () => {
  test("renders level, message and metadata as escaped HTML", () => {
    const message = formatSystemLogMessage("error", "Boom <script>", {
      chatId: -1001,
    });

    expect(message).toContain("[error]");
    expect(message).toContain("Boom &lt;script&gt;");
    expect(message).toContain("chatId");
    expect(message).toContain("-1001");
    expect(message).toContain("<pre>");
  });

  test("uses a distinct icon for fatal messages", () => {
    const error = formatSystemLogMessage("error", "x");
    const fatal = formatSystemLogMessage("fatal", "x");

    expect(error).not.toBe(fatal);
    expect(fatal).toContain("[fatal]");
  });

  test("omits the metadata block when none is provided", () => {
    expect(formatSystemLogMessage("error", "x").match(/<pre>/g)).toHaveLength(1);
  });

  test("truncates very long messages", () => {
    const message = formatSystemLogMessage("error", "a".repeat(10_000));
    expect(message.length).toBeLessThan(8_000);
  });
});

describe("system log channel separation", () => {
  test("is disabled unless SYSTEM_LOG_CHANNEL is configured", () => {
    expect(env.SYSTEM_LOG_CHANNEL).toBeUndefined();
  });

  test("does not reuse the suspicious-message LOGS_CHANNEL", () => {
    expect(env.LOGS_CHANNEL).toBe(555);
    expect(env.SYSTEM_LOG_CHANNEL).not.toBe(env.LOGS_CHANNEL);
  });
});
