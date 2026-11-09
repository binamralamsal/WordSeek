import { LeaderboardFilters } from "@/components/rankings/leaderboard-filters";
import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaderboardPeriod, WordLength } from "@shared/leaderboard";
import type { MiniAppLeaderboardPage } from "@shared/miniapp";
import { ChevronLeft, ChevronRight, Crown, Trophy } from "lucide-react";

export function LeaderboardScreen({
  page,
  loading,
  pageIndex,
  period,
  length,
  onPeriod,
  onLength,
  onPage,
}: {
  page: MiniAppLeaderboardPage | null;
  loading: boolean;
  pageIndex: number;
  period: LeaderboardPeriod;
  length: WordLength;
  onPeriod: (value: LeaderboardPeriod) => void;
  onLength: (value: WordLength) => void;
  onPage: (value: number) => void;
}) {
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
        period={period}
        length={length}
        onPeriod={onPeriod}
        onLength={onLength}
      />
      {loading && !page ? (
        <RankingSkeleton />
      ) : page?.rows.length ? (
        <>
          {pageIndex === 1 && <Podium players={page.rows.slice(0, 3)} />}
          <Card className="ranking-card">
            <CardHeader className="ranking-card-header">
              <CardTitle>
                Global players <span>{page.totalPlayers.toLocaleString()}</span>
              </CardTitle>
              <Badge variant="secondary">GLOBAL</Badge>
            </CardHeader>
            <CardContent className="rank-rows">
              {page.rows.map((player) => (
                <div
                  className={`rank-row ${player.isMe ? "rank-me" : ""}`}
                  key={player.rank}
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
                </div>
              ))}
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
            <p>Be the first to make the global leaderboard.</p>
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

function Podium({
  players,
}: {
  players: NonNullable<MiniAppLeaderboardPage>["rows"];
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
          <div className={`podium-player place-${place}`} key={player.rank}>
            <div className="podium-platform">
              <span>{place === 1 ? <Crown size={15} /> : place}</span>
            </div>
            <PlayerAvatar name={player.displayName} url={player.photoUrl} />
            <b>{player.displayName}</b>
            <span>{player.score.toLocaleString()} pts</span>
          </div>
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
