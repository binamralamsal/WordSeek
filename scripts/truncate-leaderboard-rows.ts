import { closeDatabase } from "../src/config/db";
import { compactLeaderboard } from "../src/features/scores/services/leaderboard-compaction.service";

const result = await compactLeaderboard();

if (result) {
  console.log(
    `Leaderboard compacted: ${result.bucketsCompacted} buckets, ` +
      `${result.rowsRemoved} rows removed, ${result.remainingRows} rows left.`,
  );
} else {
  console.log("Leaderboard compaction skipped: another run is in progress.");
}

await closeDatabase();
