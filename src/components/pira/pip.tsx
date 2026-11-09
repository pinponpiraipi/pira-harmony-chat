import { useRef, useState, useSyncExternalStore } from "react";
import { PictureInPicture2, X } from "lucide-react";

/* Tiny store: which chat is floating in the in-page mini window. */
let current: string | null = null;
const subs = new Set<() => void>();
function setPip(url: string | null) {
  current = url;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

function pipUrl() {
  const u = new URL(window.location.href);
  u.searchParams.set("pip", "1");
  return u.toString();
}

type DocPip = { requestWindow: (o: { width: number; height: number }) => Promise<Window> };

/** Header button: pops the current chat out into a picture-in-picture window. */
export function PipButton() {
  async function open() {
    const url = pipUrl();
    const dp = (window as unknown as { documentPictureInPicture?: DocPip }).documentPictureInPicture;
    if (dp) {
      try {
        const w = await dp.requestWindow({ width: 380, height: 620 });
        w.document.body.style.margin = "0";
        const f = w.document.createElement("iframe");
        f.src = url;
        f.allow = "camera; microphone; autoplay; clipboard-write";
        f.style.cssText = "border:0;width:100vw;height:100vh;display:block";
        w.document.body.appendChild(f);
        return;
      } catch {
        /* fall back to the in-page window */
      }
    }
    setPip(url);
  }
  return (
    <button onClick={() => void open()} aria-label="ピクチャーインピクチャー" className="rounded-full glass-soft p-2 text-foreground">
      <PictureInPicture2 size={16} />
    </button>
  );
}

/** In-page floating chat window (used when the browser has no picture-in-picture for pages). */
export function PipHost() {
  const url = useSyncExternalStore(subscribe, () => current, () => null);
  const [pos, setPos] = useState({ x: 24, y: 80 });
  const start = useRef({ x: 0, y: 0, px: 0, py: 0 });
  if (!url) return null;
  function down(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    const move = (ev: PointerEvent) =>
      setPos({
        x: Math.max(0, start.current.px + ev.clientX - start.current.x),
        y: Math.max(0, start.current.py + ev.clientY - start.current.y),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  return (
    <div
      className="fixed z-[90] flex h-[560px] w-[340px] resize flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-border"
      style={{ left: pos.x, top: pos.y }}
    >
      <div onPointerDown={down} className="flex cursor-move touch-none items-center gap-2 bg-muted px-3 py-1.5 text-xs font-bold text-foreground">
        <PictureInPicture2 size={14} /> 小窓トーク
        <button className="ml-auto" aria-label="閉じる" onClick={() => setPip(null)}>
          <X size={14} />
        </button>
      </div>
      <iframe src={url} title="小窓トーク" className="min-h-0 flex-1 border-0" allow="camera; microphone; autoplay" />
    </div>
  );
}
