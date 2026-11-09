import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";

const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function GameKeyboard({
  states,
  draft,
  wordLength,
  disabled,
  onKey,
}: {
  states: Record<string, string>;
  draft: string;
  wordLength: number;
  disabled: boolean;
  onKey: (key: string) => void;
}) {
  return (
    <div className={`keyboard-dock ${disabled ? "is-disabled" : ""}`}>
      <div className="keyboard-caption">
        <span>
          {disabled ? "Puzzle complete" : `${draft.length} / ${wordLength}`}
        </span>
        <span>Enter to submit</span>
      </div>
      {rows.map((row, index) => (
        <div className="key-row" key={row}>
          {index === 2 && (
            <Button
              className="key key-command"
              onClick={() => onKey("ENTER")}
              disabled={disabled}
            >
              Enter
            </Button>
          )}
          {row.split("").map((key) => (
            <button
              className={`key ${states[key] ? `key-${states[key]}` : ""}`}
              onClick={() => onKey(key)}
              disabled={disabled}
              key={key}
            >
              {key}
            </button>
          ))}
          {index === 2 && (
            <Button
              variant="secondary"
              className="key key-command key-delete"
              onClick={() => onKey("BACKSPACE")}
              disabled={disabled}
              aria-label="Delete last letter"
            >
              <Delete />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
