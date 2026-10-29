import crypto from "crypto";

import { env } from "#/config/env";
import words from "#/data/daily-word-lists.json";

export function seedFromSecret(secret: string) {
  const h = crypto
    .createHmac("sha256", secret)
    .update("wotd-permutation-seed")
    .digest();
  return h.readUInt32BE(0);
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function deterministicShuffle(seed: number) {
  const arr = words.slice();
  const rnd = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getWordOfTheDay(shuffled: string[]) {
  const msPerDay = 24 * 60 * 60 * 1000;

  const dayNumber = Math.floor(
    (Date.now() - env.DAILY_WORDLE_START_DATE.getTime()) / msPerDay,
  );

  return shuffled[
    ((dayNumber % shuffled.length) + shuffled.length) % shuffled.length
  ]!;
}
