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

export function LeaderboardFilters({
  period,
  length,
  onPeriod,
  onLength,
  scope,
  onScope,
  groupAvailable = false,
}: {
  period: LeaderboardPeriod;
  length: WordLength;
  onPeriod: (value: LeaderboardPeriod) => void;
  onLength: (value: WordLength) => void;
  scope?: MiniAppLeaderboardScope;
  onScope?: (value: MiniAppLeaderboardScope) => void;
  groupAvailable?: boolean;
}) {
  return (
    <div className="filter-stack">
      <div className="filter-topline">
        {scope && onScope ? (
          <Select
            value={scope}
            onValueChange={(value) => onScope(value as MiniAppLeaderboardScope)}
          >
            <SelectTrigger aria-label="Ranking scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global</SelectItem>
              <SelectItem value="private">Private chat</SelectItem>
              {groupAvailable && (
                <SelectItem value="group">Current group</SelectItem>
              )}
            </SelectContent>
          </Select>
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
    </div>
  );
}
