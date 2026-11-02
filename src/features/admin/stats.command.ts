import { Composer } from "grammy";

import { promises as fs } from "node:fs";
import os from "node:os";
import process from "node:process";

import { db } from "#/config/db";
import { env } from "#/config/env";

const composer = new Composer();

composer.command("stats", async (ctx) => {
  if (!ctx.from) return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const botUptime = process.uptime();
  const uptimeHours = Math.floor(botUptime / 3600);
  const uptimeMinutes = Math.floor((botUptime % 3600) / 60);

  const memUsage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  let availableMemory = freeMemory;
  try {
    const meminfo = await fs.readFile("/proc/meminfo", "utf8");
    const match = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB$/m);
    if (match && match[1]) availableMemory = parseInt(match[1], 10) * 1024;
  } catch {
    // pass
  }

  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  const [
    allUsersResult,
    activePlayersResult,
    activeGroupsResult,
    totalGroupsResult,
  ] = await Promise.all([
    db
      .selectFrom("users")
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("leaderboard")
      .select((eb) => eb.fn.count("chatId").distinct().as("count"))
      .where("chatId", "not like", "-1%")
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("leaderboard")
      .select((eb) => eb.fn.count("chatId").distinct().as("count"))
      .where("chatId", "like", "-1%")
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("broadcastChats")
      .select((eb) => eb.fn.count("id").as("count"))
      .where("id", "like", "-1%")
      .executeTakeFirstOrThrow(),
  ]);

  const allUsersCount = allUsersResult.count;
  const activePlayersCount = activePlayersResult.count;
  const activeGroupsCount = activeGroupsResult.count;
  const totalGroupsCount = totalGroupsResult.count;

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatPercent = (used: number, total: number) =>
    ((used / total) * 100).toFixed(1);

  const section = (title: string, lines: string[]) =>
    `<blockquote><b>${title}</b><br>${lines.join("<br>")}</blockquote>`;

  const metric = (label: string, value: string | number | bigint) =>
    `${label} <b>${value}</b>`;

  const overview = section("📊 Bot Overview", [
    `${metric("Total users", allUsersCount)} · ${metric("Active players", activePlayersCount)}`,
    `${metric("Total groups", totalGroupsCount)} · ${metric("Active groups", activeGroupsCount)}`,
    `${metric("Uptime", `${uptimeHours}h ${uptimeMinutes}m`)} · PID <code>${process.pid}</code>`,
  ]);

  const botMemory = section("🧠 Bot Memory", [
    `${metric("RSS", formatBytes(memUsage.rss))} · ${metric("External", formatBytes(memUsage.external))}`,
    metric(
      "Heap",
      `${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}`,
    ),
  ]);

  const system = section("💻 VPS System", [
    metric("OS", `${os.type()} ${os.release()}`),
    `${metric("Arch", os.arch())} · ${metric("CPUs", `${cpus.length}x ${cpus[0]?.model?.split(" ")[0] || "Unknown"}`)}`,
    metric("Host", os.hostname()),
  ]);

  const systemMemory = section("💾 VPS Memory", [
    metric("Total", formatBytes(totalMemory)),
    `${metric("Used", `${formatBytes(usedMemory)} (${formatPercent(usedMemory, totalMemory)}%)`)} · ${metric("Free", `${formatBytes(freeMemory)} (${formatPercent(freeMemory, totalMemory)}%)`)}`,
    metric(
      "Available",
      `${formatBytes(availableMemory ?? freeMemory)}${availableMemory ? "" : " (fallback)"}`,
    ),
  ]);

  const load = section("⚡ VPS Load", [
    `${metric("1 min", loadAvg[0]?.toFixed(2) ?? "0.00")} · ${metric("5 min", loadAvg[1]?.toFixed(2) ?? "0.00")} · ${metric("15 min", loadAvg[2]?.toFixed(2) ?? "0.00")}`,
    metric("Cores", cpus.length),
  ]);

  // Bot performance
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const systemMemPercent = (memUsage.rss / totalMemory) * 100;

  const performance = section("📈 Performance", [
    `${metric("Heap usage", `${heapPercent.toFixed(1)}%`)} · ${metric("System memory", `${systemMemPercent.toFixed(3)}%`)}`,
    `${metric("Bun version", Bun?.version || process.version)} · ${metric("Platform", process.platform)}`,
  ]);
  return ctx.replyWithRichMessage({
    html: `<h4>🤖 Bot Statistics</h4>
<p><i>Live snapshot · up ${uptimeHours}h ${uptimeMinutes}m</i></p>

${overview}
${botMemory}
${system}
${systemMemory}
${load}
${performance}`,
  });
});

export const statsCommand = composer;
