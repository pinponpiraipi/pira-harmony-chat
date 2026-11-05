import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { adminRemoveMember } from "@/lib/pira/admin.functions";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Send, Trash2, Reply, X, Smile, Cake, UserPlus, Users, BarChart3, Images, Timer } from "lucide-react";
import { AlbumView, PollComposer, PollView, VoiceRecorder, VoiceView } from "@/components/pira/talk-extras";
import { AppShell } from "@/components/pira/shell";
import {
  Avatar,
  GlassPanel,
  PiraButton,
  PiraTextarea,
  StoredImage,
  StoredVideo,
} from "@/components/pira/ui";
import { StickerPicker } from "@/components/pira/stickers";
import { CallCenter } from "@/components/pira/call";
import { usePira } from "@/lib/pira/session";
import {
  deleteMessage,
  inviteToGroup,
  listFriends,
  loadConversation,
  markRead,
  sendMessage,
  toggleReaction,
} from "@/lib/pira/db";
import { fileExt, uploadMedia } from "@/lib/pira/media";
import { jstTime } from "@/lib/pira/format";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation, MemberRow, Message, Profile, Reaction } from "@/lib/pira/types";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

export const Route = createFileRoute("/talk/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "トーク｜PIRA" },
      {
        name: "description",
        content:
          "PIRAのトーク画面。テキスト・写真・動画を送って、既読や返信、リアクションでやりとりできます。",
      },
      { property: "og:title", content: "トーク｜PIRA" },
      { property: "og:description", content: "写真・動画・リアクションで楽しくトーク。" },
    ],
  }),
  component: TalkPage,
});

function TalkPage() {
  const { id } = Route.useParams();
  const { session, isAdmin } = usePira();
  const removeMemberFn = useServerFn(adminRemoveMember);
  const [showMembers, setShowMembers] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [timer, setTimer] = useState(0);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const data = await loadConversation(id);
    setConversation(data.conversation);
    setMembers(data.members);
    setProfiles(data.profiles);
    setMessages(data.messages);
    setReactions(data.reactions);
    if (session) {
      const mine = data.members.find((m) => m.user_id === session.user.id);
      if (mine) void markRead(mine.id);
    }
  }, [id, session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`talk-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void load())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const profileOf = (userId: string) => profiles.find((p) => p.id === userId);
  const title = conversation?.is_group
    ? conversation.name || "グループ"
    : (profiles.find((p) => p.id !== session?.user.id)?.display_name ?? "トーク");

  const readCount = (message: Message) =>
    members.filter(
      (m) =>
        m.user_id !== message.sender_id &&
        m.last_read_at !== null &&
        new Date(m.last_read_at) >= new Date(message.created_at),
    ).length;

  const [inviteList, setInviteList] = useState<
    { id: string; name: string; avatar: string | null }[] | null
  >(null);
  const [invitePick, setInvitePick] = useState<string[]>([]);

  async function openInvite() {
    if (!session) return;
    const friends = await listFriends(session.user.id);
    const memberIds = new Set(members.map((m) => m.user_id));
    setInvitePick([]);
    setInviteList(
      friends
        .filter((f) => !f.blocked && !memberIds.has(f.friend_id))
        .map((f) => ({
          id: f.friend_id,
          name: f.nickname || f.profile.display_name,
          avatar: f.profile.avatar_url,
        })),
    );
  }

  async function send() {
    if (!session || !draft.trim() || busy) return;
    setBusy(true);
    try {
      await sendMessage({
        conversationId: id,
        senderId: session.user.id,
        kind: "text",
        body: draft,
        replyTo: replyTo?.id ?? null,
        expiresInSec: timer || null,
      });
      setDraft("");
      setReplyTo(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function sendFile(file: File) {
    if (!session) return;
    setBusy(true);
    try {
      const path = await uploadMedia(session.user.id, file, fileExt(file));
      await sendMessage({
        conversationId: id,
        senderId: session.user.id,
        kind: file.type.startsWith("video") ? "video" : "image",
        mediaUrl: path,
        replyTo: replyTo?.id ?? null,
        expiresInSec: timer || null,
      });
      setReplyTo(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function sendVoice(blob: Blob) {
    if (!session) return;
    setBusy(true);
    try {
      const path = await uploadMedia(session.user.id, blob, "webm");
      await sendMessage({ conversationId: id, senderId: session.user.id, kind: "voice", mediaUrl: path, expiresInSec: timer || null });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function sendPoll(p: { q: string; options: string[] }) {
    if (!session) return;
    await sendMessage({ conversationId: id, senderId: session.user.id, kind: "poll", body: JSON.stringify(p) });
    setShowPoll(false);
    await load();
  }

  async function sendSticker(mediaUrl: string) {
    if (!session || busy) return;
    setBusy(true);
    try {
      await sendMessage({
        conversationId: id,
        senderId: session.user.id,
        kind: "sticker",
        mediaUrl,
        replyTo: replyTo?.id ?? null,
      });
      setReplyTo(null);
      setShowStickers(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title={title}
      right={
        session ? (
          <div className="flex items-center gap-2">
            {conversation?.is_group && (
              <button
                onClick={() => setShowMembers(true)}
                aria-label="メンバー一覧"
                className="rounded-full glass-soft p-2 text-foreground"
              >
                <Users size={16} />
              </button>
            )}
            {conversation?.is_group && (
              <button
                onClick={() => void openInvite()}
                aria-label="メンバーを追加"
                className="rounded-full glass-soft p-2 text-foreground"
              >
                <UserPlus size={16} />
              </button>
            )}
            <CallCenter conversationId={id} />
          </div>
        ) : null
      }
    >
      {conversation?.is_group && (
        <Link to="/g/$id" params={{ id }} className="glass mb-3 flex items-center gap-3 rounded-2xl p-3">
          <Avatar path={conversation.icon_url} name={conversation.name || "グ"} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-foreground">{conversation.name || "グループ"}</span>
            {(conversation as { description?: string | null }).description && (
              <span className="block truncate text-xs text-muted-foreground">
                {(conversation as { description?: string | null }).description}
              </span>
            )}
          </span>
        </Link>
      )}
      {showMembers && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 px-4">
          <GlassPanel className="w-full max-w-sm space-y-2 p-4">
            <p className="text-sm font-bold text-foreground">メンバー {members.length}</p>
            <div className="pira-scroll max-h-72 space-y-1 overflow-y-auto">
              {members.map((m) => {
                const pr = profileOf(m.user_id);
                return (
                  <div key={m.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-foreground">
                    <Link to="/u/$id" params={{ id: m.user_id }} className="flex min-w-0 flex-1 items-center gap-2">
                      <Avatar path={pr?.avatar_url} name={pr?.display_name ?? "?"} size={28} />
                      <span className="truncate">{pr?.display_name ?? "不明"}</span>
                    </Link>
                    {isAdmin && m.user_id !== session?.user.id && (
                      <PiraButton
                        variant="danger"
                        onClick={async () => {
                          try {
                            await removeMemberFn({ data: { conversationId: id, userId: m.user_id } });
                            await load();
                          } catch (err) {
                            alert(err instanceof Error ? err.message : String(err));
                          }
                        }}
                      >
                        <Trash2 size={12} /> 外す
                      </PiraButton>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <PiraButton variant="ghost" onClick={() => setShowMembers(false)}>
                閉じる
              </PiraButton>
            </div>
          </GlassPanel>
        </div>
      )}
      {inviteList && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 px-4">
          <GlassPanel className="w-full max-w-sm space-y-2 p-4">
            <p className="text-sm font-bold text-foreground">メンバーを追加</p>
            {inviteList.length === 0 && (
              <p className="text-xs text-muted-foreground">追加できる友だちがいません。</p>
            )}
            <div className="pira-scroll max-h-72 space-y-1 overflow-y-auto">
              {inviteList.map((f) => (
                <label key={f.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={invitePick.includes(f.id)}
                    onChange={(e) =>
                      setInvitePick((cur) =>
                        e.target.checked ? [...cur, f.id] : cur.filter((x) => x !== f.id),
                      )
                    }
                  />
                  <Avatar path={f.avatar} name={f.name} size={28} />
                  {f.name}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <PiraButton variant="ghost" onClick={() => setInviteList(null)}>
                やめる
              </PiraButton>
              <PiraButton
                disabled={invitePick.length === 0}
                onClick={async () => {
                  await inviteToGroup(id, invitePick);
                  setInviteList(null);
                  await load();
                }}
              >
                追加する
              </PiraButton>
            </div>
          </GlassPanel>
        </div>
      )}
      <div className="space-y-3">
        <GlassPanel className="pira-scroll max-h-[60vh] space-y-3 overflow-y-auto p-3">
          {messages.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              まだメッセージがありません。
            </p>
          )}
          {messages.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > Date.now()).map((m) => {
            const left = m.expires_at ? Math.max(0, Math.ceil((new Date(m.expires_at).getTime() - Date.now()) / 1000)) : null;
            const mine = m.sender_id === session?.user.id;
            const author = profileOf(m.sender_id);
            const parent = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
            const mine_reactions = reactions.filter((r) => r.message_id === m.id);
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && (
                  <Link to="/u/$id" params={{ id: m.sender_id }} aria-label="プロフィールを見る">
                    <Avatar path={author?.avatar_url} name={author?.display_name ?? "?"} size={32} />
                  </Link>
                )}
                <div className={`max-w-[75%] ${mine ? "items-end text-right" : ""} flex flex-col gap-1`}>
                  {!mine && conversation?.is_group && (
                    <span className="text-[10px] text-muted-foreground">{author?.display_name}</span>
                  )}
                  {parent && (
                    <span className="glass-soft rounded-xl px-2 py-1 text-[10px] text-muted-foreground">
                      返信: {parent.deleted_at ? "取り消されたメッセージ" : (parent.body ?? "メディア")}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      mine ? "bg-primary text-primary-foreground" : "glass-soft text-foreground"
                    }`}
                  >
                    {m.deleted_at ? (
                      <span className="italic opacity-70">メッセージの送信を取り消しました</span>
                    ) : m.kind === "image" ? (
                      <StoredImage path={m.media_url} alt="送信された写真" className="max-h-64 rounded-xl" />
                    ) : m.kind === "video" ? (
                      <StoredVideo path={m.media_url} className="max-h-64 rounded-xl" />
                    ) : m.kind === "sticker" ? (
                      <StoredImage
                        path={m.media_url}
                        alt="スタンプ"
                        className="h-28 w-28 object-contain"
                      />
                    ) : m.kind === "voice" ? (
                      <VoiceView path={m.media_url} />
                    ) : m.kind === "poll" && session ? (
                      <PollView message={m} userId={session.user.id} />
                    ) : m.kind === "card" ? (
                      <span className="flex flex-col items-center gap-1">
                        <span className="text-2xl">🎂🎈🎉</span>
                        <span className="text-xs font-bold">お誕生日おめでとう！</span>
                        {m.body && <span>{m.body}</span>}
                      </span>
                    ) : (
                      m.body
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{jstTime(m.created_at)}</span>
                    {left !== null && <span className="text-destructive">⏱{left}秒</span>}
                    {mine && readCount(m) > 0 && <span>既読{readCount(m)}</span>}
                    <button className="hover:text-foreground" onClick={() => setReplyTo(m)}>
                      <Reply size={12} />
                    </button>
                    {mine && !m.deleted_at && (
                      <button
                        className="hover:text-destructive"
                        title="送信取消（相手の画面からも消えます）"
                        onClick={() => confirm("送信を取り消しますか？") && void deleteMessage(m.id).then(load)}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() =>
                          session && void toggleReaction(m.id, session.user.id, e).then(load)
                        }
                        className="hover:scale-110"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  {mine_reactions.length > 0 && (
                    <div className="flex gap-1 text-xs">
                      {EMOJIS.filter((e) => mine_reactions.some((r) => r.emoji === e)).map((e) => (
                        <span key={e} className="glass-soft rounded-full px-2">
                          {e} {mine_reactions.filter((r) => r.emoji === e).length}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </GlassPanel>

        <GlassPanel className="space-y-2 p-3">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">返信中: {replyTo.body ?? "メディア"}</span>
              <button onClick={() => setReplyTo(null)}>
                <X size={12} />
              </button>
            </div>
          )}
          <PiraTextarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="メッセージを入力（Shift+Enterで改行）"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void sendFile(f);
                e.target.value = "";
              }}
            />
            <PiraButton variant="soft" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={14} /> 写真・動画
            </PiraButton>
            <PiraButton variant="soft" onClick={() => setShowStickers((v) => !v)}>
              <Smile size={14} /> スタンプ
            </PiraButton>
            <PiraButton
              variant="soft"
              disabled={busy}
              onClick={async () => {
                if (!session) return;
                setBusy(true);
                try {
                  await sendMessage({
                    conversationId: id,
                    senderId: session.user.id,
                    kind: "card",
                    body: draft.trim() || null,
                  });
                  setDraft("");
                  await load();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Cake size={14} /> お祝いカード
            </PiraButton>
            <VoiceRecorder onDone={(b) => void sendVoice(b)} />
            <PiraButton variant="soft" onClick={() => setShowPoll((v) => !v)}>
              <BarChart3 size={14} /> 投票
            </PiraButton>
            <PiraButton variant="soft" onClick={() => setShowAlbum(true)}>
              <Images size={14} /> アルバム
            </PiraButton>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer size={14} />
              <select
                value={timer}
                onChange={(e) => setTimer(Number(e.target.value))}
                className="rounded-full bg-muted px-2 py-1 text-foreground"
                aria-label="時限メッセージ"
              >
                <option value={0}>消えない</option>
                <option value={10}>10秒で消える</option>
                <option value={60}>1分で消える</option>
                <option value={3600}>1時間で消える</option>
              </select>
            </label>
            <PiraButton
              className="ml-auto"
              disabled={busy || !draft.trim()}
              onClick={() => void send()}
            >
              <Send size={14} /> 送信
            </PiraButton>
          </div>
          {showPoll && <PollComposer onSend={(p) => void sendPoll(p)} onClose={() => setShowPoll(false)} />}
          {showAlbum && <AlbumView messages={messages} onClose={() => setShowAlbum(false)} />}
          {showStickers && (
            <div className="glass-soft rounded-xl">
              <StickerPicker onPick={(s) => void sendSticker(s.media_url)} />
            </div>
          )}
        </GlassPanel>
      </div>
    </AppShell>
  );
}
