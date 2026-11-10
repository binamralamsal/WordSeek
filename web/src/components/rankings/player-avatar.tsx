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
  const imageUrl = url?.startsWith("telegram-file:")
    ? `/api/avatar/${encodeURIComponent(url.slice("telegram-file:".length))}`
    : (url ?? undefined);

  return (
    <Avatar className={`player-avatar ${className}`}>
      <AvatarImage src={imageUrl} alt="" />
      <AvatarFallback>
        {name.trim().slice(0, 1).toUpperCase() || "W"}
      </AvatarFallback>
    </Avatar>
  );
}
