import { env } from "#/config/env";

export function getDateStringFromDate(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return fmt.format(d);
}

export function getCurrentGameDateString() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: env.TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;

  const timeInTimezone = new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`,
  );

  let baseDate = timeInTimezone;

  if (timeInTimezone.getHours() < 6) {
    baseDate = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000);
  }

  return getDateStringFromDate(baseDate);
}
