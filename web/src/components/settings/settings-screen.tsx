import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api-client";
import type { ThemeMode } from "@/lib/telegram-types";
import type { MiniAppUser } from "@shared/miniapp";
import { Check, Moon, Sun, SunMoon, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

export function SettingsScreen({
  user,
  mode,
  onMode,
  onSaved,
}: {
  user?: MiniAppUser;
  mode: ThemeMode;
  onMode: (value: ThemeMode) => void;
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
