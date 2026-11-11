import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MiniAppClassicState } from "@shared/miniapp";
import { ArrowRight, PartyPopper, RotateCcw, Sparkles } from "lucide-react";

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
      </DialogContent>
    </Dialog>
  );
}
