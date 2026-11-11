import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CircleHelp } from "lucide-react";
import { useState } from "react";

const hints = [
  { state: "correct", title: "Right letter, right place" },
  { state: "present", title: "Right letter, different place" },
  { state: "absent", title: "Letter is not in the word" },
];

export function GameHelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="game-help-trigger"
        onClick={() => setOpen(true)}
        aria-label="How to play and read hints"
        title="How to play"
      >
        <CircleHelp aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="game-help-dialog">
          <DialogHeader>
            <span className="section-kicker">QUICK GUIDE</span>
            <DialogTitle>How to play</DialogTitle>
            <DialogDescription>
              Find the hidden word. Each color tells you what your guess found.
            </DialogDescription>
          </DialogHeader>
          <div className="help-hint-list">
            {hints.map((hint) => (
              <div className="help-hint" key={hint.state}>
                <span className={`help-swatch is-${hint.state}`}>A</span>
                <span>{hint.title}</span>
              </div>
            ))}
          </div>
          <p className="game-help-tip">
            Press Enter to submit and Backspace to edit. Daily gives you six
            tries for today’s word. Classic lets you practise any 4, 5 or
            6-letter word with up to 30 guesses.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
