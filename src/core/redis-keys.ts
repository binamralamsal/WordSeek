const TRACKING_PREFIX = "tracking:";

export const redisKeys = {
  vote: (chatId: string | number) => `vote:${chatId}`,
  dailySession: (userId: string | number) => `daily_wordle:${userId}`,
  captcha: (chatId: string | number, userId: string | number) =>
    `captcha:${chatId}:${userId}`,
  wordHistory: (chatId: string | number, wordLength: number) =>
    `h:${chatId}:${wordLength}`,
  trackingPrefix: TRACKING_PREFIX,
  tracking: (chatId: string | number) => `${TRACKING_PREFIX}${chatId}`,
  trackingPattern: `${TRACKING_PREFIX}*`,
  greetingTrack: (
    userId: string | number,
    phrase: "helloBaby" | "byee",
    date: string,
  ) => `greetingTrack:${userId}:${phrase}:${date}`,
  geminiFailedKeys: "seek-gemini:failed_keys",
  broadcastState: "broadcast:state",
  broadcastLock: "broadcast:lock",
} as const;
