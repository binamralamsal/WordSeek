import {
  DISCUSSION_GROUP,
  DONATION_LINK,
  UPDATES_CHANNEL,
} from "#/config/constants";

/** Inline community links shared by score and leaderboard messages. */
export function formatCommunityLinks(): string {
  return `📢 <a href="${UPDATES_CHANNEL}">Updates</a> · 💓 <a href="${DONATION_LINK}">Donate</a> · 💬 <a href="${DISCUSSION_GROUP}">Discussion</a>`;
}

/** Community links wrapped in a rich-message footer. */
export function formatCommunityFooter(): string {
  return `<footer>${formatCommunityLinks()}</footer>`;
}
