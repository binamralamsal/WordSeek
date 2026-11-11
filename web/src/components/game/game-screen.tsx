import { GameBoard } from "@/components/game/game-board";
import { GameHelpDialog } from "@/components/game/game-help-dialog";
import { GameKeyboard } from "@/components/game/game-keyboard";
import { GameResultCard } from "@/components/game/game-result-card";
import { GameResultDialog } from "@/components/game/game-result-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { hapticImpact } from "@/lib/telegram";
import type { WordLength } from "@shared/leaderboard";
import type { MiniAppClassicState, MiniAppDailyState } from "@shared/miniapp";
import { Flame, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type GameMode = "classic" | "daily";
type GameState = MiniAppDailyState | NonNullable<MiniAppClassicState>;
type PendingGuess = {
  id: number;
  guess: string;
  mode: GameMode;
  wordLength: WordLength;
  status: "queued" | "checking" | "error";
  error?: string;
};

export function GameScreen({
  mode,
  length,
  inputMethod,
  state,
  daily,
  loading,
  busy,
  keyboardStates,
  onSystemInputFocus,
  onMode,
  onLength,
  onSubmit,
  onNewGame,
  onError,
}: {
  mode: GameMode;
  length: WordLength;
  inputMethod: "onscreen" | "system";
  state: MiniAppDailyState | MiniAppClassicState | undefined;
  daily?: MiniAppDailyState;
  loading: boolean;
  busy: boolean;
  keyboardStates: Record<string, string>;
  onSystemInputFocus: (focused: boolean) => void;
  onMode: (mode: GameMode) => void;
  onLength: (length: WordLength) => void;
  onSubmit: (
    guess: string,
    mode: GameMode,
    wordLength: WordLength,
  ) => Promise<GameState | null>;
  onNewGame: () => void;
  onError: (error: unknown) => void;
}) {
  const game = mode === "daily" ? daily : state;
  const wordLength = mode === "daily" ? 5 : length;
  const maxAttempts = mode === "daily" ? 6 : 30;
  const guesses = game?.guesses ?? [];
  const finished = Boolean(
    game && game.status !== (mode === "daily" ? "playing" : "active"),
  );
  const classicState =
    mode === "classic" && state
      ? (state as NonNullable<MiniAppClassicState>)
      : null;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingGuesses, setPendingGuesses] = useState<PendingGuess[]>([]);
  const [revealRows, setRevealRows] = useState<number[]>([]);
  const [celebrationRows, setCelebrationRows] = useState<number[]>([]);
  const draftRef = useRef("");
  const acceptedCountRef = useRef(guesses.length);
  acceptedCountRef.current = guesses.length;
  const pendingRef = useRef<PendingGuess[]>([]);
  const queueRef = useRef<PendingGuess[]>([]);
  const queueWorkerRef = useRef(false);
  const nextGuessIdRef = useRef(0);
  const onSubmitRef = useRef(onSubmit);
  const onErrorRef = useRef(onError);
  const revealTimers = useRef(new Map<number, number>());
  const celebrateTimers = useRef(new Map<number, number>());
  const errorTimers = useRef(new Map<number, number>());
  const resultTimer = useRef<number | null>(null);
  const confettiTimer = useRef<number | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [confetti, setConfetti] = useState(false);
  onSubmitRef.current = onSubmit;
  onErrorRef.current = onError;
  const gameId =
    mode === "classic" && state && "id" in state ? state.id : daily?.date;
  const previousGameId = useRef(gameId);

  const setDraftValue = (value: string) => {
    draftRef.current = value;
    setDraft(value);
  };

  const commitPending = (next: PendingGuess[]) => {
    pendingRef.current = next;
    setPendingGuesses(next);
  };

  const addReveal = (row: number, won: boolean, wordSize: number) => {
    setRevealRows((rows) => (rows.includes(row) ? rows : [...rows, row]));
    const revealDuration = 560 + (wordSize - 1) * 110;
    const revealTimer = window.setTimeout(() => {
      setRevealRows((rows) => rows.filter((item) => item !== row));
      revealTimers.current.delete(row);
    }, revealDuration + 220);
    revealTimers.current.set(row, revealTimer);

    if (!won) return revealDuration;
    const celebrateTimer = window.setTimeout(() => {
      setCelebrationRows((rows) =>
        rows.includes(row) ? rows : [...rows, row],
      );
      const clearTimer = window.setTimeout(() => {
        setCelebrationRows((rows) => rows.filter((item) => item !== row));
        celebrateTimers.current.delete(row);
      }, 850);
      celebrateTimers.current.set(row, clearTimer);
    }, revealDuration + 160);
    celebrateTimers.current.set(row, celebrateTimer);
    return revealDuration;
  };

  const removePending = (id: number) => {
    commitPending(pendingRef.current.filter((item) => item.id !== id));
  };

  const showRowError = (item: PendingGuess, error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Could not check this word.";
    commitPending(
      pendingRef.current.map((pending) =>
        pending.id === item.id
          ? { ...pending, status: "error", error: message }
          : pending,
      ),
    );
    const timer = window.setTimeout(() => {
      removePending(item.id);
      errorTimers.current.delete(item.id);
    }, 1500);
    errorTimers.current.set(item.id, timer);

    onErrorRef.current(error);
  };

  const processQueue = useCallback(async () => {
    if (queueWorkerRef.current) return;
    queueWorkerRef.current = true;
    setSending(true);

    try {
      while (queueRef.current.length > 0) {
        const item = queueRef.current[0]!;
        commitPending(
          pendingRef.current.map((pending) =>
            pending.id === item.id
              ? { ...pending, status: "checking" }
              : pending,
          ),
        );

        try {
          const next = await onSubmitRef.current(
            item.guess,
            item.mode,
            item.wordLength,
          );
          if (!next) throw new Error("The guess could not be recorded.");

          queueRef.current.shift();
          acceptedCountRef.current = next.guesses.length;
          for (const [id, timer] of errorTimers.current) {
            window.clearTimeout(timer);
            errorTimers.current.delete(id);
          }
          commitPending(
            pendingRef.current.filter(
              (pending) => pending.id !== item.id && pending.status !== "error",
            ),
          );

          const row = next.guesses.length - 1;
          const revealDuration = addReveal(
            row,
            next.status === "won",
            item.wordLength,
          );

          if (item.mode === "classic" && next.status !== "active") {
            if (resultTimer.current) window.clearTimeout(resultTimer.current);
            resultTimer.current = window.setTimeout(() => {
              setResultOpen(true);
              if (next.status === "won") {
                setConfetti(true);
                if (confettiTimer.current)
                  window.clearTimeout(confettiTimer.current);
                confettiTimer.current = window.setTimeout(
                  () => setConfetti(false),
                  3200,
                );
              }
            }, revealDuration + 480);
          }

          const terminal =
            next.status !== (item.mode === "daily" ? "playing" : "active");
          if (terminal) {
            queueRef.current = [];
            commitPending(
              pendingRef.current.filter(
                (pending) => pending.status === "error",
              ),
            );
            break;
          }
        } catch (error) {
          queueRef.current.shift();
          showRowError(item, error);
        }
      }
    } finally {
      queueWorkerRef.current = false;
      setSending(false);
    }
  }, []);

  useEffect(() => {
    setDraftValue("");
    commitPending([]);
    setRevealRows([]);
    setCelebrationRows([]);
    queueRef.current = [];
    setResultOpen(false);
    setConfetti(false);
    return () => {
      for (const timer of revealTimers.current.values())
        window.clearTimeout(timer);
      for (const timer of celebrateTimers.current.values())
        window.clearTimeout(timer);
      for (const timer of errorTimers.current.values())
        window.clearTimeout(timer);
      if (resultTimer.current) window.clearTimeout(resultTimer.current);
      if (confettiTimer.current) window.clearTimeout(confettiTimer.current);
    };
  }, [length, mode]);

  useEffect(() => {
    const previousId = previousGameId.current;
    previousGameId.current = gameId;
    if (gameId === previousId) return;
    if (previousId == null) return;

    setDraftValue("");
    setRevealRows([]);
    setCelebrationRows([]);
    setResultOpen(false);
    setConfetti(false);
    for (const timer of revealTimers.current.values())
      window.clearTimeout(timer);
    for (const timer of celebrateTimers.current.values())
      window.clearTimeout(timer);
    if (resultTimer.current) window.clearTimeout(resultTimer.current);
    if (confettiTimer.current) window.clearTimeout(confettiTimer.current);
  }, [gameId]);

  const submit = useCallback(() => {
    const guess = draftRef.current.trim().toLowerCase();
    const reservedAttempts = acceptedCountRef.current + queueRef.current.length;
    if (
      guess.length !== wordLength ||
      busy ||
      finished ||
      loading ||
      (mode === "daily" && !game) ||
      reservedAttempts >= maxAttempts
    )
      return;

    const item: PendingGuess = {
      id: ++nextGuessIdRef.current,
      guess,
      mode,
      wordLength,
      status: "queued",
    };
    queueRef.current.push(item);
    commitPending([...pendingRef.current, item]);
    setDraftValue("");
    void processQueue();
  }, [
    busy,
    finished,
    game,
    loading,
    maxAttempts,
    mode,
    processQueue,
    wordLength,
  ]);

  const pressKey = useCallback(
    (key: string, repeated = false) => {
      const isUnavailable =
        busy || finished || loading || (mode === "daily" && !game);
      if (
        isUnavailable ||
        (key !== "BACKSPACE" &&
          acceptedCountRef.current + queueRef.current.length >= maxAttempts)
      )
        return;
      if (!repeated) hapticImpact("light");
      if (key === "ENTER") {
        submit();
        return;
      }
      if (key === "BACKSPACE") {
        setDraftValue(draftRef.current.slice(0, -1));
        return;
      }
      if (/^[a-z]$/i.test(key))
        setDraftValue(
          draftRef.current.length < wordLength
            ? `${draftRef.current}${key.toLowerCase()}`
            : draftRef.current,
        );
    },
    [busy, finished, game, loading, maxAttempts, mode, submit, wordLength],
  );

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      if (event.key === "Enter") {
        event.preventDefault();
        pressKey("ENTER");
      } else if (event.key === "Backspace") {
        event.preventDefault();
        pressKey("BACKSPACE");
      } else if (/^[a-z]$/i.test(event.key)) pressKey(event.key);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [pressKey]);

  const waitingForGame = loading || (busy && !game);
  const pendingRequestCount = pendingGuesses.filter(
    (item) => item.status !== "error",
  ).length;
  const globalInputDisabled =
    loading || busy || (mode === "daily" && !game) || finished;
  const hasAttemptCapacity =
    acceptedCountRef.current + queueRef.current.length < maxAttempts;

  return (
    <section className="game-screen" aria-label="WordSeek game">
      <div className="game-mode-row">
        <div className="mode-switch-wrap">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => {
              if (value && !sending && pendingRequestCount === 0)
                onMode(value as GameMode);
            }}
            className="mode-switch"
            aria-label="Game mode"
          >
            <ToggleGroupItem
              value="classic"
              disabled={sending || pendingRequestCount > 0}
            >
              Classic
            </ToggleGroupItem>
            <ToggleGroupItem
              value="daily"
              disabled={sending || pendingRequestCount > 0}
            >
              Daily
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {mode === "daily" ? (
          <Badge variant="secondary" className="daily-streak">
            <Flame size={14} /> {daily?.streak.current ?? 0} day streak
          </Badge>
        ) : (
          <span className="attempt-count">
            {Math.max(0, maxAttempts - guesses.length - pendingRequestCount)}{" "}
            guesses left
          </span>
        )}
        <GameHelpDialog />
      </div>

      {mode === "classic" && (
        <div className="classic-toolbar">
          <div>
            <span className="game-eyebrow">PRACTICE AT YOUR PACE</span>
            <h1>Classic</h1>
          </div>
          <ToggleGroup
            type="single"
            value={String(length)}
            onValueChange={(value) => {
              if (value) onLength(Number(value) as WordLength);
            }}
            className="word-length-toggle"
            aria-label="Word length"
          >
            {([4, 5, 6] as WordLength[]).map((value) => (
              <ToggleGroupItem
                value={String(value)}
                key={value}
                disabled={busy || loading || sending || pendingRequestCount > 0}
              >
                {value}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            variant="outline"
            size="icon-sm"
            className="game-new-button"
            onClick={onNewGame}
            disabled={busy || loading || sending}
            aria-label="Start a new classic game"
            title="Start a new game"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
      )}
      {mode === "daily" && (
        <div className="daily-heading">
          <div>
            <span className="game-eyebrow">
              DAILY WORDSEEK · #{daily?.dayNumber ?? "—"}
            </span>
            <h1>Today’s puzzle</h1>
          </div>
          <Sparkles className="daily-mark" aria-hidden="true" />
        </div>
      )}

      {game || waitingForGame || mode === "classic" ? (
        <GameBoard
          key={gameId ?? "no-game"}
          guesses={guesses}
          draft={draft}
          wordLength={wordLength}
          maxAttempts={maxAttempts}
          loading={waitingForGame}
          pendingGuesses={pendingGuesses}
          revealRows={revealRows}
          celebrationRows={celebrationRows}
          finished={finished}
        />
      ) : (
        <Card className="game-unavailable">
          <CardContent>
            <Sparkles />
            <b>Couldn’t load this puzzle</b>
            <span>Check your connection and try again.</span>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {finished && game && mode === "daily" && (
        <GameResultCard kind="daily" state={game} />
      )}
      {mode === "classic" && classicState && finished && (
        <GameResultDialog
          open={resultOpen}
          onOpenChange={setResultOpen}
          state={classicState}
          onPlayAgain={onNewGame}
        />
      )}
      {confetti && <ConfettiBurst />}

      <GameKeyboard
        inputMethod={inputMethod}
        states={keyboardStates}
        draft={draft}
        wordLength={wordLength}
        disabled={globalInputDisabled}
        canSubmit={
          !globalInputDisabled &&
          hasAttemptCapacity &&
          draft.length === wordLength
        }
        onKey={pressKey}
        onInputFocus={onSystemInputFocus}
        onInputChange={(value) => {
          setDraftValue(
            value
              .replace(/[^a-z]/gi, "")
              .slice(0, wordLength)
              .toLowerCase(),
          );
        }}
      />
    </section>
  );
}

function ConfettiBurst() {
  const colors = [
    "var(--primary)",
    "var(--tile-correct)",
    "var(--tile-present)",
    "#f48fb1",
    "#ffd166",
  ];

  return (
    <div className="confetti-burst" aria-hidden="true">
      {Array.from({ length: 42 }, (_, index) => (
        <span
          className="confetti-piece"
          key={index}
          style={
            {
              "--confetti-x": `${(index * 47) % 100}%`,
              "--confetti-drift": `${((index * 37) % 150) - 75}px`,
              "--confetti-duration": `${1900 + ((index * 29) % 1100)}ms`,
              "--confetti-delay": `${(index * 31) % 340}ms`,
              "--confetti-rotation": `${index * 83}deg`,
              "--confetti-color": colors[index % colors.length],
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
