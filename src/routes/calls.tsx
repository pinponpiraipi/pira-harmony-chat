import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video, FileAudio } from "lucide-react";
import { AppShell } from "@/components/pira/shell";
import { Avatar, GlassPanel } from "@/components/pira/ui";
import { useCall } from "@/components/pira/call";
import { usePira } from "@/lib/pira/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/calls")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "通話履歴｜PIRA" },
      { name: "description", content: "着信・発信・不在着信を相手やグループごとに確認して、履歴から折り返せます。" },
      { property: "og:title", content: "通話履歴｜PIRA" },
      { property: "og:description", content: "PIRAの通話履歴。相手ごとに確認してすぐ折り返し。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CallsPage,
});

type Log = {
  id: string;
  conversation_id: string;
  caller_id: string;
  mode: string;
  status: string;
  duration_sec: number;
  created_at: string;
};
type Party = { title: string; avatar: string | null; isGroup: boolean };

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function CallsPage() {
  const { session } = usePira();
  const call = useCall();
  const me = session?.user.id;
  const [logs, setLogs] = useState<Log[]>([]);
  const [parties, setParties] = useState<Record<string, Party>>({});
  const [filter, setFilter] = useState<string>("all");
  const [kind, setKind] = useState<"all" | "missed">("all");

  useEffect(() => {
    if (!me) return;
    void (async () => {
      const { data } = await supabase
        .from("call_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      const rows = (data ?? []) as Log[];
      const cids = [...new Set(rows.map((r) => r.conversation_id))];
      const map: Record<string, Party> = {};
      if (cids.length) {
        const [{ data: convs }, { data: mems }] = await Promise.all([
          supabase.from("conversations").select("id, is_group, name, icon_url").in("id", cids),
          supabase.from("conversation_members").select("conversation_id, user_id").in("conversation_id", cids),
        ]);
        const others = [...new Set((mems ?? []).filter((m) => m.user_id !== me).map((m) => m.user_id))];
        const { data: profs } = others.length
          ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", others)
          : { data: [] };
        (convs ?? []).forEach((c) => {
          if (c.is_group) map[c.id] = { title: c.name || "グループ", avatar: c.icon_url, isGroup: true };
          else {
            const o = (mems ?? []).find((m) => m.conversation_id === c.id && m.user_id !== me);
            const p = (profs ?? []).find((x) => x.id === o?.user_id);
            map[c.id] = { title: p?.display_name ?? "不明", avatar: p?.avatar_url ?? null, isGroup: false };
          }
        });
      }
      setParties(map);
      setLogs(rows);
    })();
  }, [me]);

  const shown = useMemo(
    () =>
      logs.filter(
        (l) =>
          (filter === "all" || l.conversation_id === filter) &&
          (kind === "all" || (l.caller_id !== me && l.status !== "answered")),
      ),
    [logs, filter, kind, me],
  );
  const convIds = useMemo(() => [...new Set(logs.map((l) => l.conversation_id))], [logs]);

  return (
    <AppShell title="通話履歴">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {(["all", "missed"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                kind === k ? "bg-primary text-primary-foreground" : "glass-soft text-foreground"
              }`}
            >
              {k === "all" ? "すべて" : "不在着信"}
            </button>
          ))}
          <Link to="/recordings" className="ml-auto inline-flex items-center gap-1 rounded-full glass-soft px-3 py-1.5 text-xs font-semibold text-foreground">
            <FileAudio size={12} /> 録音の文字起こし
          </Link>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${filter === "all" ? "bg-primary text-primary-foreground" : "glass-soft text-foreground"}`}
          >
            全員
          </button>
          {convIds.map((cid) => (
            <button
              key={cid}
              onClick={() => setFilter(cid)}
              className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs ${filter === cid ? "bg-primary text-primary-foreground" : "glass-soft text-foreground"}`}
            >
              <Avatar path={parties[cid]?.avatar} name={parties[cid]?.title ?? "?"} size={20} />
              {parties[cid]?.title ?? "…"}
            </button>
          ))}
        </div>

        <GlassPanel className="divide-y divide-border/40">
          {shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">通話履歴はまだありません</p>}
          {shown.map((l) => {
            const p = parties[l.conversation_id];
            const out = l.caller_id === me;
            const missed = !out && l.status !== "answered";
            const Icon = out ? PhoneOutgoing : missed ? PhoneMissed : PhoneIncoming;
            const label = out
              ? l.status === "answered" ? "発信" : "発信（応答なし）"
              : missed ? (l.status === "declined" ? "着信（拒否）" : "不在着信") : "着信";
            return (
              <div key={l.id} className="flex items-center gap-3 p-3">
                <Avatar path={p?.avatar} name={p?.title ?? "?"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${missed ? "text-destructive" : "text-foreground"}`}>
                    {p?.title ?? "…"}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon size={12} /> {l.mode === "video" ? "ビデオ" : "音声"}・{label}
                    {l.duration_sec > 0 && ` ・${fmtDur(l.duration_sec)}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button aria-label="音声で折り返す" onClick={() => call?.start(l.conversation_id, "audio")} className="rounded-full glass-soft p-2 text-foreground">
                  <Phone size={16} />
                </button>
                <button aria-label="ビデオで折り返す" onClick={() => call?.start(l.conversation_id, "video")} className="rounded-full glass-soft p-2 text-foreground">
                  <Video size={16} />
                </button>
              </div>
            );
          })}
        </GlassPanel>
      </div>
    </AppShell>
  );
}
