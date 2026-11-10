import { GameScreen } from "@/components/game/game-screen";
import {
  type AppSection,
  BottomNavigation,
} from "@/components/navigation/bottom-navigation";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { LeaderboardScreen } from "@/components/rankings/leaderboard-screen";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { api } from "@/lib/api-client";
import {
  type MiniAppPreferences,
  readPreferences,
  storePreferences,
} from "@/lib/preferences";
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
  MiniAppPublicProfile,
  MiniAppPublicUser,
  MyRanking,
} from "@shared/miniapp";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type PlayView = "game" | "rankings" | "profile";
const EMPTY_CLASSIC_GAMES: Record<WordLength, MiniAppClassicState> = {
  4: null,
  5: null,
  6: null,
};

export function App() {
  const [section, setSection] = useState<AppSection>("play");
  const [playView, setPlayView] = useState<PlayView>("game");
  const [mode, setMode] = useState<ThemeMode>(readStoredTheme);
  const [preferences, setPreferences] =
    useState<MiniAppPreferences>(readPreferences);
  const miniAppRef = useRef<HTMLElement>(null);
  const [systemInputFocused, setSystemInputFocused] = useState(false);
  const [systemKeyboardOffset, setSystemKeyboardOffset] = useState(0);
  const [gameMode, setGameMode] = useState<"classic" | "daily">("classic");
  const [length, setLength] = useState<WordLength>(5);
  const queryClient = useQueryClient();
  const [classicGames, setClassicGames] =
    useState<Record<WordLength, MiniAppClassicState>>(EMPTY_CLASSIC_GAMES);
  const [classic, setClassic] = useState<MiniAppClassicState>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [scope, setScope] = useState<MiniAppLeaderboardScope>("global");
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [filterLength, setFilterLength] = useState<WordLength>(5);
  const [page, setPage] = useState(1);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [profileReturnTo, setProfileReturnTo] = useState<PlayView>("rankings");
  const gameRequestId = useRef(0);
  const initializedClassicRef = useRef(false);

  useEffect(() => {
    initTelegram();
    applyTheme(mode);
    return subscribeToTheme(mode, () => {});
  }, [mode]);

  useEffect(() => {
    if (!systemInputFocused || preferences.inputMethod !== "system") {
      setSystemKeyboardOffset(0);
      miniAppRef.current?.style.removeProperty("--visual-viewport-height");
      return;
    }

    const updateKeyboardOffset = () => {
      const viewport = window.visualViewport;
      const offset = viewport
        ? window.innerHeight - viewport.height - viewport.offsetTop
        : 0;
      setSystemKeyboardOffset(Math.max(0, Math.round(offset)));
      miniAppRef.current?.style.setProperty(
        "--visual-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
    };

    updateKeyboardOffset();
    window.addEventListener("resize", updateKeyboardOffset);
    window.visualViewport?.addEventListener("resize", updateKeyboardOffset);
    window.visualViewport?.addEventListener("scroll", updateKeyboardOffset);
    return () => {
      window.removeEventListener("resize", updateKeyboardOffset);
      window.visualViewport?.removeEventListener(
        "resize",
        updateKeyboardOffset,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        updateKeyboardOffset,
      );
    };
  }, [preferences.inputMethod, systemInputFocused]);

  const bootstrapQuery = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => api<MiniAppBootstrap>("/bootstrap"),
  });
  const boot = bootstrapQuery.data;
  const loading = bootstrapQuery.isPending;
  const daily = boot?.daily;

  useEffect(() => {
    if (boot && !initializedClassicRef.current) {
      initializedClassicRef.current = true;
      setClassicGames(boot.classicGames);
      setClassic(boot.classicGames[length]);
    }
  }, [boot, length]);

  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", "global", period, filterLength, page],
    queryFn: () =>
      api<MiniAppLeaderboardPage>(
        `/leaderboard?scope=global&period=${period}&length=${filterLength}&page=${page}`,
      ),
    enabled: section === "play" && playView === "rankings",
  });
  const ownRankingQuery = useQuery({
    queryKey: ["my-ranking", scope, period, filterLength],
    queryFn: () =>
      api<MyRanking>(
        `/leaderboard/me?scope=${scope}&period=${period}&length=${filterLength}`,
      ),
    enabled: section === "play" && playView === "profile" && !targetUserId,
  });
  const publicProfileQuery = useQuery({
    queryKey: ["public-profile", targetUserId],
    queryFn: () =>
      api<MiniAppPublicProfile>(
        `/profile/${encodeURIComponent(targetUserId!)}`,
      ),
    enabled: Boolean(targetUserId),
  });
  const publicRankingQuery = useQuery({
    queryKey: [
      "public-profile-ranking",
      targetUserId,
      scope,
      period,
      filterLength,
    ],
    queryFn: () =>
      api<MyRanking>(
        `/profile/${encodeURIComponent(targetUserId!)}/ranking?scope=${scope}&period=${period}&length=${filterLength}`,
      ),
    enabled:
      Boolean(targetUserId) && section === "play" && playView === "profile",
  });

  useEffect(() => {
    const issue =
      bootstrapQuery.error ??
      leaderboardQuery.error ??
      ownRankingQuery.error ??
      publicProfileQuery.error ??
      publicRankingQuery.error;
    if (issue) setNotice((issue as Error).message);
  }, [
    bootstrapQuery.error,
    leaderboardQuery.error,
    ownRankingQuery.error,
    publicProfileQuery.error,
    publicRankingQuery.error,
  ]);
  const currentGame = gameMode === "daily" ? daily : classic;
  const selectLength = (nextLength: WordLength) => {
    gameRequestId.current += 1;
    setLength(nextLength);
    setGameMode("classic");
    setClassic(classicGames[nextLength]);
    setNotice("");
  };

  const startNewClassic = async () => {
    const requestId = ++gameRequestId.current;
    const gameLength = length;
    setBusy(true);
    try {
      await api<MiniAppClassicState>("/classic/abandon", {
        method: "POST",
        body: JSON.stringify({ wordLength: gameLength }),
      });
      if (requestId === gameRequestId.current) {
        setClassic(null);
        setClassicGames((games) => ({ ...games, [gameLength]: null }));
      }
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
      queryClient.setQueryData<MiniAppBootstrap>(["bootstrap"], (value) =>
        value ? { ...value, daily: next } : value,
      );
      if (next.status !== "playing")
        hapticNotification(next.status === "won" ? "success" : "error");
      if (next.status !== "playing") {
        void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
        void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
        void queryClient.invalidateQueries({ queryKey: ["my-ranking"] });
      }
      return next;
    }
    const next = await api<MiniAppClassicState>("/classic/guess", {
      method: "POST",
      body: JSON.stringify({ guess, wordLength: length }),
    });
    setClassic(next);
    setClassicGames((games) => ({ ...games, [length]: next }));
    if (next && next.status !== "active") {
      hapticNotification(next.status === "won" ? "success" : "error");
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      void queryClient.invalidateQueries({ queryKey: ["my-ranking"] });
      void queryClient.invalidateQueries({
        queryKey: ["public-profile-ranking"],
      });
      void queryClient.invalidateQueries({ queryKey: ["public-profile"] });
    }
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
      ref={miniAppRef}
      className={`miniapp ${section === "play" && playView === "game" ? "is-game" : ""} ${systemInputFocused && preferences.inputMethod === "system" && section === "play" && playView === "game" ? "is-system-input-active" : ""}`}
      data-keyboard-size={preferences.keyboardSize}
      style={
        {
          "--tile-size-setting": `${preferences.tileSize}px`,
          "--tile-font-size-setting": `${Math.max(12, Math.round(preferences.tileSize - 10))}px`,
          "--tile-gap-setting": `${Math.max(3, Math.round(preferences.tileSize / 8))}px`,
          "--system-keyboard-offset": `${systemKeyboardOffset}px`,
        } as CSSProperties
      }
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
            preferences={preferences}
            onPreferences={(next) => {
              setPreferences(next);
              storePreferences(next);
            }}
            onMode={(next) => {
              setMode(next);
              storeTheme(next);
            }}
            onSaved={(user) => {
              queryClient.setQueryData<MiniAppBootstrap>(
                ["bootstrap"],
                (value) =>
                  value
                    ? { ...value, profile: { ...value.profile, user } }
                    : value,
              );
              void queryClient.invalidateQueries({
                queryKey: ["leaderboard"],
              });
              void queryClient.invalidateQueries({
                queryKey: ["public-profile"],
              });
            }}
          />
        ) : (
          <>
            {playView === "game" && (
              <GameScreen
                key={`${gameMode}-${length}`}
                mode={gameMode}
                length={length}
                inputMethod={preferences.inputMethod}
                state={currentGame}
                daily={daily}
                loading={loading}
                busy={busy}
                keyboardStates={keyboardStates}
                onSystemInputFocus={setSystemInputFocused}
                onMode={(next) => {
                  if (next === "daily") {
                    setGameMode("daily");
                    hapticImpact("light");
                  } else {
                    setGameMode("classic");
                  }
                }}
                onLength={(next) => {
                  selectLength(next);
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
                page={leaderboardQuery.data ?? null}
                loading={leaderboardQuery.isPending}
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
                onOpenProfile={(userId) => {
                  setProfileReturnTo("rankings");
                  setTargetUserId(userId);
                  setPlayView("profile");
                }}
              />
            )}
            {playView === "profile" && (
              <ProfileScreen
                profile={targetUserId ? publicProfileQuery.data : boot?.profile}
                loading={targetUserId ? publicProfileQuery.isPending : loading}
                isOtherProfile={Boolean(targetUserId)}
                scope={scope}
                period={period}
                length={filterLength}
                ranking={
                  targetUserId ? publicRankingQuery.data : ownRankingQuery.data
                }
                rankingLoading={
                  targetUserId
                    ? publicRankingQuery.isPending
                    : ownRankingQuery.isPending
                }
                groupAvailable={Boolean(boot?.profile.group)}
                onScope={(next) => setScope(next)}
                onPeriod={(next) => setPeriod(next)}
                onLength={(next) => setFilterLength(next)}
                onSearchProfile={async (query) => {
                  const user = await api<MiniAppPublicUser>(
                    `/profile/search?q=${encodeURIComponent(query)}`,
                  );
                  setProfileReturnTo("profile");
                  setTargetUserId(user.id);
                }}
                onBack={() => {
                  setTargetUserId(null);
                  setPlayView(profileReturnTo);
                }}
              />
            )}
          </>
        )}
      </div>
      <BottomNavigation
        value={section === "settings" ? "settings" : playView}
        onChange={(next) => {
          setTargetUserId(null);
          if (next === "settings") {
            setSystemInputFocused(false);
            setSection("settings");
            return;
          }
          setSystemInputFocused(false);
          setSection("play");
          setPlayView(next);
        }}
      />
    </main>
  );
}
