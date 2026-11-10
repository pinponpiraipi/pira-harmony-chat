import { useEffect, useSyncExternalStore } from "react";

export type FontChoice = "maru" | "gothic" | "mincho";
const KEY = "pira-font";
const subs = new Set<() => void>();

export function getFont(): FontChoice {
  if (typeof localStorage === "undefined") return "maru";
  const v = localStorage.getItem(KEY);
  return v === "gothic" || v === "mincho" ? v : "maru";
}
export function setFont(f: FontChoice) {
  localStorage.setItem(KEY, f);
  subs.forEach((s) => s());
}
export function useFont() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    getFont,
    () => "maru" as FontChoice,
  );
}

/** Applies the chosen font to the whole app. */
export function FontApplier() {
  const f = useFont();
  useEffect(() => {
    if (f === "maru") document.documentElement.removeAttribute("data-font");
    else document.documentElement.setAttribute("data-font", f);
  }, [f]);
  return null;
}

export function FontPicker() {
  const f = useFont();
  const opts: [FontChoice, string, string][] = [
    ["maru", "丸ゴシック", "'Zen Maru Gothic'"],
    ["gothic", "ゴシック体", "'Noto Sans JP'"],
    ["mincho", "明朝体", "'Noto Serif JP'"],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(([k, l, ff]) => (
        <button
          key={k}
          onClick={() => setFont(k)}
          style={{ fontFamily: ff }}
          className={`rounded-xl px-4 py-2 text-sm ${f === k ? "bg-primary text-primary-foreground" : "glass-soft text-foreground"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
