import type IORedis from "ioredis";

/**
 * Minimal in-memory Redis used by the integration tests.
 *
 * It implements exactly the commands the bot relies on (strings with
 * `EX`/`KEEPTTL`/`NX` options, counters, key scans, sets and pipelines).
 */
export class RedisMock {
  readonly strings = new Map<string, string>();
  readonly sets = new Map<string, Set<string>>();
  readonly expirations = new Map<string, number>();

  reset(): void {
    this.strings.clear();
    this.sets.clear();
    this.expirations.clear();
  }

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    ...args: (string | number)[]
  ): Promise<"OK" | null> {
    const upper = args.map((arg) => String(arg).toUpperCase());

    if (upper.includes("NX") && this.strings.has(key)) {
      return null;
    }

    this.strings.set(key, String(value));

    const exIndex = upper.indexOf("EX");
    if (exIndex >= 0) {
      const seconds = Number(args[exIndex + 1]);
      this.expirations.set(key, Date.now() + seconds * 1000);
    }

    if (!upper.includes("KEEPTTL")) {
      if (exIndex < 0) this.expirations.delete(key);
    }

    return "OK";
  }

  async setex(key: string, seconds: number, value: string): Promise<"OK"> {
    this.strings.set(key, String(value));
    this.expirations.set(key, Date.now() + seconds * 1000);
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.strings.delete(key)) deleted += 1;
      if (this.sets.delete(key)) deleted += 1;
      this.expirations.delete(key);
    }
    return deleted;
  }

  async incr(key: string): Promise<number> {
    const next = Number(this.strings.get(key) ?? "0") + 1;
    this.strings.set(key, String(next));
    return next;
  }

  async decr(key: string): Promise<number> {
    const next = Number(this.strings.get(key) ?? "0") - 1;
    this.strings.set(key, String(next));
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.strings.has(key) && !this.sets.has(key)) return 0;
    this.expirations.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const expiresAt = this.expirations.get(key);
    if (!expiresAt) return -1;
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      `^${pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".")}$`,
    );

    return [...new Set([...this.strings.keys(), ...this.sets.keys()])].filter(
      (key) => regex.test(key),
    );
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added += 1;
      }
    }
    this.sets.set(key, set);
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) removed += 1;
    }
    return removed;
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? [])];
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.sets.get(key)?.has(member) ? 1 : 0;
  }

  async spop(key: string, count = 1): Promise<string[]> {
    const set = this.sets.get(key);
    if (!set) return [];
    const popped: string[] = [];
    for (const member of set) {
      if (popped.length >= count) break;
      set.delete(member);
      popped.push(member);
    }
    if (set.size === 0) this.sets.delete(key);
    return popped;
  }

  pipeline(): PipelineMock {
    return new PipelineMock(this);
  }

  async quit(): Promise<"OK"> {
    return "OK";
  }

  disconnect(): void {
    // no-op
  }
}

type PipelineCommand = {
  method: string;
  args: unknown[];
};

export class PipelineMock {
  private readonly commands: PipelineCommand[] = [];

  constructor(private readonly redis: RedisMock) {}

  private queue(method: string, args: unknown[]): this {
    this.commands.push({ method, args });
    return this;
  }

  smembers(key: string) {
    return this.queue("smembers", [key]);
  }

  scard(key: string) {
    return this.queue("scard", [key]);
  }

  sadd(key: string, ...members: string[]) {
    return this.queue("sadd", [key, ...members]);
  }

  srem(key: string, ...members: string[]) {
    return this.queue("srem", [key, ...members]);
  }

  spop(key: string, count?: number) {
    return this.queue("spop", [key, count]);
  }

  del(...keys: string[]) {
    return this.queue("del", keys);
  }

  set(key: string, value: string, ...args: (string | number)[]) {
    return this.queue("set", [key, value, ...args]);
  }

  expire(key: string, seconds: number) {
    return this.queue("expire", [key, seconds]);
  }

  incr(key: string) {
    return this.queue("incr", [key]);
  }

  async exec(): Promise<[Error | null, unknown][]> {
    const results: [Error | null, unknown][] = [];

    for (const command of this.commands) {
      const fn = (this.redis as unknown as Record<string, Function>)[
        command.method
      ];
      try {
        results.push([null, await fn!.apply(this.redis, command.args)]);
      } catch (error) {
        results.push([error as Error, null]);
      }
    }

    this.commands.length = 0;
    return results;
  }
}

export function createRedisMock(
  instance: RedisMock = new RedisMock(),
): IORedis {
  return instance as unknown as IORedis;
}
