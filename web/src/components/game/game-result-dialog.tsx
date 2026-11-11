import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildResultShareText } from "@/lib/share";
import { hapticNotification, shareText } from "@/lib/telegram";
import type { MiniAppClassicState } from "@shared/miniapp";
import {
  ArrowRight,
  Check,
  PartyPopper,
  RotateCcw,
  Share2,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ShareState = "idle" | "shared" | "copied";

export function GameResultDialog({
  open,
  onOpenChange,
  state,
  onPlayAgain,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: NonNullable<MiniAppClassicState>;
  onPlayAgain: () => void;
}) {
  const won = state.status === "won";
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
      const outcome = await shareText(buildResultShareText("classic", state));
      setShareState(outcome);
      hapticNotification("success");
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setShareState("idle"), 2400);
    } catch {
      setShareState("idle");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`classic-result-dialog ${won ? "is-win" : "is-loss"}`}
      >
        <div className="result-dialog-icon">
          {won ? (
            <PartyPopper aria-hidden="true" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
        </div>
        <DialogHeader>
          <span className="section-kicker">
            {state.wordLength}-LETTER CLASSIC
          </span>
          <DialogTitle>{won ? "Brilliant solve!" : "Good effort"}</DialogTitle>
          <DialogDescription>
            {won
              ? `You found ${state.solution?.toUpperCase()} in ${state.guesses.length} ${state.guesses.length === 1 ? "guess" : "guesses"}.`
              : `The word was ${state.solution?.toUpperCase()}. Give it another go?`}
          </DialogDescription>
        </DialogHeader>
        {won && state.score != null && (
          <div className="result-score">
            <span>POINTS EARNED</span>
            <strong>+{state.score}</strong>
          </div>
        )}
        <Button
          className="play-again-button"
          onClick={() => {
            onOpenChange(false);
            onPlayAgain();
          }}
        >
          <RotateCcw aria-hidden="true" /> Play again{" "}
          <ArrowRight aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          className="share-result-dialog"
          onClick={() => void share()}
        >
          {shareState === "idle" ? (
            <>
              <Share2 aria-hidden="true" /> Share result
            </>
          ) : (
            <>
              <Check aria-hidden="true" />
              {shareState === "shared" ? "Shared" : "Copied"}
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
