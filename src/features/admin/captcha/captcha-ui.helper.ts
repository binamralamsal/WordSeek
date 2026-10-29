import { InlineKeyboard } from "grammy";

import { SLOT_SYMBOLS } from "#/config/constants";

export const decodeSlot = (value: number): string[] => {
  const n = value - 1;

  return [
    SLOT_SYMBOLS[n & 3]!,
    SLOT_SYMBOLS[(n >> 2) & 3]!,
    SLOT_SYMBOLS[(n >> 4) & 3]!,
  ];
};

export const buildCaptchaKeyboard = (progress: string[]) => {
  const keyboard = new InlineKeyboard();

  SLOT_SYMBOLS.forEach((e) => {
    keyboard.text(e, `captcha_pick ${e}`);
  });

  if (progress.length > 0) {
    keyboard.row().text("⬅️", "captcha_back").text("❌ Clear", "captcha_clear");
  }

  return keyboard;
};

export const buildMessage = ({
  mention,
  progress,
  attempts,
  maxAttempts,
  status,
}: {
  mention?: string;
  progress: string[];
  attempts: number;
  maxAttempts: number;
  status?: string;
}) => {
  const filled = [...progress];
  while (filled.length < 3) filled.push("⬜");

  let message = "";

  message += `<blockquote>🎰 <strong>Verification Required</strong></blockquote>\n`;

  message += `<blockquote>`;
  message += `${
    mention
      ? `${mention}, please prove that you are not a robot.\n`
      : "Please prove that you are not a robot.\n"
  }`;
  message += `├ Result: ${filled.join(" ")}\n`;
  message += `├ Attempts: ${attempts}/${maxAttempts}\n`;
  message += `├ Status: ${status ?? "Waiting for input"}\n`;
  message += `└ Instruction: Select the symbols in the exact order shown above.`;
  message += `</blockquote>`;

  return message;
};
