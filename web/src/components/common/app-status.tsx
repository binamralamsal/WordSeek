import { Button } from "@/components/ui/button";
import { CloudOff, RefreshCw } from "lucide-react";

export function AppError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="app-status" role="alert">
      <div className="app-status-icon">
        <CloudOff aria-hidden="true" />
      </div>
      <span className="section-kicker">WORDSEEK</span>
      <h1>Can’t connect right now</h1>
      <p>{message || "Check your connection and try again."}</p>
      <Button onClick={onRetry}>
        <RefreshCw aria-hidden="true" /> Try again
      </Button>
      <small>
        Open WordSeek from Telegram for the smoothest experience. Your games and
        scores are safe.
      </small>
    </section>
  );
}
