/**
 * Nickname rules shared by the HTTP API and the Mini App.
 *
 * Keep this module free of Node-only imports: the Vite bundle imports it too.
 */

export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 20;

export const NICKNAME_RULES = [
  `${NICKNAME_MIN_LENGTH}–${NICKNAME_MAX_LENGTH} characters`,
  "Letters, numbers, spaces, dots, dashes and underscores",
  "Must start and end with a letter or number",
  "No profanity or impersonation",
] as const;

const RESERVED_NICKNAMES = new Set([
  "admin",
  "administrator",
  "moderator",
  "support",
  "telegram",
  "wordseek",
  "wordseekbot",
]);

/**
 * A small, deliberately conservative blocklist. Matching is token based after
 * leetspeak normalisation, so ordinary words such as "class" or "assassin" do
 * not get caught by a substring such as "ass".
 */
const BLOCKED_TOKENS = new Set([
  "anal",
  "anus",
  "arse",
  "arsehole",
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "bollocks",
  "bullshit",
  "cock",
  "cocksucker",
  "cunt",
  "dick",
  "dickhead",
  "douche",
  "douchebag",
  "fag",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "goddamn",
  "hitler",
  "motherfucker",
  "nazi",
  "nigga",
  "nigger",
  "piss",
  "porn",
  "porno",
  "prick",
  "pussy",
  "rape",
  "rapist",
  "retard",
  "retarded",
  "shit",
  "shithead",
  "slut",
  "twat",
  "wanker",
  "whore",
]);

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "l",
};

const ALLOWED_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N} ._-]*[\p{L}\p{N}])?$/u;

export type NicknameValidation =
  { ok: true; value: string } | { ok: false; message: string };

/** Converts common leetspeak and strips accents before blocklist matching. */
export function normalizeForProfanityCheck(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[0134578@$!|]/g, (char) => LEET_MAP[char] ?? char)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function containsBlockedNicknameContent(value: string): boolean {
  const normalized = normalizeForProfanityCheck(value);
  if (!normalized) return false;

  const tokens = normalized.split(/\s+/);
  if (tokens.some((token) => BLOCKED_TOKENS.has(token))) return true;

  // Catch separators inserted inside a word, for example "f.u.c.k".
  const compact = normalized.replace(/\s+/g, "");
  return [...BLOCKED_TOKENS].some(
    (token) => token.length >= 4 && compact.includes(token),
  );
}

export function validateNickname(input: unknown): NicknameValidation {
  if (typeof input !== "string") {
    return { ok: false, message: "Nickname must be text." };
  }

  const value = input.normalize("NFC").trim().replace(/\s+/g, " ");

  if (!value) {
    return { ok: false, message: "Enter a nickname." };
  }

  const length = [...value].length;

  if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Nickname must be ${NICKNAME_MIN_LENGTH}–${NICKNAME_MAX_LENGTH} characters long.`,
    };
  }

  if (!ALLOWED_PATTERN.test(value)) {
    return {
      ok: false,
      message:
        "Use letters, numbers, spaces, dots, dashes or underscores. Start and end with a letter or number.",
    };
  }

  if (/\s{2,}/.test(value) || /[._-]{2,}/.test(value)) {
    return {
      ok: false,
      message: "Use single spaces or separators between words.",
    };
  }

  if (!/\p{L}/u.test(value)) {
    return { ok: false, message: "Nickname needs at least one letter." };
  }

  if (containsBlockedNicknameContent(value)) {
    return {
      ok: false,
      message:
        "That nickname contains inappropriate language. Try another one.",
    };
  }

  const compact = value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

  if (RESERVED_NICKNAMES.has(compact)) {
    return {
      ok: false,
      message: "That nickname is reserved. Please choose another one.",
    };
  }

  return { ok: true, value };
}
