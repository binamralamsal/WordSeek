import type {
  LeaderboardPage,
  MiniAppBootstrap,
  MiniAppClassicState,
  MiniAppDailyState,
} from "@shared/miniapp";
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  getTelegramWebApp,
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

type Screen = "daily" | "classic" | "leaderboard" | "profile" | "settings";
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
function App() {
  const [mode, setMode] = useState<ThemeMode>(readStoredTheme),
    [screen, setScreen] = useState<Screen>("daily"),
    [data, setData] = useState<MiniAppBootstrap | null>(null),
    [classic, setClassic] = useState<MiniAppClassicState>(null),
    [length, setLength] = useState<4 | 5 | 6>(5),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [scope, setScope] = useState("global"),
    [period, setPeriod] = useState("week"),
    [board, setBoard] = useState<LeaderboardPage | null>(null);
  useEffect(() => {
    initTelegram();
    applyTheme(mode);
    return subscribeToTheme(mode, () => {});
  }, [mode]);
  useEffect(() => {
    api<MiniAppBootstrap>("/bootstrap")
      .then((x) => {
        setData(x);
        setClassic(x.classic);
      })
      .catch((e) => setNotice(e.message));
  }, []);
  useEffect(() => {
    if (screen === "leaderboard")
      api<LeaderboardPage>(
        `/leaderboard?scope=${scope}&period=${period}&length=${length}`,
      )
        .then(setBoard)
        .catch((e) => setNotice(e.message));
  }, [screen, scope, period, length]);
  const game = screen === "daily" ? data?.daily : classic;
  const wordLen = screen === "daily" ? 5 : (classic?.wordLength ?? length);
  const [entry, setEntry] = useState("");
  const rows = game?.guesses ?? [];
  const keyStates = useMemo(() => {
    const m: Record<string, string> = {};
    rows.forEach((r) =>
      r.guess.split("").forEach((c, i) => {
        const s = r.states[i];
        if (s === "correct" || (!m[c] && s === "present") || !m[c]) m[c] = s;
      }),
    );
    return m;
  }, [rows]);
  const submit = async (word = entry) => {
    if (
      !game ||
      game.status !== (screen === "daily" ? "playing" : "active") ||
      word.length !== wordLen ||
      busy
    )
      return;
    setBusy(true);
    try {
      const next =
        screen === "daily"
          ? await api<MiniAppDailyState>("/daily/guess", {
              method: "POST",
              body: JSON.stringify({ guess: word }),
            })
          : await api<MiniAppClassicState>("/classic/guess", {
              method: "POST",
              body: JSON.stringify({ guess: word }),
            });
      if (screen === "daily")
        setData((d) => (d ? { ...d, daily: next as MiniAppDailyState } : d));
      else setClassic(next as MiniAppClassicState);
      setEntry("");
      hapticImpact("medium");
      if (next && next.status !== (screen === "daily" ? "playing" : "active"))
        hapticNotification(next.status === "won" ? "success" : "error");
    } catch (e) {
      setNotice((e as Error).message);
      setTimeout(() => setNotice(""), 2200);
      hapticNotification("error");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (screen !== "daily" && screen !== "classic") return;
      if (e.key === "Enter") void submit();
      else if (e.key === "Backspace") setEntry((v) => v.slice(0, -1));
      else if (/^[a-z]$/i.test(e.key) && entry.length < wordLen)
        setEntry((v) => v + e.key.toLowerCase());
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [screen, entry, wordLen, game, busy]);
  const startClassic = async (l = length) => {
    try {
      setClassic(
        await api<MiniAppClassicState>("/classic/start", {
          method: "POST",
          body: JSON.stringify({ wordLength: l }),
        }),
      );
      setScreen("classic");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const sendKey = (k: string) => {
    hapticImpact();
    if (k === "enter") void submit();
    else if (k === "⌫") setEntry((v) => v.slice(0, -1));
    else if (entry.length < wordLen) setEntry((v) => v + k.toLowerCase());
  };
  return (
    <main className="app-bg min-h-screen pb-24">
      <header className="topbar">
        <div className="brandmark">W</div>
        <div>
          <b>WordSeek</b>
          <small>{data?.profile.group?.title ?? "Daily word puzzle"}</small>
        </div>
        <button className="avatar" onClick={() => setScreen("profile")}>
          {data?.profile.user.displayName.slice(0, 1) ?? "•"}
        </button>
      </header>
      <section className="content">
        {notice && <div className="toast">{notice}</div>}
        {(screen === "daily" || screen === "classic") && (
          <>
            <div className="game-heading">
              <div>
                <div className="eyebrow">
                  {screen === "daily"
                    ? `PUZZLE ${data?.daily.dayNumber ?? "—"}`
                    : "CLASSIC MODE"}
                </div>
                <h1>
                  {screen === "daily" ? "Daily WordSeek" : "Classic WordSeek"}
                </h1>
                <p>
                  {screen === "daily"
                    ? "A fresh word, every day."
                    : `${wordLen} letters · ${30 - (classic?.guesses.length ?? 0)} guesses left`}
                </p>
              </div>
              <button
                className="mode-switch"
                onClick={() =>
                  setScreen(screen === "daily" ? "classic" : "daily")
                }
              >
                {screen === "daily" ? "Classic ↗" : "Daily ↗"}
              </button>
            </div>
            {screen === "classic" && (
              <div className="length-picker">
                {([4, 5, 6] as const).map((n) => (
                  <button
                    className={length === n ? "selected" : ""}
                    onClick={() => {
                      setLength(n);
                      if (!classic || classic.status !== "active")
                        void startClassic(n);
                    }}
                    key={n}
                  >
                    {n} letters
                  </button>
                ))}
              </div>
            )}
            <div
              className={`board ${wordLen === 4 ? "four" : wordLen === 6 ? "six" : ""}`}
            >
              {Array.from({ length: screen === "daily" ? 6 : 30 }, (_, r) => {
                const guess =
                  rows[r]?.guess ?? (r === rows.length ? entry : "");
                return (
                  <div
                    className={`row ${r === rows.length && entry ? "shake" : ""}`}
                    key={r}
                  >
                    {Array.from({ length: wordLen }, (_, c) => {
                      const state = rows[r]?.states[c];
                      return (
                        <div
                          className={`tile ${state ?? (guess[c] ? "filled" : "")} ${rows[r] ? "reveal" : ""}`}
                          style={{ animationDelay: `${c * 110}ms` }}
                          key={c}
                        >
                          {guess[c]?.toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {game &&
            game.status !== (screen === "daily" ? "playing" : "active") ? (
              <div className="result-card">
                <b>
                  {game.status === "won" ? "Brilliant! ✨" : "The word was "}
                  {game.status === "lost" && (
                    <strong>{game.solution?.toUpperCase()}</strong>
                  )}
                </b>
                <span>
                  {game.status === "won"
                    ? `${rows.length} ${rows.length === 1 ? "try" : "tries"} · ${screen === "daily" ? `🔥 ${data?.daily.streak.current} day streak` : `${classic?.score} points`}`
                    : "Come back for another round tomorrow."}
                </span>
                {screen === "classic" && (
                  <button
                    className="primary"
                    onClick={() => void startClassic()}
                  >
                    Play again
                  </button>
                )}
              </div>
            ) : null}
            <div className="keyboard">
              {["qwertyuiop", "asdfghjkl"].map((row) => (
                <div className="keyrow" key={row}>
                  {row.split("").map((k) => (
                    <button
                      className={`key ${keyStates[k] ?? ""}`}
                      onClick={() => sendKey(k)}
                      key={k}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              ))}
              <div className="keyrow">
                <button className="key wide" onClick={() => sendKey("enter")}>
                  ENTER
                </button>
                {"zxcvbnm".split("").map((k) => (
                  <button
                    className={`key ${keyStates[k] ?? ""}`}
                    onClick={() => sendKey(k)}
                    key={k}
                  >
                    {k}
                  </button>
                ))}
                <button className="key wide" onClick={() => sendKey("⌫")}>
                  ⌫
                </button>
              </div>
            </div>
          </>
        )}
        {screen === "leaderboard" && (
          <>
            <div className="eyebrow">THE FIELD</div>
            <h1>Leaderboard</h1>
            <div className="filters">
              {[scope, period].map((v, i) => (
                <select
                  value={v}
                  onChange={(e) =>
                    i ? setPeriod(e.target.value) : setScope(e.target.value)
                  }
                  key={i}
                >
                  {(i
                    ? ["today", "week", "month", "year", "all"]
                    : ["global", ...(data?.profile.group ? ["group"] : [])]
                  ).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              ))}
              {([4, 5, 6] as const).map((n) => (
                <button
                  className={length === n ? "selected" : ""}
                  onClick={() => setLength(n)}
                  key={n}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="rank-list">
              {board?.rows.map((r, i) => (
                <div className={`rank ${i < 3 ? "podium" : ""}`} key={r.userId}>
                  <b className="rank-no">
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : r.rank}
                  </b>
                  <div className="rank-avatar">{r.displayName.slice(0, 1)}</div>
                  <div className="rank-name">
                    <b>
                      {r.displayName}
                      {r.isMe ? " · you" : ""}
                    </b>
                    <small>
                      {r.username ? `@${r.username}` : "WordSeek player"}
                    </small>
                  </div>
                  <strong>{r.score}</strong>
                </div>
              ))}
            </div>
          </>
        )}
        {screen === "profile" && data && (
          <>
            <div className="profile-hero">
              <div className="profile-avatar">
                {data.profile.user.displayName.slice(0, 1)}
              </div>
              <h1>{data.profile.user.displayName}</h1>
              <p>
                {data.profile.user.username
                  ? `@${data.profile.user.username}`
                  : "WordSeek player"}
              </p>
            </div>
            <div className="stats">
              {[
                ["TOTAL POINTS", data.profile.stats.totalScore],
                ["BEST SCORE", data.profile.stats.bestScore],
                ["CURRENT STREAK", `🔥 ${data.profile.stats.currentStreak}`],
                [
                  "CLASSIC WINS",
                  `${data.profile.stats.classicWins}/${data.profile.stats.classicGames}`,
                ],
              ].map(([a, b]) => (
                <div className="stat" key={a}>
                  <small>{a}</small>
                  <b>{b}</b>
                </div>
              ))}
            </div>
            <button
              className="primary full"
              onClick={() => setScreen("settings")}
            >
              Edit profile & settings
            </button>
          </>
        )}
        {screen === "settings" && data && (
          <>
            <div className="eyebrow">YOUR EXPERIENCE</div>
            <h1>Settings</h1>
            <div className="panel">
              <b>Appearance</b>
              <p>Match your Telegram theme or choose your own.</p>
              <div className="segmented">
                {(["auto", "light", "dark"] as ThemeMode[]).map((m) => (
                  <button
                    className={mode === m ? "selected" : ""}
                    onClick={() => {
                      setMode(m);
                      storeTheme(m);
                    }}
                    key={m}
                  >
                    {m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel">
              <b>Nickname</b>
              <p>Shown on your WordSeek profile and rankings.</p>
              <Nickname
                current={data.profile.user.nickname ?? ""}
                onSave={async (n) => {
                  await api("/profile", {
                    method: "PATCH",
                    body: JSON.stringify({ nickname: n }),
                  });
                  const fresh = await api<MiniAppBootstrap>("/bootstrap");
                  setData(fresh);
                  setNotice("Nickname saved");
                  setTimeout(() => setNotice(""), 1800);
                }}
              />
            </div>
          </>
        )}
      </section>
      <nav className="tabbar">
        {(
          [
            ["daily", "◷", "Daily"],
            ["classic", "▦", "Classic"],
            ["leaderboard", "♧", "Ranks"],
            ["profile", "◎", "Profile"],
          ] as [Screen, string, string][]
        ).map(([s, icon, label]) => (
          <button
            className={screen === s ? "active" : ""}
            onClick={() =>
              s === "classic" && !classic ? void startClassic() : setScreen(s)
            }
            key={s}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
}
function Nickname({
  current,
  onSave,
}: {
  current: string;
  onSave: (s: string) => Promise<void>;
}) {
  const [v, setV] = useState(current),
    [saving, setSaving] = useState(false);
  return (
    <div className="nick-row">
      <input
        value={v}
        maxLength={20}
        onChange={(e) => setV(e.target.value)}
        placeholder="Choose a nickname"
      />
      <button
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(v);
          } catch (e) {
            alert((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
        disabled={saving}
      >
        {saving ? "…" : "Save"}
      </button>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
