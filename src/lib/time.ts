import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
export function dayBounds(now: Date, timezone: string) {
  const date = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const nextDate = formatInTimeZone(addDays(new Date(`${date}T12:00:00Z`), 1), "UTC", "yyyy-MM-dd");
  return { start: fromZonedTime(`${date}T00:00:00`, timezone), end: fromZonedTime(`${nextDate}T00:00:00`, timezone) };
}
