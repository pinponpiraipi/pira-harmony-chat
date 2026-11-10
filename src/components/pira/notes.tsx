import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, GlassPanel, PiraButton, PiraInput } from "@/components/pira/ui";
import { getOrCreateDirectChat, sendMessage } from "@/lib/pira/db";
import type { FriendEntry, Profile } from "@/lib/pira/types";

type Note = { user_id: string; body: string; mood: string | null; expires_at: string; music_url: string | null };

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
  const [song, setSong] = useState<File | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notes")
      .select("user_id, body, mood, expires_at, music_url")
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
    let music_url = mine?.music_url ?? null;
    if (song) music_url = await uploadMedia(userId, song, fileExt(song));
    await supabase.from("notes").upsert({
      user_id: userId,
      body,
      mood: mood.trim() || null,
      music_url,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });
    setEditing(false);
    setDraft("");
    setSong(null);
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button className="flex w-24 shrink-0 flex-col items-center gap-1" onClick={() => setEditing(true)}>
          <Bubble text={mine ? mine.body : "＋ノート"} mood={mine?.mood} muted={!mine} />
          <Avatar path={me?.avatar_url} name={me?.display_name ?? "P"} size={52} />
          <span className="text-[10px] text-muted-foreground">自分</span>
        </button>
        {friendNotes.map(({ f, n }) => (
          <button key={f.id} className="flex w-24 shrink-0 flex-col items-center gap-1" onClick={() => setOpenFor(f)}>
            <Bubble text={n.body} mood={n.mood} />
            <Avatar path={f.profile.avatar_url} name={f.profile.display_name} size={52} />
            <span className="mt-1 max-w-full truncate text-[10px] text-muted-foreground">
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
            <label className="cursor-pointer rounded-full glass-soft px-3 py-2 text-xs text-foreground">
              🎵 {song ? song.name.slice(0, 14) : mine?.music_url ? "曲を変更" : "今日の曲をアップロード"}
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => setSong(e.target.files?.[0] ?? null)} />
            </label>
            <PiraButton onClick={() => void save()}>シェア</PiraButton>
            {mine && <PiraButton variant="soft" onClick={() => void remove()}>削除</PiraButton>}
            <PiraButton variant="soft" onClick={() => setEditing(false)}>閉じる</PiraButton>
          </div>
        </div>
      )}

      {openFor && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">{openFor.nickname || openFor.profile.display_name} に返信</p>
          {(() => {
            const m = notes.find((x) => x.user_id === openFor.friend_id)?.music_url;
            return m ? <SongPlayer path={m} /> : null;
          })()}
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

function Bubble({ text, mood, muted }: { text: string; mood?: string | null | undefined; muted?: boolean | undefined }) {
  return (
    <span className="flex h-14 w-full flex-col items-center justify-end gap-0.5" title={mood ? `${text} / ${mood}` : text}>
      {mood && (
        <span className="max-w-full truncate rounded-full bg-primary/20 px-1.5 text-[9px] text-foreground">🎵 {mood}</span>
      )}
      <span
        className={`line-clamp-2 max-w-full break-words rounded-2xl bg-card px-2 py-1 text-center text-[10px] leading-tight shadow ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {text}
      </span>
    </span>
  );
}

function SongPlayer({ path }: { path: string }) {
  const url = useMediaUrl(path);
  if (!url) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-foreground">
      🎵 今日の曲
      <audio src={url} controls className="h-8 flex-1" />
    </div>
  );
}
