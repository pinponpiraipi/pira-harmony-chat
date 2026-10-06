/** Tab look (two modes) + opening PIRA inside an about:blank tab. */
import { PIRA_LOGO_URL } from "./brand";

export type TabMode = "defense" | "pira";
const MODE_KEY = "pira-tab-mode";
const CHOSEN_KEY = "pira-tab-chosen";

export function getTabMode(): TabMode {
  if (typeof localStorage === "undefined") return "pira";
  return localStorage.getItem(MODE_KEY) === "defense" ? "defense" : "pira";
}

export function setTabMode(m: TabMode) {
  localStorage.setItem(MODE_KEY, m);
  sessionStorage.setItem(CHOSEN_KEY, "1");
  void applyTab(lastCount);
}

/** True when this page view still needs the mode chooser. */
export function needsModeChoice() {
  if (typeof window === "undefined") return false;
  return !sessionStorage.getItem(CHOSEN_KEY) && !inBlankFrame();
}

export function inBlankFrame() {
  try {
    return window.top !== window && window.parent.location.href === "about:blank";
  } catch {
    return false;
  }
}

/** The document whose tab we decorate (the about:blank wrapper when inside one). */
function targetDoc(): Document {
  try {
    if (window.top !== window && window.parent.document) return window.parent.document;
  } catch {
    /* cross-origin parent */
  }
  return document;
}

let lastCount = 0;
let piraImg: Promise<HTMLImageElement | null> | null = null;

function loadPira() {
  if (!piraImg) {
    piraImg = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = PIRA_LOGO_URL;
    });
  }
  return piraImg;
}

function drawDoc(ctx: CanvasRenderingContext2D, s: number, color: string, slide: boolean) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(s * 0.18, s * 0.06, s * 0.64, s * 0.88, s * 0.08);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  if (slide) {
    ctx.fillRect(s * 0.3, s * 0.38, s * 0.4, s * 0.26);
  } else {
    for (let i = 0; i < 4; i++) ctx.fillRect(s * 0.3, s * (0.32 + i * 0.13), s * 0.4, s * 0.06);
  }
}

async function buildIcon(mode: TabMode, count: number) {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  if (mode === "defense") {
    if (count > 0) drawDoc(ctx, s, "#f4b400", true);
    else drawDoc(ctx, s, "#4285f4", false);
  } else {
    if (count > 0) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const img = await loadPira();
    if (img) ctx.drawImage(img, s * 0.1, s * 0.1, s * 0.8, s * 0.8);
  }
  if (count > 0) {
    const label = count > 99 ? "99+" : String(count);
    const r = s * 0.24;
    ctx.fillStyle = "#e11d48";
    ctx.beginPath();
    ctx.arc(s - r, s - r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${label.length > 2 ? 16 : 22}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, s - r, s - r + 1);
  }
  try {
    return c.toDataURL("image/png");
  } catch {
    return "/favicon.png";
  }
}

function titleFor(mode: TabMode, count: number) {
  if (mode === "defense") return count > 0 ? "Google スライド" : "Google ドキュメント";
  return count > 0 ? "PIRA:通知来たよ" : "PIRA";
}

let observer: MutationObserver | null = null;

export async function applyTab(count: number) {
  if (typeof document === "undefined") return;
  lastCount = count;
  const mode = getTabMode();
  const docs = new Set([document, targetDoc()]);
  const title = titleFor(mode, count);
  const href = await buildIcon(mode, count);
  for (const d of docs) {
    if (d.title !== title) d.title = title;
    d.querySelectorAll("link[rel~='icon']").forEach((el, i) => i > 0 && el.remove());
    let el = d.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!el) {
      el = d.createElement("link");
      el.rel = "icon";
      d.head.appendChild(el);
    }
    el.href = href;
  }
  if (!observer) {
    observer = new MutationObserver(() => {
      const t = titleFor(getTabMode(), lastCount);
      if (document.title !== t) document.title = t;
    });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
  }
}

/** Opens PIRA inside an about:blank tab and moves this tab away. Needs a click. */
export function openInBlank(url: string, leaveOriginal = true) {
  const w = window.open("about:blank", "_blank");
  if (!w) return false;
  const d = w.document;
  d.title = titleFor(getTabMode(), lastCount);
  d.body.style.margin = "0";
  const f = d.createElement("iframe");
  f.src = url;
  f.style.cssText = "border:0;width:100vw;height:100vh;display:block";
  f.allow = "camera; microphone; autoplay; clipboard-write; fullscreen; notifications";
  d.body.appendChild(f);
  if (leaveOriginal) window.location.replace("https://www.google.com");
  return true;
}
