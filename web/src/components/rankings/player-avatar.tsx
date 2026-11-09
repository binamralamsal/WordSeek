import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function PlayerAvatar({
  name,
  url,
  className = "",
}: {
  name: string;
  url: string | null;
  className?: string;
}) {
  return (
    <Avatar className={`player-avatar ${className}`}>
      <AvatarImage src={url ?? undefined} alt="" />
      <AvatarFallback>
        {name.trim().slice(0, 1).toUpperCase() || "W"}
      </AvatarFallback>
    </Avatar>
  );
}
