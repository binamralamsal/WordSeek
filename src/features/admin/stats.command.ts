import { Composer } from "grammy";

import { sql } from "kysely";
import { promises as fs } from "node:fs";
import os from "node:os";
import process from "node:process";

import { db } from "#/config/db";
import { env } from "#/config/env";

const composer = new Composer();

type StatsCounts = {
  totalUsers: number;
  activePlayers: number;
  activeGroups: number;
  totalGroups: number;
};

type StatsCountRow = {
  activeGroups: string;
  activePlayers: string;
  totalGroups: string;
  totalUsers: string;
};

async function getStatsCounts(): Promise<StatsCounts> {
  // Count both leaderboard chat types in a single scan and fetch all four
  // totals in one round trip. The old version scanned `leaderboard` twice.
  const result = await sql<StatsCountRow>`
    SELECT
      (SELECT count(*) FROM users) AS total_users,
      chats.active_players,
      chats.active_groups,
      (
        SELECT count(*)
        FROM broadcast_chats
        WHERE id LIKE '-1%'
      ) AS total_groups
    FROM (
      SELECT
        count(DISTINCT chat_id) FILTER (
          WHERE chat_id NOT LIKE '-1%'
        ) AS active_players,
        count(DISTINCT chat_id) FILTER (
          WHERE chat_id LIKE '-1%'
        ) AS active_groups
      FROM leaderboard
    ) AS chats
  `.execute(db);

  const row = result.rows[0];
  if (!row) throw new Error("Stats query returned no rows");

  return {
    totalUsers: Number(row.totalUsers),
    activePlayers: Number(row.activePlayers),
    activeGroups: Number(row.activeGroups),
    totalGroups: Number(row.totalGroups),
  };
}

async function readAvailableMemory(): Promise<number | undefined> {
  try {
    const meminfo = await fs.readFile("/proc/meminfo", "utf8");
    const match = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB$/m);
    return match?.[1] ? parseInt(match[1], 10) * 1024 : undefined;
  } catch {
    return undefined;
  }
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
}

function formatPercent(used: number, total: number) {
  return ((used / total) * 100).toFixed(1);
}

function section(title: string, lines: string[]) {
  return `<blockquote><b>${title}</b><br>${lines.join("<br>")}</blockquote>`;
}

function metric(label: string, value: string | number | bigint) {
  return `${label} <b>${value}</b>`;
}

composer.command("stats", async (ctx) => {
  if (!ctx.from) return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  // Start the database work before reading the local system information so
  // both happen in parallel.
  const countsPromise = getStatsCounts();
  const availableMemoryPromise = readAvailableMemory();

  const botUptime = process.uptime();
  const uptimeHours = Math.floor(botUptime / 3600);
  const uptimeMinutes = Math.floor((botUptime % 3600) / 60);

  const memUsage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  const availableMemory = await availableMemoryPromise;

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

  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const systemMemPercent = (memUsage.rss / totalMemory) * 100;

  const performance = section("📈 Performance", [
    `${metric("Heap usage", `${heapPercent.toFixed(1)}%`)} · ${metric("System memory", `${systemMemPercent.toFixed(3)}%`)}`,
    `${metric("Bun version", Bun?.version || process.version)} · ${metric("Platform", process.platform)}`,
  ]);

  const counts = await countsPromise;

  const overview = section("📊 Bot Overview", [
    `${metric("Total users", counts.totalUsers)} · ${metric("Active players", counts.activePlayers)}`,
    `${metric("Total groups", counts.totalGroups)} · ${metric("Active groups", counts.activeGroups)}`,
    `${metric("Uptime", `${uptimeHours}h ${uptimeMinutes}m`)} · PID <code>${process.pid}</code>`,
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
