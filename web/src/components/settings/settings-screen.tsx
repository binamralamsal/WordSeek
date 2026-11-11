import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api-client";
import type {
  InputMethod,
  MiniAppPreferences,
  SizeOption,
} from "@/lib/preferences";
import { MAX_TILE_SIZE, MIN_TILE_SIZE } from "@/lib/preferences";
import type { ThemeMode } from "@/lib/telegram-types";
import type { MiniAppUser } from "@shared/miniapp";
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_RULES,
  validateNickname,
} from "@shared/nickname";
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
import { useEffect, useMemo, useState } from "react";

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

  const nicknameLength = [...nickname].length;
  const validation = useMemo(
    () => (nickname.trim() ? validateNickname(nickname) : null),
    [nickname],
  );
  const nextNickname = validation?.ok ? validation.value : nickname.trim();
  const changed = nextNickname !== (user?.nickname ?? "");
  const canSave = Boolean(user && validation?.ok && changed);
  const hint =
    validation && !validation.ok
      ? validation.message
      : nicknameHint(nicknameLength);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const result = await api<{ user: MiniAppUser }>("/profile", {
        method: "PATCH",
        body: JSON.stringify({ nickname }),
      });
      setNickname(result.user.nickname ?? "");
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
          <div className="tile-size-control">
            <label htmlFor="tile-size-slider">Tile size</label>
            <output htmlFor="tile-size-slider">
              {preferences.tileSize} px
            </output>
          </div>
          <input
            id="tile-size-slider"
            className="tile-size-slider"
            type="range"
            min={MIN_TILE_SIZE}
            max={MAX_TILE_SIZE}
            step={2}
            value={preferences.tileSize}
            aria-label="Game tile size"
            onChange={(event) =>
              onPreferences({
                ...preferences,
                tileSize: Number(event.target.value),
              })
            }
          />
          <div className="tile-size-range-labels" aria-hidden="true">
            <span>Compact</span>
            <span>Roomy</span>
          </div>
          <div
            className="tile-preview"
            aria-label={`Tile preview, ${preferences.tileSize} pixels`}
            style={
              {
                "--preview-tile-size": `${preferences.tileSize}px`,
                "--preview-tile-font": `${Math.max(11, Math.round(preferences.tileSize * 0.42))}px`,
                "--preview-tile-gap": `${Math.max(3, Math.round(preferences.tileSize / 9))}px`,
              } as React.CSSProperties
            }
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
            The preview updates as you drag. Tiles scale down automatically to
            fit smaller screens.
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
            minLength={NICKNAME_MIN_LENGTH}
            maxLength={NICKNAME_MAX_LENGTH}
            autoComplete="nickname"
            aria-invalid={Boolean(validation && !validation.ok)}
            aria-describedby="nickname-help"
            onChange={(event) => {
              setNickname(event.target.value);
              setSaved(false);
              setError("");
            }}
            placeholder={`${NICKNAME_MIN_LENGTH}–${NICKNAME_MAX_LENGTH} characters`}
          />
          <div className="nickname-meta">
            <span
              id="nickname-help"
              className={validation && !validation.ok ? "is-error" : ""}
              role={validation && !validation.ok ? "status" : undefined}
            >
              {hint}
            </span>
            <span
              className={
                nicknameLength > NICKNAME_MAX_LENGTH ? "is-over" : undefined
              }
            >
              {nicknameLength}/{NICKNAME_MAX_LENGTH}
            </span>
          </div>
          <ul className="nickname-rules">
            {NICKNAME_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button
            className="save-nickname"
            onClick={() => void save()}
            disabled={saving || !canSave}
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

function nicknameHint(length: number) {
  if (length === 0)
    return `${NICKNAME_MIN_LENGTH}–${NICKNAME_MAX_LENGTH} characters. Letters, numbers, spaces, . _ -`;
  if (length < NICKNAME_MIN_LENGTH) {
    const remaining = NICKNAME_MIN_LENGTH - length;
    return `Add ${remaining} more ${remaining === 1 ? "character" : "characters"}.`;
  }
  return "Looks good. Save to update your profile and rankings.";
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
