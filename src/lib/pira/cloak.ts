/** Tab disguise: custom tab title/icon (saved on this device) and about:blank opening. */
export type Cloak = { title: string; icon: string };

const KEY = "pira-cloak";

export const CLOAK_PRESETS: { label: string; title: string; icon: string }[] = [
  { label: "なし", title: "", icon: "" },
  { label: "Google ドキュメント", title: "Google ドキュメント", icon: "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico" },
  { label: "Google ドライブ", title: "マイドライブ - Google ドライブ", icon: "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png" },
  { label: "Google Classroom", title: "Classroom", icon: "https://ssl.gstatic.com/classroom/favicon.png" },
  { label: "Gmail", title: "受信トレイ - Gmail", icon: "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico" },
];

export function getCloak(): Cloak {
  if (typeof localStorage === "undefined") return { title: "", icon: "" };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { title: v.title || "", icon: v.icon || "" };
  } catch {
    return { title: "", icon: "" };
  }
}

export function saveCloak(c: Cloak) {
  localStorage.setItem(KEY, JSON.stringify(c));
  applyCloak();
}

let observer: MutationObserver | null = null;

export function applyCloak() {
  if (typeof document === "undefined") return;
  const c = getCloak();
  if (c.title) {
    if (document.title !== c.title) document.title = c.title;
    if (!observer) {
      observer = new MutationObserver(() => {
        const t = getCloak().title;
        if (t && document.title !== t) document.title = t;
      });
      observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    }
  }
  if (c.icon) {
    let el = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!el) {
      el = document.createElement("link");
      el.rel = "icon";
      document.head.appendChild(el);
    }
    if (el.href !== c.icon) el.href = c.icon;
  }
}

/** Opens the site inside an about:blank tab with the disguised title/icon. */
export function openInBlank(url: string, c: Cloak) {
  const w = window.open("about:blank", "_blank");
  if (!w) return false;
  const d = w.document;
  d.title = c.title || "PIRA";
  if (c.icon) {
    const l = d.createElement("link");
    l.rel = "icon";
    l.href = c.icon;
    d.head.appendChild(l);
  }
  d.body.style.margin = "0";
  const f = d.createElement("iframe");
  f.src = url;
  f.style.cssText = "border:0;width:100vw;height:100vh;display:block";
  f.allow = "camera; microphone; autoplay; clipboard-write; fullscreen";
  d.body.appendChild(f);
  return true;
}
