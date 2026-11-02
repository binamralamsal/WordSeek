import { escapeHtml } from "#/core/format/escape-html.helper";
import { formatCommunityFooter } from "#/core/ui/format-community-footer.helper";
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
  WordLength,
} from "#/types";

import { formatFilterSummary } from "./format-filters.helper";

const MEDALS = ["🥇", "🥈", "🥉"];

type LeaderboardFormatOptions = {
  /** User IDs to show next to their name. Callers pass the system admins. */
  revealIds?: ReadonlySet<string>;
  /** The requester's own row when they are outside the top 20. */
  currentUser?: LeaderboardEntry & { rank: number | null };
};

function formatName(entry: LeaderboardEntry) {
  return entry.username
    ? `<a href="https://t.me/${escapeHtml(entry.username)}">${escapeHtml(
        entry.name,
      )}</a>`
    : escapeHtml(entry.name);
}

function formatId(entry: LeaderboardEntry, revealIds?: ReadonlySet<string>) {
  return revealIds?.has(entry.userId)
    ? ` <code>${escapeHtml(entry.userId)}</code>`
    : "";
}

export function formatLeaderboardMessage(
  data: LeaderboardEntry[],
  searchKey: LeaderboardScope,
  timeKey: LeaderboardPeriod,
  wordLength: WordLength,
  options: LeaderboardFormatOptions = {},
) {
  const blocks: string[][] = [];

  data.forEach((entry, index) => {
    // First blockquote holds the podium, then ten players per blockquote.
    if (index === 0 || index === 3 || (index > 3 && (index - 3) % 10 === 0)) {
      blocks.push([]);
    }

    const rank = MEDALS[index] ?? "🔅";
    const name = formatName(entry);
    const id = formatId(entry, options.revealIds);

    blocks[blocks.length - 1]!.push(
      `${rank} ${name}${id} — <b>${entry.totalScore.toLocaleString()}</b> pts`,
    );
  });

  const body =
    blocks.length > 0
      ? blocks
          .map((block) => `<blockquote>${block.join("<br>")}</blockquote>`)
          .join("\n")
      : `<blockquote>No scores for this filter yet. Pick another filter below, or start a game with /new.</blockquote>`;

  const currentUser = options.currentUser;
  const currentUserBlock = currentUser
    ? `<blockquote>📍 <b>Your position</b><br>${
        currentUser.rank === null
          ? "Not ranked yet · "
          : `#${currentUser.rank.toLocaleString()} `
      }${formatName(currentUser)}${formatId(currentUser, options.revealIds)}${
        currentUser.rank === null
          ? ""
          : ` — <b>${currentUser.totalScore.toLocaleString()}</b> pts`
      }</blockquote>`
    : "";

  return `<h4>🏆 Leaderboard</h4>
<p><i>${formatFilterSummary(searchKey, timeKey, wordLength)}</i></p>
${body}${currentUserBlock ? `\n${currentUserBlock}` : ""}
${formatCommunityFooter()}`;
}
