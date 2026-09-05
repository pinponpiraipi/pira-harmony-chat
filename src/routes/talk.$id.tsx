import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Send, Trash2, Reply, X, Smile, Cake } from "lucide-react";
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
import { usePira } from "@/lib/pira/session";
import {
  deleteMessage,
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
  const { session } = usePira();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
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
      });
      setReplyTo(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title={title}>
      <div className="space-y-3">
        <GlassPanel className="pira-scroll max-h-[60vh] space-y-3 overflow-y-auto p-3">
          {messages.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              まだメッセージがありません。
            </p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === session?.user.id;
            const author = profileOf(m.sender_id);
            const parent = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
            const mine_reactions = reactions.filter((r) => r.message_id === m.id);
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && <Avatar path={author?.avatar_url} name={author?.display_name ?? "?"} size={32} />}
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
                    ) : (
                      m.body
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{jstTime(m.created_at)}</span>
                    {mine && readCount(m) > 0 && <span>既読{readCount(m)}</span>}
                    <button className="hover:text-foreground" onClick={() => setReplyTo(m)}>
                      <Reply size={12} />
                    </button>
                    {mine && !m.deleted_at && (
                      <button
                        className="hover:text-destructive"
                        onClick={() => void deleteMessage(m.id).then(load)}
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
          <div className="flex items-center justify-between">
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
            <PiraButton disabled={busy || !draft.trim()} onClick={() => void send()}>
              <Send size={14} /> 送信
            </PiraButton>
          </div>
        </GlassPanel>
      </div>
    </AppShell>
  );
}
