import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { LeaderboardPeriod, WordLength } from "@shared/leaderboard";
import type { MiniAppLeaderboardScope } from "@shared/miniapp";

const periods: LeaderboardPeriod[] = ["today", "week", "month", "year", "all"];
const lengths: WordLength[] = [4, 5, 6];

const scopeLabels: Record<MiniAppLeaderboardScope, string> = {
  global: "Global",
  group: "Group",
  private: "Private",
};

export function LeaderboardFilters({
  period,
  length,
  onPeriod,
  onLength,
  scope,
  onScope,
  groupAvailable = false,
  lengthVisible = true,
}: {
  period: LeaderboardPeriod;
  length: WordLength;
  onPeriod: (value: LeaderboardPeriod) => void;
  onLength: (value: WordLength) => void;
  scope?: MiniAppLeaderboardScope;
  onScope?: (value: MiniAppLeaderboardScope) => void;
  groupAvailable?: boolean;
  lengthVisible?: boolean;
}) {
  return (
    <div className="filter-stack">
      <div className="filter-topline">
        {scope && onScope ? (
          <ToggleGroup
            type="single"
            value={scope}
            onValueChange={(value) => {
              if (value) onScope(value as MiniAppLeaderboardScope);
            }}
            className="rank-scope-toggle"
            aria-label="Ranking scope"
          >
            <ToggleGroupItem value="global" title="All WordSeek players">
              Global
            </ToggleGroupItem>
            {groupAvailable && (
              <ToggleGroupItem
                value="group"
                title="Scores from this group chat"
              >
                Group
              </ToggleGroupItem>
            )}
            <ToggleGroupItem
              value="private"
              title="Scores from your private chat with the bot"
            >
              Private
            </ToggleGroupItem>
          </ToggleGroup>
        ) : (
          <div className="global-label">
            <span className="global-dot" /> Global rankings
          </div>
        )}
        <Select
          value={period}
          onValueChange={(value) => onPeriod(value as LeaderboardPeriod)}
        >
          <SelectTrigger aria-label="Ranking period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((value) => (
              <SelectItem key={value} value={value}>
                {value === "all" ? "All time" : `This ${value}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {lengthVisible && (
        <ToggleGroup
          type="single"
          value={String(length)}
          onValueChange={(value) => {
            if (value) onLength(Number(value) as WordLength);
          }}
          className="rank-length-toggle"
          aria-label="Rankings word length"
        >
          {lengths.map((value) => (
            <ToggleGroupItem value={String(value)} key={value}>
              {value} letters
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {scope === "group" && groupAvailable && (
        <p className="scope-note">
          Showing scores earned in this group chat. Open WordSeek from a group
          to compare with that group.
        </p>
      )}
    </div>
  );
}

export { scopeLabels };
