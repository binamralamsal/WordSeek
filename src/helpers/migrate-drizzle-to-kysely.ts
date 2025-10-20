import { SQL } from "bun";

const sourceDb = new SQL("postgres://postgres:1234@localhost:5432/wordseek");

interface SourceUser {
  id: number;
  name: string;
  username: string | null;
  telegram_user_id: string;
  created_at: Date;
  updated_at: Date;
}

interface SourceLeaderboard {
  id: number;
  user_id: number;
  chat_id: string;
  score: number;
  created_at: Date;
  updated_at: Date;
}

interface SourceGame {
  id: number;
  word: string;
  active_chat: string;
  created_at: Date;
  updated_at: Date;
}

interface SourceGuess {
  id: number;
  guess: string;
  game_id: number;
  chat_id: string;
  created_at: Date;
  updated_at: Date;
}

interface SourceBannedUser {
  id: number;
  user_id: number;
  created_at: Date;
  updated_at: Date;
}

// Helper to sanitize strings
function escapeSqlString(value: string | null): string {
  if (value === null) return "NULL";
  const sanitized = value
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    .replace(/\uFFFD/g, "")
    .normalize("NFC");
  return `'${sanitized.replace(/'/g, "''")}'`;
}

// Helper to format timestamp
function formatTimestamp(date: Date): string {
  return `'${date.toISOString()}'`;
}

// Generate COPY-compatible SQL
function generateCopy(
  tableName: string,
  columns: string[],
  rows: string[][],
): string {
  if (rows.length === 0) return "";

  const escapeValue = (v: string): string => {
    if (v === "NULL") return "\\N"; // PostgreSQL null
    const unquoted = v.replace(/^'|'$/g, ""); // remove wrapping quotes
    // escape tabs, newlines, backslashes
    return unquoted
      .replace(/\\/g, "\\\\")
      .replace(/\t/g, "\\t")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
  };

  const lines = rows.map((row) => row.map(escapeValue).join("\t"));

  // Must end with newline and \. on its own line
  return `COPY ${tableName} (${columns.join(", ")}) FROM stdin;\n${lines.join(
    "\n",
  )}\n\\.\n\n`;
}

async function generateMigrationSql(): Promise<void> {
  try {
    console.log("🚀 Starting SQL file generation...");

    // Fetch data
    const [users, games, guesses, leaderboard, bannedUsers] = await Promise.all(
      [
        sourceDb`SELECT * FROM users` as Promise<SourceUser[]>,
        sourceDb`SELECT * FROM games` as Promise<SourceGame[]>,
        sourceDb`SELECT * FROM guesses` as Promise<SourceGuess[]>,
        sourceDb`SELECT * FROM leaderboard` as Promise<SourceLeaderboard[]>,
        sourceDb`SELECT * FROM banned_users` as Promise<SourceBannedUser[]>,
      ],
    );

    console.log(`✓ ${users.length} users`);
    console.log(`✓ ${games.length} games`);
    console.log(`✓ ${guesses.length} guesses`);
    console.log(`✓ ${leaderboard.length} leaderboard entries`);
    console.log(`✓ ${bannedUsers.length} banned users`);

    const userIdMap = new Map(users.map((u) => [u.id, u.telegram_user_id]));

    let sqlContent = `-- Migration SQL File (COPY format)
-- Generated on ${new Date().toISOString()}
-- Source: wordseek database

SET client_encoding = 'UTF8';

BEGIN;
SET session_replication_role = replica;

`;

    // Users
    console.log("Generating users COPY...");
    const userRows = users.map((u) => [
      u.telegram_user_id,
      u.name ?? "\\N",
      u.username ?? "\\N",
      u.created_at.toISOString(),
      u.updated_at.toISOString(),
    ]);
    sqlContent += `-- Users (${users.length} rows)\n`;
    sqlContent += generateCopy(
      "users",
      ["id", "name", "username", "created_at", "updated_at"],
      userRows,
    );

    // Games
    console.log("Generating games COPY...");
    const gameRows = games.map((g) => [
      g.id.toString(),
      g.word,
      g.active_chat,
      g.created_at.toISOString(),
      g.updated_at.toISOString(),
    ]);
    sqlContent += `-- Games (${games.length} rows)\n`;
    sqlContent += generateCopy(
      "games",
      ["id", "word", "active_chat", "created_at", "updated_at"],
      gameRows,
    );

    // Guesses
    console.log("Generating guesses COPY...");
    const guessRows = guesses.map((g) => [
      g.id.toString(),
      g.guess,
      g.game_id.toString(),
      g.chat_id,
      g.created_at.toISOString(),
      g.updated_at.toISOString(),
    ]);
    sqlContent += `-- Guesses (${guesses.length} rows)\n`;
    sqlContent += generateCopy(
      "guesses",
      ["id", "guess", "game_id", "chat_id", "created_at", "updated_at"],
      guessRows,
    );

    // Leaderboard
    console.log("Generating leaderboard COPY...");
    const validLeaderboard = leaderboard.filter((l) => {
      const newUserId = userIdMap.get(l.user_id);
      if (!newUserId) {
        console.warn(
          `⚠️ User ${l.user_id} not found, skipping leaderboard entry ${l.id}`,
        );
        return false;
      }
      return true;
    });
    const leaderboardRows = validLeaderboard.map((l) => [
      l.id.toString(),
      userIdMap.get(l.user_id)!,
      l.chat_id,
      l.score.toString(),
      l.created_at.toISOString(),
      l.updated_at.toISOString(),
    ]);
    sqlContent += `-- Leaderboard (${validLeaderboard.length} rows)\n`;
    sqlContent += generateCopy(
      "leaderboard",
      ["id", "user_id", "chat_id", "score", "created_at", "updated_at"],
      leaderboardRows,
    );

    // Banned Users
    console.log("Generating banned users COPY...");
    const validBannedUsers = bannedUsers.filter((b) => {
      const newUserId = userIdMap.get(b.user_id);
      if (!newUserId) {
        console.warn(
          `⚠️ User ${b.user_id} not found, skipping banned entry ${b.id}`,
        );
        return false;
      }
      return true;
    });
    const bannedUserRows = validBannedUsers.map((b) => [
      userIdMap.get(b.user_id)!,
      b.created_at.toISOString(),
      b.updated_at.toISOString(),
    ]);
    sqlContent += `-- Banned Users (${validBannedUsers.length} rows)\n`;
    sqlContent += generateCopy(
      "banned_users",
      ["user_id", "created_at", "updated_at"],
      bannedUserRows,
    );

    sqlContent += `SET session_replication_role = DEFAULT;
COMMIT;

-- Update sequences
SELECT setval(pg_get_serial_sequence('games', 'id'), COALESCE((SELECT MAX(id) FROM games), 1));
SELECT setval(pg_get_serial_sequence('guesses', 'id'), COALESCE((SELECT MAX(id) FROM guesses), 1));
SELECT setval(pg_get_serial_sequence('leaderboard', 'id'), COALESCE((SELECT MAX(id) FROM leaderboard), 1));
`;

    const outputPath = "./migration.sql";
    await Bun.write(outputPath, sqlContent);

    console.log("\n✅ SQL file generated successfully!");
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(
      `\nRun migration with:\n  psql -h localhost -U postgres -d target_db -f migration.sql`,
    );
  } catch (err) {
    console.error("❌ SQL generation failed:", err);
    process.exit(1);
  }
}

generateMigrationSql();
