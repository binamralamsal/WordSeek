import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildResultShareText } from "@/lib/share";
import { hapticNotification, shareText } from "@/lib/telegram";
import type { MiniAppClassicState, MiniAppDailyState } from "@shared/miniapp";
import { Check, Flame, Share2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ShareState = "idle" | "shared" | "copied";

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
  const [shareState, setShareState] = useState<ShareState>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const share = async () => {
    try {
      const outcome = await shareText(buildResultShareText(kind, state));
      setShareState(outcome);
      hapticNotification("success");
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setShareState("idle"), 2400);
    } catch {
      setShareState("idle");
    }
  };

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
            {classic?.score != null && (
              <Badge variant="secondary">+{classic.score} pts</Badge>
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
        <div className="completion-actions">
          <Button
            size="sm"
            variant="outline"
            className="share-result"
            onClick={() => void share()}
          >
            {shareState === "idle" ? (
              <>
                <Share2 aria-hidden="true" /> Share
              </>
            ) : (
              <>
                <Check aria-hidden="true" />
                {shareState === "shared" ? "Shared" : "Copied"}
              </>
            )}
          </Button>
          {onNewGame && (
            <Button size="sm" onClick={onNewGame}>
              New game
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
