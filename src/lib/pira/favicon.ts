import { PIRA_LOGO_URL } from "./brand";

let normalHref: string | null = null;
let alertHref: string | null = null;
let building = false;

function link() {
  if (typeof document === "undefined") return null;
  let el = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!el) {
    el = document.createElement("link");
    el.rel = "icon";
    document.head.appendChild(el);
  }
  return el;
}

/** Builds a red-tinted copy of the logo so unread messages are visible in the tab. */
async function build() {
  if (alertHref || building) return;
  building = true;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = PIRA_LOGO_URL;
    await img.decode();
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, size * 0.12, size * 0.12, size * 0.76, size * 0.76);
    alertHref = canvas.toDataURL("image/png");
  } catch {
    alertHref = null;
  } finally {
    building = false;
  }
}

/** Turns the tab icon red while there are unread messages. */
export function setUnreadFavicon(unread: boolean) {
  const el = link();
  if (!el) return;
  if (normalHref === null) normalHref = el.getAttribute("href") || "/favicon.png";
  if (!unread) {
    el.href = normalHref;
    return;
  }
  if (!alertHref) {
    void build().then(() => {
      if (alertHref) el.href = alertHref;
      else el.href = normalHref!;
    });
    return;
  }
  el.href = alertHref;
}
