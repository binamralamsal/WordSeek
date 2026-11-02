import { Bot } from "grammy";

import { env } from "./env";

export const bot = new Bot(env.BOT_TOKEN, {
  client: { apiRoot: env.CUSTOM_API_ROOT },
});
