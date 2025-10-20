import { Composer } from "grammy";

import { promises as fs } from "fs";
import os from "os";
import process from "process";

import { db } from "../config/db";
import { env } from "../config/env";

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

  const [usersResult, groupsResult] = await Promise.all([
    db
      .selectFrom("users")
      .select((eb) => eb.fn.count("id").as("usersCount"))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("leaderboard")
      .select((eb) => eb.fn.count("chatId").distinct().as("groupsCount"))
      .where("chatId", "like", "-1%")
      .executeTakeFirstOrThrow(),
  ]);

  const usersCount = usersResult.usersCount;
  const groupsCount = groupsResult.groupsCount;

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatPercent = (used: number, total: number) =>
    ((used / total) * 100).toFixed(1);

  let statsMessage = `🤖 <b>Bot Statistics</b>\n\n`;

  // Basic bot stats
  statsMessage += `<blockquote>📊 <b>Bot Overview</b>\n`;
  statsMessage += `├ Users: ${usersCount}\n`;
  statsMessage += `├ Groups: ${groupsCount}\n`;
  statsMessage += `├ Uptime: ${uptimeHours}h ${uptimeMinutes}m\n`;
  statsMessage += `└ PID: ${process.pid}</blockquote>\n\n`;

  // Bot memory usage
  statsMessage += `<blockquote>🧠 <b>Bot Memory</b>\n`;
  statsMessage += `├ RSS: ${formatBytes(memUsage.rss)}\n`;
  statsMessage += `├ Heap Used: ${formatBytes(memUsage.heapUsed)}\n`;
  statsMessage += `├ Heap Total: ${formatBytes(memUsage.heapTotal)}\n`;
  statsMessage += `└ External: ${formatBytes(memUsage.external)}</blockquote>\n\n`;

  // VPS System stats
  statsMessage += `<blockquote>💻 <b>VPS System</b>\n`;
  statsMessage += `├ OS: ${os.type()} ${os.release()}\n`;
  statsMessage += `├ Architecture: ${os.arch()}\n`;
  statsMessage += `├ CPUs: ${cpus.length}x ${cpus[0]?.model?.split(" ")[0] || "Unknown"}\n`;
  statsMessage += `└ Hostname: ${os.hostname()}</blockquote>\n\n`;

  // VPS Memory
  statsMessage += `<blockquote>💾 <b>VPS Memory</b>\n`;
  statsMessage += `├ Total: ${formatBytes(totalMemory)}\n`;
  statsMessage += `├ Used: ${formatBytes(usedMemory)} (${formatPercent(usedMemory, totalMemory)}%)\n`;
  statsMessage += `├ Free: ${formatBytes(freeMemory)} (${formatPercent(freeMemory, totalMemory)}%)\n`;
  statsMessage += `└ Available: ${formatBytes(availableMemory ?? freeMemory)}${availableMemory ? "" : " (fallback)"}</blockquote>\n\n`;

  // VPS Load
  statsMessage += `<blockquote>⚡ <b>VPS Load</b>\n`;
  statsMessage += `├ 1min: ${loadAvg[0]?.toFixed(2)}\n`;
  statsMessage += `├ 5min: ${loadAvg[1]?.toFixed(2)}\n`;
  statsMessage += `├ 15min: ${loadAvg[2]?.toFixed(2)}\n`;
  statsMessage += `└ Cores: ${cpus.length}</blockquote>\n\n`;

  // Bot performance
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const systemMemPercent = (memUsage.rss / totalMemory) * 100;

  statsMessage += `<blockquote>📈 <b>Performance</b>\n`;
  statsMessage += `├ Heap Usage: ${heapPercent.toFixed(1)}%\n`;
  statsMessage += `├ System Memory: ${systemMemPercent.toFixed(3)}%\n`;
  statsMessage += `├ Bun Version: ${Bun?.version || process.version}\n`;
  statsMessage += `└ Platform: ${process.platform}</blockquote>`;

  return ctx.reply(statsMessage, { parse_mode: "HTML" });
});

export const statsCommand = composer;
