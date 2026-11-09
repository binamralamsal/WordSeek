import { GameScreen } from "@/components/game/game-screen";
import {
  type AppSection,
  BottomNavigation,
} from "@/components/navigation/bottom-navigation";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { LeaderboardScreen } from "@/components/rankings/leaderboard-screen";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { hapticImpact, hapticNotification, initTelegram } from "@/lib/telegram";
import type { ThemeMode } from "@/lib/telegram-types";
import {
  applyTheme,
  readStoredTheme,
  storeTheme,
  subscribeToTheme,
} from "@/lib/theme";
import type { LeaderboardPeriod, WordLength } from "@shared/leaderboard";
import type {
  MiniAppBootstrap,
  MiniAppClassicState,
  MiniAppDailyState,
  MiniAppLeaderboardPage,
  MiniAppLeaderboardScope,
  MyRanking,
} from "@shared/miniapp";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlayView = "game" | "rankings" | "profile";

export function App() {
  const [section, setSection] = useState<AppSection>("play");
  const [playView, setPlayView] = useState<PlayView>("game");
  const [mode, setMode] = useState<ThemeMode>(readStoredTheme);
  const [gameMode, setGameMode] = useState<"classic" | "daily">("classic");
  const [length, setLength] = useState<WordLength>(5);
  const [boot, setBoot] = useState<MiniAppBootstrap | null>(null);
  const [classic, setClassic] = useState<MiniAppClassicState>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [leaderboard, setLeaderboard] = useState<MiniAppLeaderboardPage | null>(
    null,
  );
  const [ranking, setRanking] = useState<MyRanking>();
  const [rankLoading, setRankLoading] = useState(false);
  const [scope, setScope] = useState<MiniAppLeaderboardScope>("global");
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [filterLength, setFilterLength] = useState<WordLength>(5);
  const [page, setPage] = useState(1);
  const gameRequestId = useRef(0);
  const rankingRequestId = useRef(0);

  useEffect(() => {
    initTelegram();
    applyTheme(mode);
    return subscribeToTheme(mode, () => {});
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    api<MiniAppBootstrap>("/bootstrap")
      .then(async (result) => {
        if (cancelled) return;
        setBoot(result);
        if (result.classic) {
          setClassic(result.classic);
          setLength(result.classic.wordLength);
        } else {
          const initialGame = await api<MiniAppClassicState>("/classic/start", {
            method: "POST",
            body: JSON.stringify({ wordLength: 5 }),
          });
          if (!cancelled) setClassic(initialGame);
        }
      })
      .catch((error: Error) => setNotice(error.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshRanking = useCallback(async () => {
    if (
      section !== "play" ||
      (playView !== "rankings" && playView !== "profile")
    )
      return;
    const requestId = ++rankingRequestId.current;
    setRankLoading(true);
    const activeScope = playView === "rankings" ? "global" : scope;
    const query = `scope=${activeScope}&period=${period}&length=${filterLength}`;
    try {
      if (playView === "rankings") {
        const result = await api<MiniAppLeaderboardPage>(
          `/leaderboard?${query}&page=${page}`,
        );
        if (requestId === rankingRequestId.current) setLeaderboard(result);
      } else {
        const result = await api<MyRanking>(`/leaderboard/me?${query}`);
        if (requestId === rankingRequestId.current) setRanking(result);
      }
    } catch (error) {
      if (requestId === rankingRequestId.current)
        setNotice((error as Error).message);
    } finally {
      if (requestId === rankingRequestId.current) setRankLoading(false);
    }
  }, [filterLength, page, period, playView, scope, section]);

  useEffect(() => {
    void refreshRanking();
  }, [refreshRanking]);

  const daily = boot?.daily;
  const currentGame = gameMode === "daily" ? daily : classic;
  const changePlayView = (value: string) => setPlayView(value as PlayView);

  const selectLength = async (nextLength: WordLength) => {
    const requestId = ++gameRequestId.current;
    setLength(nextLength);
    setGameMode("classic");
    setClassic(null);
    setBusy(true);
    setNotice("");
    try {
      let next = await api<MiniAppClassicState>(
        `/classic?length=${nextLength}`,
      );
      if (!next) {
        next = await api<MiniAppClassicState>("/classic/start", {
          method: "POST",
          body: JSON.stringify({ wordLength: nextLength }),
        });
      }
      if (requestId === gameRequestId.current) setClassic(next);
    } catch (error) {
      if (requestId === gameRequestId.current)
        setNotice((error as Error).message);
    } finally {
      if (requestId === gameRequestId.current) setBusy(false);
    }
  };

  const startNewClassic = async () => {
    const requestId = ++gameRequestId.current;
    const gameLength = length;
    setBusy(true);
    setClassic(null);
    try {
      const next = await api<MiniAppClassicState>("/classic/start", {
        method: "POST",
        body: JSON.stringify({ wordLength: gameLength }),
      });
      if (requestId === gameRequestId.current) setClassic(next);
    } catch (error) {
      if (requestId === gameRequestId.current)
        setNotice((error as Error).message);
    } finally {
      if (requestId === gameRequestId.current) setBusy(false);
    }
  };

  const submitGuess = async (guess: string) => {
    if (gameMode === "daily") {
      const next = await api<MiniAppDailyState>("/daily/guess", {
        method: "POST",
        body: JSON.stringify({ guess }),
      });
      setBoot((value) => (value ? { ...value, daily: next } : value));
      if (next.status !== "playing")
        hapticNotification(next.status === "won" ? "success" : "error");
      return next;
    }
    const next = await api<MiniAppClassicState>("/classic/guess", {
      method: "POST",
      body: JSON.stringify({ guess, wordLength: length }),
    });
    setClassic(next);
    if (next && next.status !== "active")
      hapticNotification(next.status === "won" ? "success" : "error");
    return next;
  };

  const keyboardStates = useMemo(() => {
    const states: Record<string, string> = {};
    const priority: Record<string, number> = {
      absent: 1,
      present: 2,
      correct: 3,
    };
    currentGame?.guesses.forEach(({ guess, states: marks }) => {
      guess.split("").forEach((letter, index) => {
        const incoming = marks[index];
        if ((priority[incoming] ?? 0) > (priority[states[letter] ?? ""] ?? 0)) {
          states[letter] = incoming;
        }
      });
    });
    return states;
  }, [currentGame]);

  const closeNotice = () => setNotice("");
  const handleError = (error: unknown) => {
    setNotice((error as Error).message || "Something went wrong.");
    window.setTimeout(closeNotice, 2800);
    hapticNotification("error");
  };

  return (
    <main
      className={`miniapp ${section === "play" && playView === "game" ? "is-game" : ""}`}
    >
      {notice && (
        <div className="toast" role="status" onClick={closeNotice}>
          {notice}
        </div>
      )}
      <div
        className="screen-scroll"
        key={section === "settings" ? "settings" : `play-${playView}`}
      >
        {section === "settings" ? (
          <SettingsScreen
            user={boot?.profile.user}
            mode={mode}
            onMode={(next) => {
              setMode(next);
              storeTheme(next);
            }}
            onSaved={(user) =>
              setBoot((value) =>
                value
                  ? { ...value, profile: { ...value.profile, user } }
                  : value,
              )
            }
          />
        ) : (
          <>
            <Tabs
              value={playView}
              onValueChange={changePlayView}
              className="play-tabs-shell"
            >
              <TabsList className="play-tabs">
                <TabsTrigger value="game">Play</TabsTrigger>
                <TabsTrigger value="rankings">Ranks</TabsTrigger>
                <TabsTrigger value="profile">Profile</TabsTrigger>
              </TabsList>
            </Tabs>
            {playView === "game" && (
              <GameScreen
                key={`${gameMode}-${length}-${gameMode === "classic" ? (classic?.id ?? "pending") : (daily?.date ?? "daily")}`}
                mode={gameMode}
                length={length}
                state={currentGame}
                daily={daily}
                loading={loading}
                busy={busy}
                keyboardStates={keyboardStates}
                onMode={(next) => {
                  if (next === "daily") {
                    setGameMode("daily");
                    hapticImpact("light");
                  } else {
                    setGameMode("classic");
                    void selectLength(length);
                  }
                }}
                onLength={(next) => {
                  void selectLength(next);
                }}
                onSubmit={submitGuess}
                onNewGame={() => {
                  void startNewClassic();
                }}
                onError={handleError}
              />
            )}
            {playView === "rankings" && (
              <LeaderboardScreen
                page={leaderboard}
                loading={rankLoading}
                pageIndex={page}
                period={period}
                length={filterLength}
                onPeriod={(next) => {
                  setPeriod(next);
                  setPage(1);
                }}
                onLength={(next) => {
                  setFilterLength(next);
                  setPage(1);
                }}
                onPage={setPage}
              />
            )}
            {playView === "profile" && (
              <ProfileScreen
                profile={boot?.profile}
                loading={loading}
                scope={scope}
                period={period}
                length={filterLength}
                ranking={ranking}
                rankingLoading={rankLoading}
                groupAvailable={Boolean(boot?.profile.group)}
                onScope={(next) => setScope(next)}
                onPeriod={(next) => setPeriod(next)}
                onLength={(next) => setFilterLength(next)}
              />
            )}
          </>
        )}
      </div>
      <BottomNavigation value={section} onChange={setSection} />
    </main>
  );
}
