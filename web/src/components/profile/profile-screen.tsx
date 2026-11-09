import { LeaderboardFilters } from "@/components/rankings/leaderboard-filters";
import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaderboardPeriod, WordLength } from "@shared/leaderboard";
import type {
  MiniAppLeaderboardScope,
  MiniAppProfile,
  MyRanking,
} from "@shared/miniapp";
import { Flame, Medal, Sparkles, Trophy } from "lucide-react";

export function ProfileScreen({
  profile,
  loading,
  scope,
  period,
  length,
  ranking,
  rankingLoading,
  groupAvailable,
  onScope,
  onPeriod,
  onLength,
}: {
  profile?: MiniAppProfile;
  loading: boolean;
  scope: MiniAppLeaderboardScope;
  period: LeaderboardPeriod;
  length: WordLength;
  ranking?: MyRanking;
  rankingLoading: boolean;
  groupAvailable: boolean;
  onScope: (value: MiniAppLeaderboardScope) => void;
  onPeriod: (value: LeaderboardPeriod) => void;
  onLength: (value: WordLength) => void;
}) {
  if (loading || !profile) return <ProfileSkeleton />;
  const { user, stats } = profile;

  return (
    <section className="subpage profile-page">
      <Card className="profile-card">
        <CardContent>
          <div className="profile-identity">
            <PlayerAvatar
              name={user.displayName}
              url={user.photoUrl}
              className="profile-avatar"
            />
            <div>
              <span className="section-kicker">WORDSEEK PLAYER</span>
              <h1>{user.displayName}</h1>
              <p>{user.username ? `@${user.username}` : "Playing WordSeek"}</p>
            </div>
          </div>
          <div className="career-score">
            <div>
              <span>CAREER POINTS</span>
              <strong>{stats.totalScore.toLocaleString()}</strong>
            </div>
            <Badge variant="secondary">
              <Sparkles size={13} /> {stats.gamesPlayed} games
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="profile-stat-grid">
        <StatCard
          label="Current streak"
          value={`${stats.currentStreak} days`}
          detail={`Best ${stats.highestStreak} days`}
          icon={<Flame />}
        />
        <StatCard
          label="Classic wins"
          value={stats.classicWins}
          detail={`${stats.classicGames} tracked · ${stats.classicLosses} losses`}
          icon={<Trophy />}
        />
        <StatCard
          label="Daily wins"
          value={stats.dailyWins}
          detail={`${stats.dailyGames} played · ${stats.dailyLosses} missed`}
          icon={<Sparkles />}
        />
        <StatCard
          label="Best score"
          value={stats.bestScore}
          detail={`${stats.classicLosses} classic losses`}
          icon={<Medal />}
        />
      </div>

      <Card className="my-rank-card">
        <CardHeader className="my-rank-heading">
          <div>
            <span className="section-kicker">YOUR POSITION</span>
            <CardTitle>My ranking</CardTitle>
          </div>
          <Trophy />
        </CardHeader>
        <CardContent>
          <LeaderboardFilters
            scope={scope}
            period={period}
            length={length}
            groupAvailable={groupAvailable}
            onScope={onScope}
            onPeriod={onPeriod}
            onLength={onLength}
          />
          {rankingLoading ? (
            <div className="my-rank-skeleton">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ) : ranking ? (
            <div className="my-rank-details">
              <div className="rank-big">
                <span>RANK</span>
                <b>#{ranking.rank}</b>
                <small>
                  of {ranking.totalPlayers.toLocaleString()} players
                </small>
              </div>
              <div className="my-rank-metrics">
                <div>
                  <span>POINTS</span>
                  <b>{ranking.score.toLocaleString()}</b>
                </div>
                <div>
                  <span>WINS</span>
                  <b>{ranking.gamesWon}</b>
                </div>
                <div>
                  <span>BEST</span>
                  <b>{ranking.bestScore}</b>
                </div>
              </div>
            </div>
          ) : (
            <div className="rank-empty">
              <Medal />
              <b>No position for these filters</b>
              <span>Finish a game to appear here.</span>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="profile-member-since">
        Playing since{" "}
        {new Date(stats.memberSince).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })}
      </p>
    </section>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="profile-stat-card">
      <CardContent>
        <span className="stat-icon">{icon}</span>
        <small>{label}</small>
        <strong>{value}</strong>
        <span className="stat-detail">{detail}</span>
      </CardContent>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <section className="subpage">
      <Card className="profile-skeleton-card">
        <CardContent>
          <Skeleton className="profile-skeleton-avatar" />
          <Skeleton className="skeleton-name" />
          <div className="skeleton-stats">
            {[0, 1, 2, 3].map((key) => (
              <Skeleton key={key} />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="profile-stat-grid">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton className="profile-stat-placeholder" key={key} />
        ))}
      </div>
    </section>
  );
}
