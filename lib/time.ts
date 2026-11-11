import { PNG_TIME_ZONE } from "./constants";

/** Form datetime-local values are entered in PNG time (UTC+10). Returns ISO UTC or null when invalid/empty. */
export function pngLocalToIso(value: string | undefined | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+10:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatPngTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-AU", { timeZone: PNG_TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

export function timeAgo(iso: string | Date, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
