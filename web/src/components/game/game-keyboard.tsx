import { Button } from "@/components/ui/button";
import { Delete, Send } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function GameKeyboard({
  inputMethod,
  states,
  draft,
  wordLength,
  disabled,
  processing,
  onKey,
  onInputChange,
}: {
  inputMethod: "onscreen" | "system";
  states: Record<string, string>;
  draft: string;
  wordLength: number;
  disabled: boolean;
  processing: boolean;
  onKey: (key: string, repeated?: boolean) => void;
  onInputChange: (value: string) => void;
}) {
  const repeatStartTimer = useRef<number | null>(null);
  const repeatTimer = useRef<number | null>(null);
  const suppressBackspaceClick = useRef(false);
  const systemInputRef = useRef<HTMLInputElement>(null);
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;

  const stopBackspaceRepeat = useCallback(() => {
    if (repeatStartTimer.current !== null) {
      window.clearTimeout(repeatStartTimer.current);
      repeatStartTimer.current = null;
    }
    if (repeatTimer.current !== null) {
      window.clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (disabled) stopBackspaceRepeat();
    return stopBackspaceRepeat;
  }, [disabled, stopBackspaceRepeat]);

  const startBackspaceRepeat = () => {
    stopBackspaceRepeat();
    suppressBackspaceClick.current = false;
    repeatStartTimer.current = window.setTimeout(() => {
      suppressBackspaceClick.current = true;
      onKeyRef.current("BACKSPACE", true);
      repeatTimer.current = window.setInterval(
        () => onKeyRef.current("BACKSPACE", true),
        75,
      );
    }, 350);
  };

  const finishBackspaceRepeat = () => {
    stopBackspaceRepeat();
  };

  const clickBackspace = () => {
    if (suppressBackspaceClick.current) {
      suppressBackspaceClick.current = false;
      return;
    }
    onKeyRef.current("BACKSPACE");
  };

  if (inputMethod === "system") {
    return (
      <form
        className={`keyboard-dock system-keyboard-dock ${disabled ? "is-disabled" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          systemInputRef.current?.focus({ preventScroll: true });
          onKey("ENTER");
          window.requestAnimationFrame(() =>
            systemInputRef.current?.focus({ preventScroll: true }),
          );
        }}
      >
        <div className="keyboard-caption">
          <span>
            {disabled
              ? "Puzzle complete"
              : processing
                ? "Checking your guess…"
                : `${draft.length} / ${wordLength} letters`}
          </span>
          <span>Phone keyboard</span>
        </div>
        <div className="system-keyboard-row">
          <input
            ref={systemInputRef}
            aria-label="Type your guess"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            disabled={disabled}
            enterKeyHint="send"
            inputMode="text"
            maxLength={wordLength}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Type a word…"
            spellCheck={false}
            value={draft.toUpperCase()}
          />
          <Button
            aria-label="Send guess"
            className="system-submit"
            disabled={disabled || processing}
            onPointerDown={(event) => event.preventDefault()}
            size="icon"
            type="submit"
          >
            <Send aria-hidden="true" />
          </Button>
        </div>
      </form>
    );
  }

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
              aria-label={
                states[key]
                  ? `${key.toUpperCase()}, ${states[key]}`
                  : `Enter ${key.toUpperCase()}`
              }
              title={
                states[key] ? `${key.toUpperCase()}: ${states[key]}` : undefined
              }
              key={key}
            >
              {key}
            </button>
          ))}
          {index === 2 && (
            <Button
              variant="secondary"
              className="key key-command key-delete"
              onClick={clickBackspace}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                startBackspaceRepeat();
              }}
              onPointerUp={finishBackspaceRepeat}
              onPointerCancel={() => {
                finishBackspaceRepeat();
                suppressBackspaceClick.current = false;
              }}
              onLostPointerCapture={finishBackspaceRepeat}
              onContextMenu={(event) => event.preventDefault()}
              disabled={disabled}
              aria-label="Delete last letter"
              title="Hold to delete continuously"
            >
              <Delete />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
