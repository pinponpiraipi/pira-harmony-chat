const TZ = "Asia/Tokyo";

export function jstTime(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  }).format(new Date(iso));
}

export function jstDay(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function jstNowParts() {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: TZ,
    hour12: false,
  });
  return fmt.format(new Date());
}

export function listTimestamp(iso: string) {
  const now = new Date();
  const then = new Date(iso);
  const sameDay =
    new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeZone: TZ }).format(now) ===
    new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeZone: TZ }).format(then);
  if (sameDay) return jstTime(iso);
  const diff = (now.getTime() - then.getTime()) / 86400000;
  if (diff < 2) return "昨日";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: TZ }).format(
    then,
  );
}

/** Age from a birthday string (JST based). */
export function ageFromBirthday(birthday: string) {
  const b = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

export function isBirthdayToday(birthday: string | null) {
  if (!birthday) return false;
  const parts = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: TZ,
  }).format(new Date());
  const b = new Date(birthday);
  const bParts = `${b.getMonth() + 1}/${b.getDate()}`;
  return parts === bParts;
}
