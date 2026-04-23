import IORedis from "ioredis";

import { env } from "./env";

export const redis = new IORedis(env.REDIS_URI, { maxRetriesPerRequest: null });
