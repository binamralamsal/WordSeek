import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MiniAppClassicState, MiniAppDailyState } from "@shared/miniapp";
import { Flame, Sparkles } from "lucide-react";

export function GameResultCard({
  kind,
  state,
  onNewGame,
}: {
  kind: "daily" | "classic";
  state: Exclude<MiniAppDailyState | MiniAppClassicState, null>;
  onNewGame?: () => void;
}) {
  const won = state.status === "won";
  const daily = kind === "daily" ? (state as MiniAppDailyState) : null;
  const classic =
    kind === "classic" ? (state as NonNullable<MiniAppClassicState>) : null;

  return (
    <Card className={`completion-card ${won ? "is-win" : "is-loss"}`}>
      <CardContent className="completion-content">
        <div className="completion-icon">
          {won ? <Sparkles /> : <span>↗</span>}
        </div>
        <div className="completion-copy">
          <div className="completion-title-row">
            <h2>{won ? "Splendid solve" : "Puzzle complete"}</h2>
            {daily && (
              <Badge variant="secondary">
                <Flame size={13} /> {daily.streak.current} day streak
              </Badge>
            )}
          </div>
          <p>
            {won
              ? `Solved ${state.guesses.length === 1 ? "in 1 guess" : `in ${state.guesses.length} guesses`}.`
              : "The answer was"}
            <strong className="answer-word">
              {" "}
              {state.solution?.toUpperCase()}
            </strong>
            {classic?.score != null && <span> · {classic.score} points</span>}
          </p>
          {daily?.details?.meaning && (
            <p className="word-detail">
              {daily.details.phonetic && <em>{daily.details.phonetic} · </em>}
              {daily.details.meaning}
            </p>
          )}
        </div>
        {onNewGame && (
          <Button size="sm" onClick={onNewGame}>
            New game
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
