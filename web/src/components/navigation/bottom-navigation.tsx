import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Settings, Trophy, UserRound } from "lucide-react";

export type AppSection = "play" | "settings";
export type NavigationItem = "game" | "rankings" | "profile" | "settings";

export function BottomNavigation({
  value,
  onChange,
}: {
  value: NavigationItem;
  onChange: (value: NavigationItem) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as NavigationItem)}
      className="glass-nav-wrap"
    >
      <TabsList
        className={`glass-nav at-${value === "game" ? "0" : value === "rankings" ? "1" : value === "profile" ? "2" : "3"}`}
      >
        <span className="nav-active-pill" aria-hidden="true" />
        <TabsTrigger value="game" title="Play WordSeek">
          <MessageCircle aria-hidden="true" />
          <span>Play</span>
        </TabsTrigger>
        <TabsTrigger value="rankings" title="View global rankings">
          <Trophy aria-hidden="true" />
          <span>Ranks</span>
        </TabsTrigger>
        <TabsTrigger value="profile" title="View your profile and ranking">
          <UserRound aria-hidden="true" />
          <span>Profile</span>
        </TabsTrigger>
        <TabsTrigger value="settings" title="Open settings">
          <Settings aria-hidden="true" />
          <span>Settings</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
