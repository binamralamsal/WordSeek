import { Skeleton } from "@/components/ui/skeleton";
import type { WordLength } from "@shared/leaderboard";
import type { MiniAppGuess } from "@shared/miniapp";
import { CircleX, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

type PendingGuess = {
  id: number;
  guess: string;
  status: "queued" | "checking" | "error";
  error?: string;
};

export function GameBoard({
  guesses,
  draft,
  wordLength,
  maxAttempts,
  loading,
  pendingGuesses,
  revealRows,
  celebrationRows,
  finished,
}: {
  guesses: MiniAppGuess[];
  draft: string;
  wordLength: WordLength;
  maxAttempts: number;
  loading: boolean;
  pendingGuesses: PendingGuess[];
  revealRows: number[];
  celebrationRows: number[];
  finished: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const lastRowCount = useRef(guesses.length + pendingGuesses.length);
  const hasMounted = useRef(false);
  const activeRowIndex = guesses.length + pendingGuesses.length;
  const occupiedRows = activeRowIndex + (finished ? 0 : 1);
  const visibleCount = Math.min(
    maxAttempts,
    maxAttempts === 6 ? maxAttempts : Math.max(6, occupiedRows + 2),
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    const row = activeRowRef.current;
    const rowCount = guesses.length + pendingGuesses.length;
    const hasNewRow = rowCount > lastRowCount.current;
    const shouldRevealActiveRow = !hasMounted.current || hasNewRow;
    hasMounted.current = true;
    lastRowCount.current = rowCount;
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
  }, [guesses.length, pendingGuesses.length, wordLength, finished]);

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
              const pendingIndex = row - guesses.length;
              const pending =
                pendingIndex >= 0 ? pendingGuesses[pendingIndex] : undefined;
              const isActive = row === activeRowIndex && !finished;
              const letters =
                turn?.guess ?? pending?.guess ?? (isActive ? draft : "");
              const isRevealing = revealRows.includes(row);
              const isCelebrating = celebrationRows.includes(row);

              return (
                <div
                  className={`word-row ${pending?.status === "error" ? "is-row-error" : ""}`}
                  key={pending ? `pending-${pending.id}` : `row-${row}`}
                  ref={
                    isActive || (finished && row === guesses.length - 1)
                      ? activeRowRef
                      : undefined
                  }
                  aria-label={
                    pending
                      ? `Guess ${row + 1}, ${pending.status}${pending.error ? `: ${pending.error}` : ""}`
                      : `Guess ${row + 1}`
                  }
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
                            isRevealing ? "is-revealing" : "",
                            isCelebrating ? "is-celebrating" : "",
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
                  {pending && (
                    <div
                      className={`guess-row-status is-${pending.status}`}
                      role="status"
                      aria-live="polite"
                    >
                      {pending.status === "checking" ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="is-spinning"
                        />
                      ) : pending.status === "error" ? (
                        <CircleX aria-hidden="true" />
                      ) : null}
                      <span>
                        {pending.status === "checking"
                          ? "Checking word…"
                          : pending.status === "queued"
                            ? "In line"
                            : (pending.error ?? "Could not check this word.")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
}
