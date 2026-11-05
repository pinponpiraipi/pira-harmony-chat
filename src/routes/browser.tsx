import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Globe, Plus, RotateCw, X } from "lucide-react";
import { AppShell } from "@/components/pira/shell";
import { normalizeInput, proxyUrl, type ProxyRegion } from "@/lib/pira/browser";

export const Route = createFileRoute("/browser")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ブラウザ｜PIRA" },
      { name: "description", content: "PIRAの中でGoogle検索やWebサイトをタブで開けるブラウザ。" },
      { property: "og:title", content: "ブラウザ｜PIRA" },
      { property: "og:description", content: "PIRAの中で検索・Web閲覧。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrowserPage,
});

type Tab = { id: string; entries: string[]; index: number; useProxy: boolean; region: ProxyRegion; reload: number };

const newTab = (url = ""): Tab => ({
  id: crypto.randomUUID(),
  entries: url ? [url] : [],
  index: url ? 0 : -1,
  useProxy: true,
  region: "jp",
  reload: 0,
});

function label(url: string) {
  if (!url) return "新しいタブ";
  try {
    const u = new URL(url);
    return u.searchParams.get("q") ?? u.hostname;
  } catch {
    return url;
  }
}

function BrowserPage() {
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab()]);
  const [activeId, setActiveId] = useState(tabs[0]!.id);
  const [q, setQ] = useState("");
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]!;
  const patch = (id: string, fn: (t: Tab) => Tab) => setTabs((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

  function go(input: string) {
    const url = normalizeInput(input);
    patch(active.id, (t) => {
      const entries = [...t.entries.slice(0, t.index + 1), url];
      return { ...t, entries, index: entries.length - 1 };
    });
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(q);
    setQ("");
  };
  function close(id: string) {
    setTabs((ts) => {
      const rest = ts.filter((t) => t.id !== id);
      const next = rest.length ? rest : [newTab()];
      if (id === activeId) setActiveId(next[next.length - 1]!.id);
      return next;
    });
  }

  const current = active.entries[active.index] ?? "";

  return (
    <AppShell title="ブラウザ">
      <div className="glass flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center gap-1 overflow-x-auto px-2 pt-2">
          {tabs.map((t) => {
            const url = t.entries[t.index] ?? "";
            return (
              <div
                key={t.id}
                className={`flex max-w-44 shrink-0 items-center gap-1 rounded-t-xl px-3 py-1.5 text-xs ${
                  t.id === activeId ? "bg-card text-foreground" : "text-muted-foreground"
                }`}
              >
                <button className="truncate" onClick={() => setActiveId(t.id)}>
                  {label(url)}
                </button>
                <button aria-label="タブを閉じる" onClick={() => close(t.id)}>
                  <X size={12} />
                </button>
              </div>
            );
          })}
          <button
            aria-label="新しいタブ"
            className="rounded-full p-1 text-muted-foreground"
            onClick={() => {
              const t = newTab();
              setTabs((ts) => [...ts, t]);
              setActiveId(t.id);
            }}
          >
            <Plus size={14} />
          </button>
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 bg-card px-2 py-2">
          <button type="button" aria-label="戻る" disabled={active.index <= 0} className="text-muted-foreground disabled:opacity-30" onClick={() => patch(active.id, (t) => ({ ...t, index: t.index - 1 }))}>
            <ArrowLeft size={16} />
          </button>
          <button type="button" aria-label="進む" disabled={active.index >= active.entries.length - 1} className="text-muted-foreground disabled:opacity-30" onClick={() => patch(active.id, (t) => ({ ...t, index: t.index + 1 }))}>
            <ArrowRight size={16} />
          </button>
          <button type="button" aria-label="再読み込み" className="text-muted-foreground" onClick={() => patch(active.id, (t) => ({ ...t, reload: t.reload + 1 }))}>
            <RotateCw size={16} />
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={current || "Google で検索または URL を入力"}
            className="min-w-0 flex-1 rounded-full bg-muted px-4 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <select
            value={active.useProxy ? active.region : "direct"}
            onChange={(e) =>
              patch(active.id, (t) =>
                e.target.value === "direct"
                  ? { ...t, useProxy: false }
                  : { ...t, useProxy: true, region: e.target.value as ProxyRegion },
              )
            }
            className="rounded-full bg-muted px-2 py-1 text-xs text-foreground"
            aria-label="接続方法"
          >
            <option value="jp">中継（日本）</option>
            <option value="intl">中継（海外）</option>
            <option value="direct">直接</option>
          </select>
        </form>
        <div className="relative flex-1 bg-card">
          {tabs.map((t) => {
            const url = t.entries[t.index] ?? "";
            const src = url ? (t.useProxy ? proxyUrl(url, t.region) : url) : "";
            const on = t.id === activeId;
            return (
              <div key={t.id} className="absolute inset-0" style={{ visibility: on ? "visible" : "hidden" }}>
                {src ? (
                  <iframe
                    key={`${src}-${t.reload}`}
                    src={src}
                    title="Webページ"
                    className="h-full w-full border-0 bg-card"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Globe size={40} />
                    <p className="text-sm">上の欄に検索ワードかURLを入力してください</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
