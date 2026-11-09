import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Settings } from "lucide-react";

export type AppSection = "play" | "settings";

export function BottomNavigation({
  value,
  onChange,
}: {
  value: AppSection;
  onChange: (value: AppSection) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as AppSection)}
      className="glass-nav-wrap"
    >
      <TabsList className={`glass-nav ${value === "settings" ? "at-end" : ""}`}>
        <span className="nav-active-pill" aria-hidden="true" />
        <TabsTrigger value="play">
          <MessageCircle aria-hidden="true" />
          <span>Play</span>
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings aria-hidden="true" />
          <span>Settings</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
