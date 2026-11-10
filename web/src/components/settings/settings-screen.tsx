import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api-client";
import type {
  InputMethod,
  MiniAppPreferences,
  SizeOption,
} from "@/lib/preferences";
import type { ThemeMode } from "@/lib/telegram-types";
import type { MiniAppUser } from "@shared/miniapp";
import {
  Check,
  Grid3X3,
  Keyboard,
  Moon,
  Smartphone,
  Sun,
  SunMoon,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";

export function SettingsScreen({
  user,
  mode,
  preferences,
  onMode,
  onPreferences,
  onSaved,
}: {
  user?: MiniAppUser;
  mode: ThemeMode;
  preferences: MiniAppPreferences;
  onMode: (value: ThemeMode) => void;
  onPreferences: (value: MiniAppPreferences) => void;
  onSaved: (user: MiniAppUser) => void;
}) {
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNickname(user?.nickname ?? "");
  }, [user?.nickname]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const result = await api<{ user: MiniAppUser }>("/profile", {
        method: "PATCH",
        body: JSON.stringify({ nickname }),
      });
      onSaved(result.user);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (issue) {
      setError((issue as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="subpage settings-page">
      <div className="page-heading">
        <div>
          <span className="section-kicker">MAKE IT YOURS</span>
          <h1>Settings</h1>
        </div>
        <div className="heading-icon">
          <SunMoon />
        </div>
      </div>
      <Card className="settings-card">
        <CardContent>
          <div className="settings-section-heading">
            <span className="settings-icon">
              <SunMoon />
            </span>
            <div>
              <b>Appearance</b>
              <p>Follow Telegram or choose your own look.</p>
            </div>
          </div>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => {
              if (value) onMode(value as ThemeMode);
            }}
            className="theme-toggle"
            aria-label="Theme"
          >
            <ToggleGroupItem value="auto">
              <SunMoon /> Auto
            </ToggleGroupItem>
            <ToggleGroupItem value="light">
              <Sun /> Light
            </ToggleGroupItem>
            <ToggleGroupItem value="dark">
              <Moon /> Dark
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>
      <Card className="settings-card game-preferences-card">
        <CardContent>
          <div className="settings-section-heading">
            <span className="settings-icon">
              <Keyboard />
            </span>
            <div>
              <b>Keyboard</b>
              <p>Choose how you enter guesses and set the key size.</p>
            </div>
          </div>
          <ToggleGroup
            type="single"
            value={preferences.inputMethod}
            onValueChange={(value) => {
              if (value)
                onPreferences({
                  ...preferences,
                  inputMethod: value as InputMethod,
                });
            }}
            className="settings-choice-group input-method-choice"
            aria-label="Guess input method"
          >
            <ToggleGroupItem value="onscreen">
              <Keyboard /> On-screen
            </ToggleGroupItem>
            <ToggleGroupItem value="system">
              <Smartphone /> Phone keyboard
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="settings-control-label">Keyboard size</div>
          <SizeChoice
            value={preferences.keyboardSize}
            label="Keyboard size"
            disabled={preferences.inputMethod === "system"}
            onChange={(keyboardSize) =>
              onPreferences({ ...preferences, keyboardSize })
            }
          />
          <div
            className={`keyboard-preview size-${preferences.keyboardSize} ${preferences.inputMethod === "system" ? "is-disabled" : ""}`}
            aria-label={`Keyboard preview, ${preferences.keyboardSize} size`}
          >
            {["QWERTYUIOP", "ASDFGHJKL", "⌅ZXCVBNM⌫"].map((row) => (
              <div className="keyboard-preview-row" key={row}>
                {Array.from(row).map((key, index) => (
                  <span
                    className={
                      key === "⌅" || key === "⌫" ? "preview-command" : ""
                    }
                    key={`${key}-${index}`}
                  >
                    {key}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="settings-preview-caption">
            Used by the on-screen keyboard. Your phone keyboard keeps its native
            size.
          </p>
        </CardContent>
      </Card>
      <Card className="settings-card game-preferences-card">
        <CardContent>
          <div className="settings-section-heading">
            <span className="settings-icon">
              <Grid3X3 />
            </span>
            <div>
              <b>Game tiles</b>
              <p>Adjust the guess boxes to fit your screen.</p>
            </div>
          </div>
          <div className="settings-control-label">Tile size</div>
          <SizeChoice
            value={preferences.tileSize}
            label="Tile size"
            onChange={(tileSize) => onPreferences({ ...preferences, tileSize })}
          />
          <div
            className={`tile-preview size-${preferences.tileSize}`}
            aria-label={`Tile preview, ${preferences.tileSize} size`}
          >
            {["W", "O", "R", "D", "S"].map((letter, index) => (
              <span
                className={
                  index === 0
                    ? "tile-preview-correct"
                    : index === 2
                      ? "tile-preview-present"
                      : ""
                }
                key={letter}
              >
                {letter}
              </span>
            ))}
          </div>
          <p className="settings-preview-caption">
            Preview updates immediately and applies to the game board.
          </p>
        </CardContent>
      </Card>
      <Card className="settings-card nickname-card">
        <CardContent>
          <div className="settings-section-heading">
            <span className="settings-icon">
              <UserRound />
            </span>
            <div>
              <b>Player nickname</b>
              <p>Shown on your profile and leaderboard.</p>
            </div>
          </div>
          <label className="nickname-label" htmlFor="nickname">
            Nickname
          </label>
          <input
            id="nickname"
            className="nickname-input"
            value={nickname}
            minLength={3}
            maxLength={20}
            autoComplete="nickname"
            onChange={(event) => {
              setNickname(event.target.value);
              setSaved(false);
            }}
            placeholder="3–20 characters"
          />
          <div className="nickname-meta">
            <span>Letters, numbers, spaces, _ and -</span>
            <span>{nickname.length}/20</span>
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button
            className="save-nickname"
            onClick={() => void save()}
            disabled={saving || !user || nickname === (user.nickname ?? "")}
          >
            {saved ? (
              <>
                <Check /> Saved
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save nickname"
            )}
          </Button>
        </CardContent>
      </Card>
      <p className="settings-privacy-note">
        Your Telegram name stays unchanged. WordSeek uses your nickname in game
        rankings.
      </p>
    </section>
  );
}

function SizeChoice({
  value,
  label,
  disabled = false,
  onChange,
}: {
  value: SizeOption;
  label: string;
  disabled?: boolean;
  onChange: (value: SizeOption) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as SizeOption);
      }}
      className="settings-choice-group size-choice"
      aria-label={label}
    >
      <ToggleGroupItem disabled={disabled} value="small">
        Small
      </ToggleGroupItem>
      <ToggleGroupItem disabled={disabled} value="medium">
        Default
      </ToggleGroupItem>
      <ToggleGroupItem disabled={disabled} value="large">
        Large
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
