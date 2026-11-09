import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  MiniAppBootstrap,
  MiniAppClassicState,
  MiniAppDailyState,
  MiniAppLeaderboardPage,
  MyRanking,
} from "@shared/miniapp";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Crown,
  Delete,
  Flame,
  Settings2,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import {
  hapticImpact,
  hapticNotification,
  initTelegram,
  telegramInitData,
} from "./lib/telegram";
import type { ThemeMode } from "./lib/telegram-types";
import {
  applyTheme,
  readStoredTheme,
  storeTheme,
  subscribeToTheme,
} from "./lib/theme";
import "./index.css";

type Screen = "play" | "ranks" | "profile" | "settings";
type Scope = "global" | "group";
type Period = "today" | "week" | "month" | "year" | "all";
type WordLength = 4 | 5 | 6;
const api = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": telegramInitData(),
      ...(import.meta.env.VITE_DEV_USER_ID
        ? { "X-Dev-User-Id": import.meta.env.VITE_DEV_USER_ID }
        : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error?.message ?? "Something went wrong");
  return body.data as T;
};
const periods: Period[] = ["today", "week", "month", "year", "all"];
const lengths: WordLength[] = [4, 5, 6];

function App() {
  const [mode, setMode] = useState<ThemeMode>(readStoredTheme);
  const [screen, setScreen] = useState<Screen>("play");
  const [playMode, setPlayMode] = useState<"daily" | "classic">("daily");
  const [boot, setBoot] = useState<MiniAppBootstrap | null>(null);
  const [classic, setClassic] = useState<MiniAppClassicState>(null);
  const [length, setLength] = useState<WordLength>(5);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [scope, setScope] = useState<Scope>("global");
  const [period, setPeriod] = useState<Period>("week");
  const [filterLength, setFilterLength] = useState<WordLength>(5);
  const [leaderboard, setLeaderboard] = useState<MiniAppLeaderboardPage | null>(
    null,
  );
  const [myRank, setMyRank] = useState<MyRanking | undefined>();
  const [boardLoading, setBoardLoading] = useState(false);
  const [myRankLoading, setMyRankLoading] = useState(false);
  const [animateRow, setAnimateRow] = useState<number | null>(null);
  const [celebrateRow, setCelebrateRow] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initTelegram();
    applyTheme(mode);
    return subscribeToTheme(mode, () => {});
  }, [mode]);
  useEffect(() => {
    api<MiniAppBootstrap>("/bootstrap")
      .then((result) => {
        setBoot(result);
        setClassic(result.classic);
        if (result.classic) setLength(result.classic.wordLength);
      })
      .catch((error: Error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, []);

  const filters = `scope=${scope}&period=${period}&length=${filterLength}`;
  useEffect(() => {
    if (screen !== "ranks" && screen !== "profile") return;
    let cancelled = false;
    if (screen === "ranks") {
      setBoardLoading(true);
      api<MiniAppLeaderboardPage>(`/leaderboard?${filters}&page=${page}`)
        .then((value) => {
          if (!cancelled) setLeaderboard(value);
        })
        .catch((error: Error) => {
          if (!cancelled) setNotice(error.message);
        })
        .finally(() => {
          if (!cancelled) setBoardLoading(false);
        });
    } else {
      setMyRankLoading(true);
      api<MyRanking>(`/leaderboard/me?${filters}`)
        .then((value) => {
          if (!cancelled) setMyRank(value);
        })
        .catch((error: Error) => {
          if (!cancelled) setNotice(error.message);
        })
        .finally(() => {
          if (!cancelled) setMyRankLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [screen, scope, period, filterLength, page]);

  const game = playMode === "daily" ? boot?.daily : classic;
  const wordLength = playMode === "daily" ? 5 : (classic?.wordLength ?? length);
  const guesses = game?.guesses ?? [];
  const finished = game
    ? game.status !== (playMode === "daily" ? "playing" : "active")
    : false;
  const keyboardStates = useMemo(() => {
    const states: Record<string, string> = {};
    guesses.forEach(({ guess, states: marks }) =>
      guess.split("").forEach((letter, index) => {
        const state = marks[index];
        if (
          state === "correct" ||
          (!states[letter] && state === "present") ||
          !states[letter]
        )
          states[letter] = state;
      }),
    );
    return states;
  }, [guesses]);

  const submit = useCallback(
    async (word = entry) => {
      if (!game || finished || busy || word.length !== wordLength) return;
      setBusy(true);
      try {
        const next =
          playMode === "daily"
            ? await api<MiniAppDailyState>("/daily/guess", {
                method: "POST",
                body: JSON.stringify({ guess: word }),
              })
            : await api<MiniAppClassicState>("/classic/guess", {
                method: "POST",
                body: JSON.stringify({ guess: word }),
              });
        const updated = next as NonNullable<typeof next>;
        if (playMode === "daily")
          setBoot((current) =>
            current
              ? { ...current, daily: updated as MiniAppDailyState }
              : current,
          );
        else setClassic(updated as MiniAppClassicState);
        setEntry("");
        setAnimateRow(guesses.length);
        const revealDuration = 520 + (wordLength - 1) * 115;
        window.setTimeout(() => setAnimateRow(null), revealDuration + 100);
        if (updated?.status === "won")
          window.setTimeout(
            () => setCelebrateRow(guesses.length),
            revealDuration,
          );
        hapticImpact("medium");
        if (
          updated &&
          updated.status !== (playMode === "daily" ? "playing" : "active")
        )
          hapticNotification(updated.status === "won" ? "success" : "error");
      } catch (error) {
        setNotice((error as Error).message);
        hapticNotification("error");
        window.setTimeout(() => setNotice(""), 2600);
      } finally {
        setBusy(false);
      }
    },
    [busy, entry, finished, game, guesses.length, playMode, wordLength],
  );

  const enterLetter = useCallback(
    (key: string) => {
      if (busy || finished) return;
      hapticImpact("light");
      if (key === "ENTER") {
        if (entry.length === wordLength) void submit();
        return;
      }
      if (key === "BACKSPACE") {
        setEntry((value) => value.slice(0, -1));
        return;
      }
      if (entry.length < wordLength)
        setEntry((value) => value + key.toLowerCase());
    },
    [busy, entry, finished, submit, wordLength],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (screen !== "play" || event.target instanceof HTMLInputElement) return;
      if (event.key === "Enter") enterLetter("ENTER");
      else if (event.key === "Backspace") enterLetter("BACKSPACE");
      else if (/^[a-z]$/i.test(event.key)) enterLetter(event.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enterLetter, screen]);

  useEffect(() => {
    if (playMode === "classic" && activeRowRef.current && scrollRef.current)
      activeRowRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }, [playMode, guesses.length]);

  const chooseLength = async (nextLength: WordLength) => {
    if (
      nextLength === length &&
      classic?.wordLength === nextLength &&
      classic.status === "active"
    )
      return;
    setLength(nextLength);
    setEntry("");
    setCelebrateRow(null);
    setBusy(true);
    try {
      if (classic?.status === "active")
        await api("/classic/abandon", { method: "POST" });
      const next = await api<MiniAppClassicState>("/classic/start", {
        method: "POST",
        body: JSON.stringify({ wordLength: nextLength }),
      });
      setClassic(next);
      setPlayMode("classic");
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startClassic = async () => {
    setBusy(true);
    try {
      const next = await api<MiniAppClassicState>("/classic/start", {
        method: "POST",
        body: JSON.stringify({ wordLength: length }),
      });
      setClassic(next);
      if (next) setLength(next.wordLength);
      setPlayMode("classic");
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changeScreen = (next: Screen) => {
    setScreen(next);
    if (next === "profile" || next === "ranks") setPage(1);
  };
  const back = () => {
    if (screen === "settings") setScreen("profile");
    else setScreen("play");
  };
  const displayName = boot?.profile.user.displayName ?? "WordSeek player";

  return (
    <main className={`miniapp ${screen === "play" ? "playing" : ""}`}>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      <div className="screen-scroll" key={screen}>
        {screen === "play" && (
          <>
            <div className="play-title">
              <div className="play-title-copy">
                <span>
                  {playMode === "daily"
                    ? `DAILY · #${boot?.daily.dayNumber ?? "—"}`
                    : "CLASSIC · PRACTICE"}
                </span>
                <h1>{playMode === "daily" ? "WordSeek" : "Classic"}</h1>
              </div>
              {playMode === "daily" && (
                <Badge variant="secondary" className="streak-badge">
                  <Flame size={14} />
                  {boot?.daily.streak.current ?? 0}
                </Badge>
              )}
            </div>
            <Tabs
              value={playMode}
              onValueChange={(value) => {
                if (value === "classic") void startClassic();
                else setPlayMode("daily");
              }}
              className="mode-tabs"
            >
              <TabsList className="mode-tabs-list">
                <TabsTrigger value="daily">Daily puzzle</TabsTrigger>
                <TabsTrigger value="classic">Classic</TabsTrigger>
              </TabsList>
            </Tabs>
            {playMode === "classic" && (
              <div className="classic-options">
                <ToggleGroup
                  type="single"
                  value={String(length)}
                  onValueChange={(value) => {
                    if (value) void chooseLength(Number(value) as WordLength);
                  }}
                  className="length-toggle"
                >
                  {lengths.map((value) => (
                    <ToggleGroupItem
                      value={String(value)}
                      key={value}
                      aria-label={`${value} letter game`}
                      disabled={busy}
                    >
                      {value}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <span>{30 - guesses.length} guesses</span>
              </div>
            )}
            <div
              className={`game-board-window ${playMode === "daily" ? "daily-board" : "classic-board"}`}
              ref={scrollRef}
            >
              {loading && !game ? (
                <div className="game-board-loading" aria-label="Loading puzzle">
                  {Array.from({ length: 6 }, (_, row) => (
                    <div className="tile-row" key={row}>
                      {Array.from({ length: wordLength }, (_, column) => (
                        <Skeleton key={column} className="tile-skeleton" />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={`game-board ${wordLength !== 5 ? `length-${wordLength}` : ""}`}
                >
                  {playMode === "daily"
                    ? Array.from({ length: 6 }, (_, row) => (
                        <GameRow
                          key={row}
                          row={row}
                          guess={
                            guesses[row]?.guess ??
                            (row === guesses.length ? entry : "")
                          }
                          states={guesses[row]?.states}
                          columns={wordLength}
                          active={row === guesses.length && !finished}
                          reveal={animateRow === row}
                          bounce={celebrateRow === row}
                          rowRef={
                            row === guesses.length ? activeRowRef : undefined
                          }
                        />
                      ))
                    : Array.from(
                        {
                          length: Math.min(30, Math.max(4, guesses.length + 3)),
                        },
                        (_, row) => (
                          <GameRow
                            key={row}
                            row={row}
                            guess={
                              guesses[row]?.guess ??
                              (row === guesses.length ? entry : "")
                            }
                            states={guesses[row]?.states}
                            columns={wordLength}
                            active={row === guesses.length && !finished}
                            reveal={animateRow === row}
                            bounce={celebrateRow === row}
                            rowRef={
                              row === guesses.length ? activeRowRef : undefined
                            }
                          />
                        ),
                      )}
                </div>
              )}
            </div>
            {finished && game && (
              <Card className="result-card">
                <CardContent className="result-content">
                  <Sparkles size={20} />
                  <div>
                    <b>
                      {game.status === "won"
                        ? "Brilliant!"
                        : `The word was ${game.solution?.toUpperCase()}`}
                    </b>
                    <p>
                      {game.status === "won"
                        ? `${guesses.length} ${guesses.length === 1 ? "guess" : "guesses"} · ${playMode === "daily" ? `${boot?.daily.streak.current ?? 0} day streak` : `${classic?.score ?? 0} points`}`
                        : "Better luck next time."}
                    </p>
                  </div>
                  {playMode === "classic" && (
                    <Button size="sm" onClick={() => void chooseLength(length)}>
                      New game
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
        {screen === "ranks" && (
          <RankingScreen
            kind="ranks"
            scope={scope}
            period={period}
            length={filterLength}
            onScope={(value) => {
              setScope(value);
              setPage(1);
            }}
            onPeriod={(value) => {
              setPeriod(value);
              setPage(1);
            }}
            onLength={(v) => {
              setFilterLength(v);
              setPage(1);
            }}
            loading={boardLoading}
            leaderboard={leaderboard}
            page={page}
            onPage={setPage}
            groupAvailable={Boolean(boot?.profile.group)}
          />
        )}
        {screen === "profile" && (
          <ProfileScreen
            boot={boot}
            loading={loading}
            scope={scope}
            period={period}
            length={filterLength}
            onScope={setScope}
            onPeriod={setPeriod}
            onLength={setFilterLength}
            ranking={myRank}
            rankLoading={myRankLoading}
            onSettings={() => changeScreen("settings")}
            groupAvailable={Boolean(boot?.profile.group)}
          />
        )}
        {screen === "settings" && (
          <SettingsScreen
            boot={boot}
            mode={mode}
            onMode={(value) => {
              setMode(value);
              storeTheme(value);
            }}
            onBack={back}
            onSaved={(next) =>
              setBoot((current) =>
                current
                  ? {
                      ...current,
                      profile: { ...current.profile, user: next.user },
                    }
                  : current,
              )
            }
          />
        )}
      </div>
      {screen === "play" && (
        <Keyboard
          states={keyboardStates}
          value={entry}
          columns={wordLength}
          disabled={loading || !game || busy || finished}
          onKey={enterLetter}
        />
      )}
      {screen !== "settings" && (
        <Tabs
          value={screen}
          onValueChange={(value) => changeScreen(value as Screen)}
          className="glass-nav-wrap"
        >
          <TabsList className="glass-nav">
            <TabsTrigger value="play">
              <Sparkles />
              <span>Play</span>
            </TabsTrigger>
            <TabsTrigger value="ranks">
              <Trophy />
              <span>Ranks</span>
            </TabsTrigger>
            <TabsTrigger value="profile">
              <UserRound />
              <span>Profile</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
    </main>
  );
}

function GameRow({
  row,
  guess,
  states,
  columns,
  active,
  reveal,
  bounce,
  rowRef,
}: {
  row: number;
  guess: string;
  states?: string[];
  columns: number;
  active: boolean;
  reveal: boolean;
  bounce: boolean;
  rowRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={rowRef}
      className={`tile-row ${active && guess ? "row-shake" : ""} ${bounce ? "row-win" : ""}`}
      aria-label={`Guess ${row + 1}`}
    >
      {Array.from({ length: columns }, (_, column) => (
        <div
          key={column}
          className={`tile ${guess[column] ? "tile-filled" : ""} ${states?.[column] ? `tile-${states[column]}` : ""} ${reveal ? "tile-reveal" : ""}`}
          style={
            {
              "--flip-delay": `${column * 115}ms`,
              "--win-delay": `${column * 95}ms`,
            } as React.CSSProperties
          }
        >
          {guess[column]?.toUpperCase()}
        </div>
      ))}
    </div>
  );
}

function Keyboard({
  states,
  value,
  columns,
  disabled,
  onKey,
}: {
  states: Record<string, string>;
  value: string;
  columns: number;
  disabled: boolean;
  onKey: (key: string) => void;
}) {
  const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  return (
    <div className={`keyboard-dock ${disabled ? "keyboard-disabled" : ""}`}>
      <div className="keyboard-status">
        <span>
          {disabled ? "Puzzle complete" : `${value.length} / ${columns}`}
        </span>
        <span>Enter to submit</span>
      </div>
      {rows.map((row, index) => (
        <div className="key-row" key={row}>
          {index === 2 && (
            <Button
              className="key key-action"
              onClick={() => onKey("ENTER")}
              disabled={disabled}
            >
              Enter
            </Button>
          )}
          {row.split("").map((key) => (
            <button
              key={key}
              className={`key ${states[key] ? `key-${states[key]}` : ""}`}
              onClick={() => onKey(key)}
              disabled={disabled}
            >
              {key}
            </button>
          ))}
          {index === 2 && (
            <Button
              variant="secondary"
              className="key key-action key-delete"
              onClick={() => onKey("BACKSPACE")}
              disabled={disabled}
            >
              <Delete size={19} />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function FilterControls({
  scope,
  period,
  length,
  onScope,
  onPeriod,
  onLength,
  groupAvailable,
}: {
  scope: Scope;
  period: Period;
  length: WordLength;
  onScope: (value: Scope) => void;
  onPeriod: (value: Period) => void;
  onLength: (value: WordLength) => void;
  groupAvailable: boolean;
}) {
  return (
    <div className="filter-stack">
      <div className="filter-selects">
        <Select
          value={scope}
          onValueChange={(value) => onScope(value as Scope)}
        >
          <SelectTrigger aria-label="Ranking scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">Global</SelectItem>
            {groupAvailable && (
              <SelectItem value="group">This group</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Select
          value={period}
          onValueChange={(value) => onPeriod(value as Period)}
        >
          <SelectTrigger aria-label="Ranking period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((value) => (
              <SelectItem value={value} key={value}>
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
        className="length-toggle filter-length"
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

function RankingScreen({
  kind,
  scope,
  period,
  length,
  onScope,
  onPeriod,
  onLength,
  loading,
  leaderboard,
  page,
  onPage,
  groupAvailable,
}: {
  kind: "ranks";
  scope: Scope;
  period: Period;
  length: WordLength;
  onScope: (v: Scope) => void;
  onPeriod: (v: Period) => void;
  onLength: (v: WordLength) => void;
  loading: boolean;
  leaderboard: MiniAppLeaderboardPage | null;
  page: number;
  onPage: (v: number) => void;
  groupAvailable: boolean;
}) {
  const podium = leaderboard?.rows.slice(0, 3) ?? [];
  return (
    <section className="subpage">
      <div className="page-heading">
        <div>
          <span className="section-kicker">WORDSEEK COMMUNITY</span>
          <h1>Rankings</h1>
        </div>
        <Trophy className="page-icon" />
      </div>
      <FilterControls
        {...{
          scope,
          period,
          length,
          onScope,
          onPeriod,
          onLength,
          groupAvailable,
        }}
      />
      {loading && !leaderboard ? (
        <RankingSkeleton />
      ) : leaderboard?.rows.length ? (
        <>
          {page === 1 && (
            <div className="podium-grid">
              {[1, 0, 2].map((index) => {
                const player = podium[index];
                if (!player) return <div key={index} />;
                return (
                  <div
                    className={`podium-player place-${index + 1}`}
                    key={player.rank}
                  >
                    <div className="podium-crown">
                      {index === 0 ? <Crown size={16} /> : `${index + 1}`}
                    </div>
                    <PlayerAvatar
                      name={player.displayName}
                      url={player.photoUrl}
                    />
                    <b>{player.displayName}</b>
                    <span>{player.score} pts</span>
                  </div>
                );
              })}
            </div>
          )}
          <Card className="ranking-card">
            <CardHeader className="list-header">
              <CardTitle>
                Players <span>{leaderboard.totalPlayers}</span>
              </CardTitle>
              <span>{scope === "group" ? "GROUP" : "GLOBAL"}</span>
            </CardHeader>
            <CardContent className="rank-rows">
              {leaderboard.rows.map((player) => (
                <div
                  className={`rank-row ${player.isMe ? "rank-me" : ""}`}
                  key={player.rank}
                >
                  <span className="rank-position">
                    {player.rank.toString().padStart(2, "0")}
                  </span>
                  <PlayerAvatar
                    name={player.displayName}
                    url={player.photoUrl}
                  />
                  <div className="rank-person">
                    <b>
                      {player.displayName}
                      {player.isMe && <Badge variant="secondary">You</Badge>}
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
              Page {leaderboard.page} of {leaderboard.totalPages}
            </span>
            <div>
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous page"
                disabled={page <= 1 || loading}
                onClick={() => onPage(page - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next page"
                disabled={page >= leaderboard.totalPages || loading}
                onClick={() => onPage(page + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="No rankings yet"
          detail="Scores for this filter will appear here."
        />
      )}
      {loading && leaderboard && (
        <div className="loading-scrim">
          <span>Refreshing rankings…</span>
        </div>
      )}
    </section>
  );
}

function RankingSkeleton() {
  return (
    <div className="skeleton-list">
      <div className="skeleton-podium">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div className="skeleton-rank" key={item}>
          <Skeleton className="skeleton-circle" />
          <Skeleton className="skeleton-name" />
          <Skeleton className="skeleton-score" />
        </div>
      ))}
    </div>
  );
}
function PlayerAvatar({ name, url }: { name: string; url: string | null }) {
  return (
    <Avatar className="player-avatar">
      <AvatarImage src={url ?? undefined} alt="" />
      <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <Card className="empty-state">
      <CardContent>
        <BarChart3 />
        <b>{title}</b>
        <p>{detail}</p>
      </CardContent>
    </Card>
  );
}

function ProfileScreen({
  boot,
  loading,
  scope,
  period,
  length,
  onScope,
  onPeriod,
  onLength,
  ranking,
  rankLoading,
  onSettings,
  groupAvailable,
}: {
  boot: MiniAppBootstrap | null;
  loading: boolean;
  scope: Scope;
  period: Period;
  length: WordLength;
  onScope: (v: Scope) => void;
  onPeriod: (v: Period) => void;
  onLength: (v: WordLength) => void;
  ranking: MyRanking | undefined;
  rankLoading: boolean;
  onSettings: () => void;
  groupAvailable: boolean;
}) {
  if (loading || !boot)
    return (
      <section className="subpage">
        <div className="profile-skeleton">
          <Skeleton className="profile-skeleton-avatar" />
          <Skeleton className="skeleton-name" />
          <div className="skeleton-stats">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} />
            ))}
          </div>
        </div>
      </section>
    );
  const { user, stats } = boot.profile;
  const winRate = stats.classicGames
    ? Math.round((stats.classicWins / stats.classicGames) * 100)
    : 0;
  return (
    <section className="subpage profile-page">
      <div className="profile-banner">
        <div className="profile-topline">
          <span className="section-kicker">PLAYER CARD</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettings}
            aria-label="Settings"
          >
            <Settings2 />
          </Button>
        </div>
        <div className="identity">
          <PlayerAvatar name={user.displayName} url={user.photoUrl} />
          <div>
            <h1>{user.displayName}</h1>
            <p>{user.username ? `@${user.username}` : "WordSeek player"}</p>
          </div>
        </div>
        <div className="profile-total">
          <span>CAREER POINTS</span>
          <strong>{stats.totalScore.toLocaleString()}</strong>
        </div>
      </div>
      <div className="stat-grid">
        <Stat
          label="Games won"
          value={stats.classicWins}
          detail={`${stats.classicGames} played`}
        />
        <Stat label="Win rate" value={`${winRate}%`} detail="Classic games" />
        <Stat label="Best score" value={stats.bestScore} detail="Single game" />
        <Stat
          label="Best streak"
          value={stats.highestStreak}
          detail={`Current ${stats.currentStreak} days`}
        />
      </div>
      <Card className="my-rank-card">
        <CardHeader className="my-rank-header">
          <div>
            <span className="section-kicker">YOUR POSITION</span>
            <CardTitle>My ranking</CardTitle>
          </div>
          <Trophy />
        </CardHeader>
        <CardContent>
          <FilterControls
            {...{
              scope,
              period,
              length,
              onScope,
              onPeriod,
              onLength,
              groupAvailable,
            }}
          />
          {rankLoading ? (
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
            <EmptyState
              title="No rank for these filters"
              detail="Play a game in this mode and your position will show here."
            />
          )}
        </CardContent>
      </Card>
      <div className="profile-footer">
        <CircleHelp size={15} />
        <span>
          Playing since{" "}
          {new Date(stats.memberSince).toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
    </section>
  );
}
function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
}) {
  return (
    <Card className="stat-card">
      <CardContent>
        <span>{label}</span>
        <b>{value}</b>
        <small>{detail}</small>
      </CardContent>
    </Card>
  );
}

function SettingsScreen({
  boot,
  mode,
  onMode,
  onBack,
  onSaved,
}: {
  boot: MiniAppBootstrap | null;
  mode: ThemeMode;
  onMode: (v: ThemeMode) => void;
  onBack: () => void;
  onSaved: (v: { user: MiniAppBootstrap["profile"]["user"] }) => void;
}) {
  const [nickname, setNickname] = useState(boot?.profile.user.nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await api<{ user: MiniAppBootstrap["profile"]["user"] }>(
        "/profile",
        { method: "PATCH", body: JSON.stringify({ nickname }) },
      );
      onSaved(result);
    } catch (issue) {
      setError((issue as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="subpage">
      <div className="page-heading">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div>
          <span className="section-kicker">PERSONALIZE</span>
          <h1>Settings</h1>
        </div>
      </div>
      <Card className="settings-card">
        <CardContent>
          <b>Appearance</b>
          <p>Follow Telegram or choose a fixed theme.</p>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => {
              if (value) onMode(value as ThemeMode);
            }}
            className="theme-toggle"
          >
            {(["auto", "light", "dark"] as ThemeMode[]).map((value) => (
              <ToggleGroupItem key={value} value={value}>
                {value === "auto"
                  ? "Auto"
                  : value === "light"
                    ? "Light"
                    : "Dark"}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>
      <Card className="settings-card">
        <CardContent>
          <b>Nickname</b>
          <p>Your nickname appears on your player card and rankings.</p>
          <input
            className="nickname-input"
            value={nickname}
            minLength={3}
            maxLength={20}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="3–20 letters, numbers, spaces, _ or -"
          />
          {error && <p className="field-error">{error}</p>}
          <Button
            className="save-nickname"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save nickname"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
