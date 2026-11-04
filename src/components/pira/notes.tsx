import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, GlassPanel, PiraButton, PiraInput } from "@/components/pira/ui";
import { getOrCreateDirectChat, sendMessage } from "@/lib/pira/db";
import type { FriendEntry, Profile } from "@/lib/pira/types";

type Note = { user_id: string; body: string; mood: string | null; expires_at: string };

/** Instagram-style 24h note bubbles shown above friend avatars on the home screen. */
export function NotesBar({
  userId,
  me,
  friends,
}: {
  userId: string;
  me: Profile | null;
  friends: FriendEntry[];
}) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [mood, setMood] = useState("");
  const [openFor, setOpenFor] = useState<FriendEntry | null>(null);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notes")
      .select("user_id, body, mood, expires_at")
      .gt("expires_at", new Date().toISOString());
    setNotes((data as Note[]) ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const mine = notes.find((n) => n.user_id === userId);
  const friendNotes = friends
    .map((f) => ({ f, n: notes.find((n) => n.user_id === f.friend_id) }))
    .filter((x): x is { f: FriendEntry; n: Note } => !!x.n);

  async function save() {
    const body = draft.trim().slice(0, 60);
    if (!body) return;
    await supabase.from("notes").upsert({
      user_id: userId,
      body,
      mood: mood.trim() || null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });
    setEditing(false);
    setDraft("");
    void load();
  }

  async function remove() {
    await supabase.from("notes").delete().eq("user_id", userId);
    void load();
  }

  async function sendReply() {
    if (!openFor || !reply.trim()) return;
    const n = notes.find((x) => x.user_id === openFor.friend_id);
    const id = await getOrCreateDirectChat(userId, openFor.friend_id);
    await sendMessage({
      conversationId: id,
      senderId: userId,
      kind: "text",
      body: `💬 ノート「${n?.body ?? ""}」への返信\n${reply.trim()}`,
    });
    setReply("");
    setOpenFor(null);
    void navigate({ to: "/talk/$id", params: { id }, replace: true });
  }

  return (
    <GlassPanel className="p-3">
      <div className="flex gap-4 overflow-x-auto pb-1 pt-8">
        <button className="relative flex shrink-0 flex-col items-center" onClick={() => setEditing(true)}>
          <Bubble text={mine ? mine.body : "＋ノート"} mood={mine?.mood} muted={!mine} />
          <Avatar path={me?.avatar_url} name={me?.display_name ?? "P"} size={52} />
          <span className="mt-1 text-[10px] text-muted-foreground">自分</span>
        </button>
        {friendNotes.map(({ f, n }) => (
          <button key={f.id} className="relative flex shrink-0 flex-col items-center" onClick={() => setOpenFor(f)}>
            <Bubble text={n.body} mood={n.mood} />
            <Avatar path={f.profile.avatar_url} name={f.profile.display_name} size={52} />
            <span className="mt-1 max-w-16 truncate text-[10px] text-muted-foreground">
              {f.nickname || f.profile.display_name}
            </span>
          </button>
        ))}
      </div>

      {editing && (
        <div className="mt-2 space-y-2">
          <PiraInput value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} placeholder="今の一言（60文字・24時間で消えます）" />
          <PiraInput value={mood} maxLength={30} onChange={(e) => setMood(e.target.value)} placeholder="気分・BGM（任意） 例: 🎵 好きな曲" />
          <div className="flex gap-2">
            <PiraButton onClick={() => void save()}>シェア</PiraButton>
            {mine && <PiraButton variant="soft" onClick={() => void remove()}>削除</PiraButton>}
            <PiraButton variant="soft" onClick={() => setEditing(false)}>閉じる</PiraButton>
          </div>
        </div>
      )}

      {openFor && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">{openFor.nickname || openFor.profile.display_name} に返信</p>
          <div className="flex gap-2">
            <PiraInput value={reply} onChange={(e) => setReply(e.target.value)} placeholder="メッセージを送る" />
            <PiraButton onClick={() => void sendReply()}>送信</PiraButton>
            <PiraButton variant="soft" onClick={() => setOpenFor(null)}>×</PiraButton>
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

function Bubble({ text, mood, muted }: { text: string; mood?: string | null; muted?: boolean }) {
  return (
    <span
      className={`absolute -top-8 left-1/2 z-10 max-w-28 -translate-x-1/2 truncate rounded-2xl bg-card px-2 py-1 text-[10px] shadow ${
        muted ? "text-muted-foreground" : "text-foreground"
      }`}
      title={mood ? `${text} / ${mood}` : text}
    >
      {text}
      {mood && <span className="block truncate text-[9px] text-muted-foreground">{mood}</span>}
    </span>
  );
}
