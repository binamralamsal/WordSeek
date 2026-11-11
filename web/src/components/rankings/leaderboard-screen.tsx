import {
  LeaderboardFilters,
  scopeLabels,
} from "@/components/rankings/leaderboard-filters";
import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaderboardPeriod, WordLength } from "@shared/leaderboard";
import type {
  MiniAppLeaderboardPage,
  MiniAppLeaderboardScope,
  MyRanking,
} from "@shared/miniapp";
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  RefreshCw,
  Trophy,
  UserRound,
  WifiOff,
} from "lucide-react";

export function LeaderboardScreen({
  page,
  loading,
  pageIndex,
  scope,
  period,
  length,
  ranking,
  rankingLoading,
  groupAvailable,
  groupTitle,
  error,
  onOpenProfile,
  onOpenOwnProfile,
  onScope,
  onPeriod,
  onLength,
  onPage,
  onRetry,
}: {
  page: MiniAppLeaderboardPage | null;
  loading: boolean;
  pageIndex: number;
  scope: MiniAppLeaderboardScope;
  period: LeaderboardPeriod;
  length: WordLength;
  ranking?: MyRanking;
  rankingLoading: boolean;
  groupAvailable: boolean;
  groupTitle?: string | null;
  error?: string | null;
  onOpenProfile: (userId: string) => void;
  onOpenOwnProfile: () => void;
  onScope: (value: MiniAppLeaderboardScope) => void;
  onPeriod: (value: LeaderboardPeriod) => void;
  onLength: (value: WordLength) => void;
  onPage: (value: number) => void;
  onRetry: () => void;
}) {
  const podiumPlayers = pageIndex === 1 ? (page?.rows.slice(0, 3) ?? []) : [];
  const activeScope = page?.scope ?? scope;

  return (
    <section className="subpage rankings-page">
      <div className="page-heading">
        <div>
          <span className="section-kicker">WORDSEEK COMMUNITY</span>
          <h1>Rankings</h1>
        </div>
        <div className="heading-icon">
          <Trophy />
        </div>
      </div>
      <LeaderboardFilters
        scope={scope}
        groupAvailable={groupAvailable}
        period={period}
        length={length}
        onScope={onScope}
        onPeriod={onPeriod}
        onLength={onLength}
      />
      <MyRankingStrip
        ranking={ranking}
        loading={rankingLoading}
        onOpenProfile={onOpenOwnProfile}
      />
      {loading && !page ? (
        <RankingSkeleton />
      ) : error && !page ? (
        <Card className="empty-state is-error">
          <CardContent>
            <WifiOff />
            <b>Couldn’t load rankings</b>
            <p>{error}</p>
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      ) : page?.rows.length ? (
        <>
          {pageIndex === 1 && (
            <Podium players={podiumPlayers} onOpenProfile={onOpenProfile} />
          )}
          <Card className="ranking-card">
            <CardHeader className="ranking-card-header">
              <CardTitle>
                {activeScope === "group" ? "Group players" : "Players"}{" "}
                <span>{page.totalPlayers.toLocaleString()}</span>
              </CardTitle>
              <Badge variant="secondary">
                {scopeLabels[activeScope].toUpperCase()}
              </Badge>
            </CardHeader>
            {activeScope === "group" && groupTitle && (
              <p className="ranking-context">{groupTitle}</p>
            )}
            <CardContent className="rank-rows">
              {page.rows
                .filter((player) => !podiumPlayers.includes(player))
                .map((player) => (
                  <button
                    className={`rank-row rank-row-button ${player.isMe ? "rank-me" : ""}`}
                    key={player.userId}
                    onClick={() => onOpenProfile(player.userId)}
                    type="button"
                    aria-label={`View ${player.displayName}'s profile`}
                  >
                    <span className="rank-position">
                      {String(player.rank).padStart(2, "0")}
                    </span>
                    <PlayerAvatar
                      name={player.displayName}
                      url={player.photoUrl}
                    />
                    <div className="rank-person">
                      <b>
                        {player.displayName}
                        {player.isMe && <Badge variant="outline">You</Badge>}
                      </b>
                      <small>
                        {player.username
                          ? `@${player.username}`
                          : "WordSeek player"}
                      </small>
                    </div>
                    <strong>
                      {player.score.toLocaleString()}
                      <small> pts</small>
                    </strong>
                  </button>
                ))}
              {pageIndex === 1 && page.rows.length <= 3 && (
                <p className="rank-podium-note">
                  The top players are shown on the podium above.
                </p>
              )}
            </CardContent>
          </Card>
          <div className="pagination">
            <span>
              Page {page.page} of {page.totalPages}
            </span>
            <div>
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous page"
                disabled={pageIndex <= 1 || loading}
                onClick={() => onPage(pageIndex - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next page"
                disabled={pageIndex >= page.totalPages || loading}
                onClick={() => onPage(pageIndex + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      ) : loading ? (
        <RankingSkeleton />
      ) : (
        <Card className="empty-state">
          <CardContent>
            <Trophy />
            <b>No scores in this period yet</b>
            <p>
              {activeScope === "global"
                ? "Be the first to make the global leaderboard."
                : activeScope === "group"
                  ? "Be the first to score for this group."
                  : "Play a game in this chat to start your private ranking."}
            </p>
          </CardContent>
        </Card>
      )}
      {loading && page && (
        <div className="loading-indicator">
          <span className="loading-pulse" /> Updating rankings
        </div>
      )}
    </section>
  );
}

function MyRankingStrip({
  ranking,
  loading,
  onOpenProfile,
}: {
  ranking?: MyRanking;
  loading: boolean;
  onOpenProfile: () => void;
}) {
  return (
    <Card className="leaderboard-me">
      <CardContent>
        <div className="leaderboard-me-label">
          <UserRound aria-hidden="true" />
          <span>Your ranking</span>
        </div>
        {loading ? (
          <div className="leaderboard-me-loading">
            <Skeleton className="leaderboard-me-rank-skeleton" />
            <Skeleton className="leaderboard-me-value-skeleton" />
            <Skeleton className="leaderboard-me-value-skeleton" />
          </div>
        ) : ranking ? (
          <div className="leaderboard-me-content">
            <div className="leaderboard-me-rank">
              <small>RANK</small>
              <b>#{ranking.rank}</b>
              <span>of {ranking.totalPlayers.toLocaleString()}</span>
            </div>
            <div className="leaderboard-me-metrics">
              <div>
                <small>POINTS</small>
                <b>{ranking.score.toLocaleString()}</b>
              </div>
              <div>
                <small>BEST</small>
                <b>{ranking.bestScore}</b>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="leaderboard-me-button"
              onClick={onOpenProfile}
            >
              Profile
            </Button>
          </div>
        ) : (
          <p className="leaderboard-me-empty">
            No score for these filters yet. Finish a game to claim your spot.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Podium({
  players,
  onOpenProfile,
}: {
  players: NonNullable<MiniAppLeaderboardPage>["rows"];
  onOpenProfile: (userId: string) => void;
}) {
  const order = [players[1], players[0], players[2]];
  if (!players.length) return null;
  return (
    <div className="podium-grid">
      {order.map((player, index) => {
        if (!player)
          return <div className="podium-empty" key={`empty-${index}`} />;
        const place = player.rank;
        return (
          <button
            className={`podium-player place-${place} ${player.isMe ? "rank-me" : ""}`}
            key={player.userId}
            onClick={() => onOpenProfile(player.userId)}
            type="button"
            aria-label={`Rank ${place}, ${player.displayName}, ${player.score} points`}
          >
            <div className="podium-person">
              <PlayerAvatar name={player.displayName} url={player.photoUrl} />
              <div className="podium-name">
                <b>{player.displayName}</b>
                {player.isMe && <Badge>You</Badge>}
              </div>
              <span className="podium-points">
                {player.score.toLocaleString()} pts
              </span>
            </div>
            <div className="podium-platform">
              <span>{place === 1 ? <Crown size={14} /> : place}</span>
              <small>{place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}</small>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RankingSkeleton() {
  return (
    <div className="ranking-skeleton" aria-label="Loading rankings">
      <div className="skeleton-podium">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <Card className="ranking-card">
        <CardContent className="rank-rows">
          {[0, 1, 2, 3, 4].map((key) => (
            <div className="skeleton-rank" key={key}>
              <Skeleton className="skeleton-circle" />
              <Skeleton className="skeleton-name" />
              <Skeleton className="skeleton-score" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
