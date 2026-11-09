import { GameBoard } from "@/components/game/game-board";
import { GameKeyboard } from "@/components/game/game-keyboard";
import { GameResultCard } from "@/components/game/game-result-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { hapticImpact } from "@/lib/telegram";
import type { WordLength } from "@shared/leaderboard";
import type { MiniAppClassicState, MiniAppDailyState } from "@shared/miniapp";
import { Flame, Sparkles } from "lucide-react";
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
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [celebrationRow, setCelebrationRow] = useState<number | null>(null);
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const revealTimer = useRef<number | null>(null);
  const celebrateTimer = useRef<number | null>(null);

  useEffect(() => {
    setDraft("");
    setRevealRow(null);
    setCelebrationRow(null);
    setShakeRow(null);
    return () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current);
    };
  }, [mode, length]);

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
          revealTime - 100,
        );
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
                disabled={busy}
              >
                {value}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
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

      {game || waitingForGame ? (
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
            <Button
              variant="outline"
              onClick={() =>
                mode === "classic" ? onNewGame() : window.location.reload()
              }
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {finished && game && (
        <GameResultCard
          kind={mode}
          state={game}
          onNewGame={mode === "classic" ? onNewGame : undefined}
        />
      )}

      <GameKeyboard
        states={keyboardStates}
        draft={draft}
        wordLength={wordLength}
        disabled={loading || busy || sending || !game || finished}
        onKey={pressKey}
      />
    </section>
  );
}
