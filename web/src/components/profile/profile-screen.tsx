import { LeaderboardFilters } from "@/components/rankings/leaderboard-filters";
import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaderboardPeriod, WordLength } from "@shared/leaderboard";
import type {
  MiniAppLeaderboardScope,
  MiniAppProfile,
  MiniAppPublicProfile,
  MyRanking,
} from "@shared/miniapp";
import {
  ArrowLeft,
  Flame,
  Medal,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useState } from "react";

export function ProfileScreen({
  profile,
  loading,
  isOtherProfile,
  scope,
  period,
  length,
  ranking,
  rankingLoading,
  groupAvailable,
  onScope,
  onPeriod,
  onLength,
  onSearchProfile,
  onBack,
}: {
  profile?: MiniAppProfile | MiniAppPublicProfile;
  loading: boolean;
  isOtherProfile: boolean;
  scope: MiniAppLeaderboardScope;
  period: LeaderboardPeriod;
  length: WordLength;
  ranking?: MyRanking;
  rankingLoading: boolean;
  groupAvailable: boolean;
  onScope: (value: MiniAppLeaderboardScope) => void;
  onPeriod: (value: LeaderboardPeriod) => void;
  onLength: (value: WordLength) => void;
  onSearchProfile: (query: string) => Promise<void>;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  if (loading || !profile) return <ProfileSkeleton />;
  const { user, stats } = profile;

  const searchProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearching(true);
    setSearchError("");
    try {
      await onSearchProfile(search);
    } catch (error) {
      setSearchError((error as Error).message || "Could not find that player.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="subpage profile-page">
      {isOtherProfile ? (
        <Button
          className="profile-back-button"
          onClick={onBack}
          variant="ghost"
        >
          <ArrowLeft /> Back
        </Button>
      ) : (
        <div className="profile-page-heading">
          <span className="section-kicker">YOUR WORDSEEK ACCOUNT</span>
          <h1>Profile</h1>
        </div>
      )}
      <Card className="profile-card">
        <CardContent>
          <div className="profile-identity">
            <PlayerAvatar
              name={user.displayName}
              url={user.photoUrl}
              className="profile-avatar"
            />
            <div>
              <span className="section-kicker">
                {isOtherProfile ? "WORDSEEK PLAYER" : "YOUR PROFILE"}
              </span>
              <h1>{user.displayName}</h1>
              <p>{user.username ? `@${user.username}` : "Playing WordSeek"}</p>
            </div>
          </div>
          <div className="career-score">
            <div>
              <span>CAREER POINTS</span>
              <strong>{stats.totalScore.toLocaleString()}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isOtherProfile && (
        <Card className="profile-search-card">
          <CardContent>
            <div className="profile-search-heading">
              <div>
                <b>Find a player</b>
                <p>Search by Telegram username, nickname or user ID.</p>
              </div>
              <Search aria-hidden="true" />
            </div>
            <form className="profile-search-form" onSubmit={searchProfile}>
              <input
                aria-label="Telegram username, nickname or user ID"
                autoComplete="off"
                className="nickname-input"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="@username, nickname or ID"
                value={search}
              />
              <Button disabled={searching || !search.trim()} type="submit">
                {searching ? "Searching…" : "Search"}
              </Button>
            </form>
            {searchError && (
              <p className="field-error" role="alert">
                {searchError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
          detail="Classic games solved"
          icon={<Trophy />}
        />
        <StatCard
          label="Daily wins"
          value={stats.dailyWins}
          detail={
            stats.dailyGames
              ? `${stats.dailyWins} of ${stats.dailyGames} puzzles`
              : "No puzzles played yet"
          }
          icon={<Sparkles />}
        />
        <StatCard
          label="Best score"
          value={stats.bestScore}
          detail="Highest single game score"
          icon={<Medal />}
        />
      </div>

      <Card className="my-rank-card">
        <CardHeader className="my-rank-heading">
          <div>
            <span className="section-kicker">
              {isOtherProfile ? "PLAYER POSITION" : "YOUR POSITION"}
            </span>
            <CardTitle>
              {isOtherProfile ? "Player ranking" : "My ranking"}
            </CardTitle>
          </div>
          <Trophy />
        </CardHeader>
        <CardContent>
          <LeaderboardFilters
            scope={isOtherProfile ? undefined : scope}
            period={period}
            length={length}
            groupAvailable={groupAvailable}
            onScope={isOtherProfile ? undefined : onScope}
            onPeriod={onPeriod}
            onLength={onLength}
            lengthVisible={!isOtherProfile}
          />
          {rankingLoading ? (
            <div className="my-rank-details my-rank-skeleton">
              <div className="rank-big">
                <Skeleton className="rank-skeleton-label" />
                <Skeleton className="rank-skeleton-number" />
                <Skeleton className="rank-skeleton-caption" />
              </div>
              <div className="my-rank-metrics">
                {[0, 1].map((key) => (
                  <div key={key}>
                    <Skeleton className="rank-skeleton-label" />
                    <Skeleton className="rank-skeleton-value" />
                  </div>
                ))}
              </div>
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
                  <span>BEST</span>
                  <b>{ranking.bestScore}</b>
                </div>
              </div>
            </div>
          ) : (
            <div className="rank-empty">
              <Medal />
              <b>No position for these filters</b>
              <span>
                {isOtherProfile
                  ? "This player has no score in the selected ranking."
                  : "Finish a game to appear here."}
              </span>
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
