import { Skeleton } from "@/components/ui/skeleton";
import type { WordLength } from "@shared/leaderboard";
import type { MiniAppGuess } from "@shared/miniapp";
import { useEffect, useRef } from "react";

export function GameBoard({
  guesses,
  draft,
  wordLength,
  maxAttempts,
  loading,
  revealRow,
  celebrationRow,
  shakeRow,
  finished,
}: {
  guesses: MiniAppGuess[];
  draft: string;
  wordLength: WordLength;
  maxAttempts: number;
  loading: boolean;
  revealRow: number | null;
  celebrationRow: number | null;
  shakeRow: number | null;
  finished: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const lastGuessCount = useRef(guesses.length);
  const hasMounted = useRef(false);
  const visibleCount = Math.min(
    maxAttempts,
    maxAttempts === 6
      ? maxAttempts
      : Math.max(6, guesses.length + (finished ? 0 : 3)),
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    const row = activeRowRef.current;
    const hasNewGuess = guesses.length > lastGuessCount.current;
    const shouldRevealActiveRow = !hasMounted.current || hasNewGuess;
    hasMounted.current = true;
    lastGuessCount.current = guesses.length;
    if (!viewport || !row || !shouldRevealActiveRow) return;

    const viewportRect = viewport.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    if (rowRect.bottom > viewportRect.bottom - 12) {
      viewport.scrollBy({
        top: rowRect.bottom - viewportRect.bottom + 18,
        behavior: "smooth",
      });
    } else if (rowRect.top < viewportRect.top + 12) {
      viewport.scrollBy({
        top: rowRect.top - viewportRect.top - 18,
        behavior: "smooth",
      });
    }
  }, [guesses.length, wordLength, finished]);

  return (
    <div className="board-viewport" ref={viewportRef}>
      <div className={`word-board length-${wordLength}`}>
        {loading
          ? Array.from({ length: Math.min(maxAttempts, 6) }, (_, row) => (
              <div className="word-row" key={row}>
                {Array.from({ length: wordLength }, (_, col) => (
                  <Skeleton className="word-tile-skeleton" key={col} />
                ))}
              </div>
            ))
          : Array.from({ length: visibleCount }, (_, row) => {
              const turn = guesses[row];
              const isActive = row === guesses.length && !finished;
              const letters = turn?.guess ?? (isActive ? draft : "");

              return (
                <div
                  className={`word-row ${shakeRow === row ? "is-invalid" : ""}`}
                  key={row}
                  ref={
                    isActive || (finished && row === guesses.length - 1)
                      ? activeRowRef
                      : undefined
                  }
                  aria-label={`Guess ${row + 1}`}
                  aria-current={isActive ? "true" : undefined}
                >
                  {Array.from({ length: wordLength }, (_, col) => {
                    const state = turn?.states[col];
                    return (
                      <div
                        className={[
                          "word-tile",
                          letters[col] ? "is-filled" : "",
                          state ? `is-${state}` : "",
                        ].join(" ")}
                        style={
                          {
                            "--tile-index": col,
                            "--tile-delay": `${col * 105}ms`,
                          } as React.CSSProperties
                        }
                        key={col}
                      >
                        <span
                          className={[
                            "word-tile-cube",
                            turn && state ? "is-revealed" : "",
                            revealRow === row ? "is-revealing" : "",
                            celebrationRow === row ? "is-celebrating" : "",
                          ].join(" ")}
                        >
                          <span className="word-tile-face word-tile-front">
                            {letters[col]?.toUpperCase()}
                          </span>
                          <span
                            className={`word-tile-face word-tile-back ${state ? `is-${state}` : ""}`}
                          >
                            {letters[col]?.toUpperCase()}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
      </div>
    </div>
  );
}
