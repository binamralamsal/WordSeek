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

export function GameScreen({
  mode,
  length,
  state,
  daily,
  loading,
  busy,
  keyboardStates,
  onMode,
  onLength,
  onSubmit,
  onNewGame,
  onError,
}: {
  mode: GameMode;
  length: WordLength;
  state: MiniAppDailyState | MiniAppClassicState | undefined;
  daily?: MiniAppDailyState;
  loading: boolean;
  busy: boolean;
  keyboardStates: Record<string, string>;
  onMode: (mode: GameMode) => void;
  onLength: (length: WordLength) => void;
  onSubmit: (guess: string) => Promise<GameState | null>;
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
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [celebrationRow, setCelebrationRow] = useState<number | null>(null);
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const revealTimer = useRef<number | null>(null);
  const celebrateTimer = useRef<number | null>(null);
  const resultTimer = useRef<number | null>(null);
  const confettiTimer = useRef<number | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const gameId =
    mode === "classic" && state && "id" in state ? state.id : daily?.date;
  const previousGameId = useRef(gameId);

  useEffect(() => {
    setDraft("");
    setRevealRow(null);
    setCelebrationRow(null);
    setShakeRow(null);
    setResultOpen(false);
    setConfetti(false);
    return () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current);
      if (resultTimer.current) window.clearTimeout(resultTimer.current);
      if (confettiTimer.current) window.clearTimeout(confettiTimer.current);
    };
  }, [length, mode]);

  useEffect(() => {
    const previousId = previousGameId.current;
    previousGameId.current = gameId;
    if (previousId == null || gameId === previousId) return;

    setDraft("");
    setRevealRow(null);
    setCelebrationRow(null);
    setResultOpen(false);
    setConfetti(false);
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current);
    if (resultTimer.current) window.clearTimeout(resultTimer.current);
    if (confettiTimer.current) window.clearTimeout(confettiTimer.current);
  }, [gameId]);

  const submit = useCallback(async () => {
    if (draft.length !== wordLength || busy || sending || finished || loading)
      return;
    setSending(true);
    const row = guesses.length;
    try {
      const next = await onSubmit(draft);
      if (!next) return;
      setDraft("");
      setRevealRow(row);
      const revealTime = 560 + (wordLength - 1) * 110;
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      revealTimer.current = window.setTimeout(
        () => setRevealRow(null),
        revealTime + 200,
      );
      if (next.status === "won") {
        if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current);
        celebrateTimer.current = window.setTimeout(
          () => setCelebrationRow(row),
          revealTime + 160,
        );
      }
      if (mode === "classic" && next.status !== "active") {
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
        }, revealTime + 480);
      }
    } catch (error) {
      onError(error);
      setShakeRow(row);
      window.setTimeout(() => setShakeRow(null), 520);
    } finally {
      setSending(false);
    }
  }, [
    busy,
    draft,
    finished,
    guesses.length,
    loading,
    mode,
    onError,
    onSubmit,
    sending,
    wordLength,
  ]);

  const pressKey = useCallback(
    (key: string) => {
      if (busy || sending || finished || loading) return;
      hapticImpact("light");
      if (key === "ENTER") {
        void submit();
        return;
      }
      if (key === "BACKSPACE") {
        setDraft((value) => value.slice(0, -1));
        return;
      }
      if (/^[a-z]$/i.test(key))
        setDraft((value) =>
          value.length < wordLength ? `${value}${key.toLowerCase()}` : value,
        );
    },
    [busy, finished, loading, sending, submit, wordLength],
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

  return (
    <section className="game-screen" aria-label="WordSeek game">
      <div className="game-mode-row">
        <div className="mode-switch-wrap">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => {
              if (value) onMode(value as GameMode);
            }}
            className="mode-switch"
            aria-label="Game mode"
          >
            <ToggleGroupItem value="classic">Classic</ToggleGroupItem>
            <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {mode === "daily" ? (
          <Badge variant="secondary" className="daily-streak">
            <Flame size={14} /> {daily?.streak.current ?? 0} day streak
          </Badge>
        ) : (
          <span className="attempt-count">
            {Math.max(0, maxAttempts - guesses.length)} guesses left
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
                disabled={busy || loading}
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
          guesses={guesses}
          draft={draft}
          wordLength={wordLength}
          maxAttempts={maxAttempts}
          loading={waitingForGame}
          revealRow={revealRow}
          celebrationRow={celebrationRow}
          shakeRow={shakeRow}
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
        states={keyboardStates}
        draft={draft}
        wordLength={wordLength}
        disabled={
          loading || busy || sending || (mode === "daily" && !game) || finished
        }
        onKey={pressKey}
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
