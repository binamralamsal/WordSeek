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

  const rows: string[] = [];
  const section = (title: string) => {
    rows.push(`<tr><td colspan="2" align="left"><b>${title}</b></td></tr>`);
  };
  const row = (label: string, value: string | number | bigint) => {
    rows.push(
      `<tr><td align="left">${label}</td><td align="right"><code>${value}</code></td></tr>`,
    );
  };

  section("📊 Bot Overview");
  row("Total Users", allUsersCount);
  row("Active Players", activePlayersCount);
  row("Total Groups", totalGroupsCount);
  row("Active Groups", activeGroupsCount);
  row("Uptime", `${uptimeHours}h ${uptimeMinutes}m`);
  row("PID", process.pid);

  section("🧠 Bot Memory");
  row("RSS", formatBytes(memUsage.rss));
  row("Heap Used", formatBytes(memUsage.heapUsed));
  row("Heap Total", formatBytes(memUsage.heapTotal));
  row("External", formatBytes(memUsage.external));

  section("💻 VPS System");
  row("OS", `${os.type()} ${os.release()}`);
  row("Architecture", os.arch());
  row("CPUs", `${cpus.length}x ${cpus[0]?.model?.split(" ")[0] || "Unknown"}`);
  row("Hostname", os.hostname());

  section("💾 VPS Memory");
  row("Total", formatBytes(totalMemory));
  row(
    "Used",
    `${formatBytes(usedMemory)} (${formatPercent(usedMemory, totalMemory)}%)`,
  );
  row(
    "Free",
    `${formatBytes(freeMemory)} (${formatPercent(freeMemory, totalMemory)}%)`,
  );
  row(
    "Available",
    `${formatBytes(availableMemory ?? freeMemory)}${availableMemory ? "" : " (fallback)"}`,
  );

  section("⚡ VPS Load");
  row("1 Min", loadAvg[0]?.toFixed(2) ?? "0.00");
  row("5 Min", loadAvg[1]?.toFixed(2) ?? "0.00");
  row("15 Min", loadAvg[2]?.toFixed(2) ?? "0.00");
  row("Cores", cpus.length);

  // Bot performance
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const systemMemPercent = (memUsage.rss / totalMemory) * 100;

  section("📈 Performance");
  row("Heap Usage", `${heapPercent.toFixed(1)}%`);
  row("System Memory", `${systemMemPercent.toFixed(3)}%`);
  row("Bun Version", Bun?.version || process.version);
  row("Platform", process.platform);

  return ctx.replyWithRichMessage({
    html: `<h3>🤖 Bot Statistics</h3>
<p><i>Live snapshot from the running instance</i></p>
<table bordered striped compact>
<tr><th>Metric</th><th>Value</th></tr>
${rows.join("\n")}
</table>`,
  });
});

export const statsCommand = composer;
