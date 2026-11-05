import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel, PiraButton, PiraInput, StoredImage, StoredVideo } from "@/components/pira/ui";
import { resolveMedia } from "@/lib/pira/media";
import type { Message } from "@/lib/pira/types";

export type PollData = { q: string; options: string[] };

export function parsePoll(body: string | null): PollData | null {
  try {
    const d = JSON.parse(body ?? "") as PollData;
    return d && Array.isArray(d.options) ? d : null;
  } catch {
    return null;
  }
}

type Vote = { message_id: string; user_id: string; option_index: number };

/** Poll bubble with live vote counts. */
export function PollView({ message, userId }: { message: Message; userId: string }) {
  const poll = parsePoll(message.body);
  const [votes, setVotes] = useState<Vote[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("poll_votes").select("message_id,user_id,option_index").eq("message_id", message.id);
      setVotes((data as Vote[]) ?? []);
    };
    void load();
    const ch = supabase
      .channel(`poll-${message.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `message_id=eq.${message.id}` }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [message.id]);
  if (!poll) return <span>投票</span>;
  const mine = votes.find((v) => v.user_id === userId);
  async function vote(i: number) {
    if (mine?.option_index === i) await supabase.from("poll_votes").delete().eq("message_id", message.id).eq("user_id", userId);
    else await supabase.from("poll_votes").upsert({ message_id: message.id, user_id: userId, option_index: i });
    const { data } = await supabase.from("poll_votes").select("message_id,user_id,option_index").eq("message_id", message.id);
    setVotes((data as Vote[]) ?? []);
  }
  return (
    <span className="flex min-w-48 flex-col gap-1 text-left">
      <span className="font-bold">📊 {poll.q}</span>
      {poll.options.map((o, i) => {
        const n = votes.filter((v) => v.option_index === i).length;
        const pct = votes.length ? Math.round((n / votes.length) * 100) : 0;
        return (
          <button
            key={i}
            onClick={() => void vote(i)}
            className={`relative overflow-hidden rounded-lg border px-2 py-1 text-xs ${mine?.option_index === i ? "border-current font-bold" : "border-current/30"}`}
          >
            <span className="absolute inset-y-0 left-0 bg-current opacity-15" style={{ width: `${pct}%` }} />
            <span className="relative flex justify-between gap-2">
              <span>{o}</span>
              <span>{n}</span>
            </span>
          </button>
        );
      })}
      <span className="text-[10px] opacity-70">{votes.length}人が投票</span>
    </span>
  );
}

export function PollComposer({ onSend, onClose }: { onSend: (p: PollData) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const valid = q.trim() && opts.filter((o) => o.trim()).length >= 2;
  return (
    <div className="glass-soft space-y-2 rounded-xl p-3">
      <PiraInput value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} placeholder="質問（例：今度どこ行く？）" />
      {opts.map((o, i) => (
        <PiraInput
          key={i}
          value={o}
          maxLength={50}
          onChange={(e) => setOpts((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
          placeholder={`選択肢 ${i + 1}`}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        {opts.length < 8 && (
          <PiraButton variant="soft" onClick={() => setOpts((c) => [...c, ""])}>
            ＋選択肢
          </PiraButton>
        )}
        <PiraButton
          disabled={!valid}
          onClick={() => onSend({ q: q.trim(), options: opts.map((o) => o.trim()).filter(Boolean) })}
        >
          投票を作成
        </PiraButton>
        <PiraButton variant="ghost" onClick={onClose}>
          やめる
        </PiraButton>
      </div>
    </div>
  );
}

/** Voice message player. */
export function VoiceView({ path }: { path: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    void resolveMedia(path).then(setSrc);
  }, [path]);
  return src ? <audio controls src={src} className="h-10 max-w-60" /> : <span>🎤 読み込み中…</span>;
}

/** Mic button: click to start, click again to send. */
export function VoiceRecorder({ onDone }: { onDone: (blob: Blob) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [sec, setSec] = useState(0);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => {
    if (!rec) return;
    const t = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [rec]);
  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        onDone(new Blob(chunks.current, { type: r.mimeType || "audio/webm" }));
      };
      r.start();
      setSec(0);
      setRec(r);
    } catch {
      alert("マイクを使えませんでした。ブラウザのマイク許可を確認してください。");
    }
  }
  function stop() {
    rec?.stop();
    setRec(null);
  }
  return rec ? (
    <PiraButton variant="danger" onClick={stop}>
      <Square size={14} /> 送信 {sec}秒
    </PiraButton>
  ) : (
    <PiraButton variant="soft" onClick={() => void start()}>
      <Mic size={14} /> ボイス
    </PiraButton>
  );
}

/** Album: all photos/videos sent in this chat. */
export function AlbumView({ messages, onClose }: { messages: Message[]; onClose: () => void }) {
  const media = messages.filter((m) => !m.deleted_at && (m.kind === "image" || m.kind === "video"));
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 px-4">
      <GlassPanel className="w-full max-w-2xl space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">アルバム（{media.length}）</p>
          <PiraButton variant="ghost" onClick={onClose}>
            閉じる
          </PiraButton>
        </div>
        {media.length === 0 && <p className="text-xs text-muted-foreground">まだ写真・動画がありません。</p>}
        <div className="pira-scroll grid max-h-[70vh] grid-cols-3 gap-2 overflow-y-auto">
          {media.map((m) =>
            m.kind === "image" ? (
              <StoredImage key={m.id} path={m.media_url} alt="アルバムの写真" className="aspect-square w-full rounded-lg object-cover" />
            ) : (
              <StoredVideo key={m.id} path={m.media_url} className="aspect-square w-full rounded-lg object-cover" />
            ),
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
