import type { InlineKeyboardMarkup } from "grammy/types";

import { escapeHtml } from "#/core/format/escape-html.helper";

type InlineButton = InlineKeyboardMarkup["inline_keyboard"][number][number];

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderButton(button: InlineButton): string | null {
  const style = button.style ? ` style="${button.style}"` : "";
  const text = escapeHtml(button.text);

  if ("url" in button) {
    return `<tg-button type="url" url="${escapeAttribute(button.url)}"${style}>${text}</tg-button>`;
  }

  if ("callback_data" in button) {
    return `<tg-button type="callback_data" data="${escapeAttribute(button.callback_data)}"${style}>${text}</tg-button>`;
  }

  return null;
}

/**
 * Renders an inline keyboard as rich-message button rows.
 *
 * Rich messages carry their buttons inside the message body, so callers should
 * append the result to the rich HTML instead of passing `reply_markup`.
 */
export function renderInlineKeyboard(keyboard: InlineKeyboardMarkup): string {
  return keyboard.inline_keyboard
    .map((row) =>
      row
        .map(renderButton)
        .filter((button): button is string => button !== null)
        .join(""),
    )
    .filter((row) => row.length > 0)
    .map((row) => `<tg-button-row>${row}</tg-button-row>`)
    .join("\n");
}
