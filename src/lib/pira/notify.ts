import type { NotifySettings, QuietWindow } from "./extras";
import { resolveMedia } from "./media";

export const SOUNDS = [
  { id: "pop", label: "ポップ", notes: [880, 1320] },
  { id: "chime", label: "チャイム", notes: [660, 990, 1320] },
  { id: "bell", label: "ベル", notes: [1568] },
  { id: "marimba", label: "マリンバ", notes: [523, 784, 1046] },
  { id: "drop", label: "ドロップ", notes: [1200, 600] },
] as const;

let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Plays a short synthesized notification tone. */
export function playSound(soundId: string, volume = 0.6) {
  const ac = audio();
  if (!ac) return;
  void ac.resume();
  const preset = SOUNDS.find((s) => s.id === soundId) ?? SOUNDS[0];
  preset.notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const start = ac.currentTime + i * 0.09;
    osc.type = soundId === "bell" ? "triangle" : "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(Math.min(1, Math.max(0, volume)) * 0.4, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

let customAudio: HTMLAudioElement | null = null;
let customSrcPath: string | null = null;

/** Plays a sound file the user uploaded from their own computer. */
export async function playCustomSound(path: string, volume = 0.6) {
  if (typeof window === "undefined") return;
  if (customSrcPath !== path || !customAudio) {
    const url = await resolveMedia(path);
    if (!url) return;
    customAudio = new Audio(url);
    customSrcPath = path;
  }
  customAudio.volume = Math.min(1, Math.max(0, volume));
  customAudio.currentTime = 0;
  void customAudio.play().catch(() => undefined);
}

function jstMinutes() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(new Date());
  const [h, m] = parts.split(":").map((n) => Number(n));
  return (h ?? 0) * 60 + (m ?? 0);
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True when the current JST time falls inside one of the quiet windows. */
export function inQuietHours(windows: QuietWindow[], nowMinutes = jstMinutes()) {
  return windows.some((w) => {
    const start = toMinutes(w.start);
    const end = toMinutes(w.end);
    if (start === end) return false;
    return start < end
      ? nowMinutes >= start && nowMinutes < end
      : nowMinutes >= start || nowMinutes < end;
  });
}

export async function requestDesktopPermission() {
  if (typeof Notification === "undefined") return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  return await Notification.requestPermission();
}

/** Sound + desktop notification, honouring the user's settings and quiet hours. */
export function notify(
  settings: NotifySettings,
  title: string,
  body: string,
  globalQuiet: QuietWindow[] = [],
  globalOff = false,
) {
  if (globalOff) return;
  if (!settings.enabled) return;
  if (inQuietHours([...settings.quiet_hours, ...globalQuiet])) return;
  if (settings.sound_url) void playCustomSound(settings.sound_url, settings.volume);
  else playSound(settings.sound, settings.volume);
  if (
    settings.desktop &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    typeof document !== "undefined" &&
    document.visibilityState !== "visible"
  ) {
    new Notification(title, { body, icon: "/favicon.png" });
  }
}
