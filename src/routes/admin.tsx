import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Ban, Trash2, Save, Eye, Plus, KeyRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { adminSetPassword } from "@/lib/pira/admin.functions";
import { shrinkImage, uploadMedia } from "@/lib/pira/media";
import { AppShell } from "@/components/pira/shell";
import { Avatar, GlassPanel, PiraButton, PiraInput } from "@/components/pira/ui";
import { usePira } from "@/lib/pira/session";
import {
  adminDeleteMessage,
  adminDeleteProfile,
  adminListConversations,
  adminListMessages,
  adminListProfiles,
  adminSetBanned,
  adminUpdateProfile,
  getGlobalQuietHours,
  saveGlobalQuietHours,
  type QuietWindow,
} from "@/lib/pira/extras";
import { jstTime } from "@/lib/pira/format";
import type { Conversation, Message, Profile } from "@/lib/pira/types";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "管理者ページ｜PIRA" },
      {
        name: "description",
        content: "PIRAの管理者ページ。アカウントの確認・変更・追放・削除と、すべての会話の確認ができます。",
      },
      { property: "og:title", content: "管理者ページ｜PIRA" },
      { property: "og:description", content: "アカウント管理と会話の確認。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading, session } = usePira();
  const setPasswordFn = useServerFn(adminSetPassword);
  const [quiet, setQuiet] = useState<QuietWindow[]>([]);
  const [qStart, setQStart] = useState("22:00");
  const [qEnd, setQEnd] = useState("07:00");
  const [editPass, setEditPass] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function saveQuiet(next: QuietWindow[]) {
    setQuiet(next);
    try {
      await saveGlobalQuietHours(next);
      setNote("消音時間帯を保存しました。");
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    }
  }

  async function uploadFor(p: Profile, field: "avatar_url" | "cover_url", file: File) {
    if (!session) return;
    try {
      const blob = await shrinkImage(file, field === "avatar_url" ? 512 : 1600, "image/webp", 0.85);
      const path = await uploadMedia(session.user.id, blob, "webp");
      await adminUpdateProfile(p.id, { [field]: path });
      setNote(field === "avatar_url" ? "アイコンを変更しました。" : "背景を変更しました。");
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    }
  }
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const load = useCallback(async () => {
    if (!isAdmin) return;
    const [p, c] = await Promise.all([adminListProfiles(), adminListConversations()]);
    setProfiles(p);
    setConversations(c as Conversation[]);
    setQuiet(await getGlobalQuietHours());
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openConversation(id: string) {
    setOpenChat(id);
    setMessages((await adminListMessages(id)) as Message[]);
  }

  if (loading)
    return (
      <AppShell title="管理者">
        <GlassPanel className="p-6 text-sm text-muted-foreground">読み込み中…</GlassPanel>
      </AppShell>
    );

  if (!isAdmin) {
    return (
      <AppShell title="管理者">
        <GlassPanel className="p-6 text-center text-sm text-muted-foreground">
          このページは管理者専用です。
        </GlassPanel>
      </AppShell>
    );
  }

  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.display_name ?? "不明";

  return (
    <AppShell title="管理者">
      <div className="space-y-3">
        <GlassPanel className="flex items-center gap-2 p-4 text-sm font-bold text-foreground">
          <ShieldAlert size={16} /> 管理者メニュー
        </GlassPanel>
        {note && <GlassPanel className="p-3 text-xs text-foreground">{note}</GlassPanel>}

        <GlassPanel className="space-y-2 p-4">
          <p className="text-sm font-bold text-foreground">全員の消音時間帯（日本時間）</p>
          {quiet.length === 0 && <p className="text-xs text-muted-foreground">設定はありません。</p>}
          {quiet.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-foreground">
              <span className="flex-1">{w.start} 〜 {w.end}</span>
              <button className="text-destructive" aria-label="削除" onClick={() => void saveQuiet(quiet.filter((_, idx) => idx !== i))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <PiraInput type="time" value={qStart} onChange={(e) => setQStart(e.target.value)} />
            <span className="text-foreground">〜</span>
            <PiraInput type="time" value={qEnd} onChange={(e) => setQEnd(e.target.value)} />
            <PiraButton variant="soft" onClick={() => void saveQuiet([...quiet, { start: qStart, end: qEnd }])}>
              <Plus size={14} />
            </PiraButton>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-3 p-4">
          <p className="text-sm font-bold text-foreground">アカウント {profiles.length}</p>
          {profiles.map((p) => (
            <div key={p.id} className="glass-soft space-y-2 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <Avatar path={p.avatar_url} name={p.display_name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {p.display_name}
                    {p.banned && <span className="ml-2 text-xs text-destructive">追放中</span>}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">@{p.username}</p>
                </div>
              </div>
              {editId === p.id ? (
                <div className="space-y-2">
                  <PiraInput
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="表示名"
                  />
                  <PiraInput
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    placeholder="ステータスメッセージ"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(["avatar_url", "cover_url"] as const).map((field) => (
                      <label key={field} className="inline-flex cursor-pointer items-center gap-1 rounded-full glass-soft px-3 py-1.5 text-xs font-semibold text-foreground">
                        {field === "avatar_url" ? "アイコンを変更" : "背景写真を変更"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) void uploadFor(p, field, f);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <PiraInput
                      type="password"
                      value={editPass}
                      onChange={(e) => setEditPass(e.target.value)}
                      placeholder="新しいパスワード（6文字以上）"
                    />
                    <PiraButton
                      variant="soft"
                      disabled={editPass.length < 6}
                      onClick={async () => {
                        try {
                          await setPasswordFn({ data: { userId: p.id, password: editPass } });
                          setEditPass("");
                          setNote("パスワードを変更しました。");
                        } catch (err) {
                          setNote(err instanceof Error ? err.message : "パスワードを変更できませんでした。");
                        }
                      }}
                    >
                      <KeyRound size={14} />
                    </PiraButton>
                  </div>
                  <div className="flex gap-2">
                    <PiraButton
                      onClick={async () => {
                        await adminUpdateProfile(p.id, {
                          display_name: editName.trim() || p.display_name,
                          status_message: editStatus.trim() || null,
                        });
                        setEditId(null);
                        await load();
                      }}
                    >
                      <Save size={14} /> 保存
                    </PiraButton>
                    <PiraButton variant="ghost" onClick={() => setEditId(null)}>
                      やめる
                    </PiraButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <PiraButton
                    variant="soft"
                    onClick={() => {
                      setEditId(p.id);
                      setEditName(p.display_name);
                      setEditStatus(p.status_message ?? "");
                    }}
                  >
                    変更
                  </PiraButton>
                  <PiraButton
                    variant="soft"
                    onClick={() => void adminSetBanned(p.id, !p.banned).then(load)}
                  >
                    <Ban size={14} /> {p.banned ? "追放を解除" : "追放する"}
                  </PiraButton>
                  <PiraButton
                    variant="danger"
                    onClick={() => void adminDeleteProfile(p.id).then(load)}
                  >
                    <Trash2 size={14} /> 削除
                  </PiraButton>
                </div>
              )}
            </div>
          ))}
        </GlassPanel>

        <GlassPanel className="space-y-3 p-4">
          <p className="text-sm font-bold text-foreground">すべての会話 {conversations.length}</p>
          {conversations.map((c) => (
            <div key={c.id} className="glass-soft space-y-2 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {c.is_group ? (c.name || "グループ") : "1対1トーク"}・作成者 {nameOf(c.created_by)}
                </span>
                <PiraButton variant="soft" onClick={() => void openConversation(c.id)}>
                  <Eye size={14} /> 見る
                </PiraButton>
              </div>
              {openChat === c.id && (
                <div className="pira-scroll max-h-64 space-y-1 overflow-y-auto">
                  {messages.length === 0 && (
                    <p className="text-xs text-muted-foreground">メッセージはありません。</p>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className="flex items-start gap-2 text-xs text-foreground">
                      <span className="text-muted-foreground">{jstTime(m.created_at)}</span>
                      <span className="font-semibold">{nameOf(m.sender_id)}</span>
                      <span className="min-w-0 flex-1 break-words">
                        {m.deleted_at
                          ? "（取り消し済み）"
                          : m.kind === "text" || m.kind === "card"
                            ? m.body
                            : m.kind === "sticker"
                              ? "スタンプ"
                              : "写真・動画"}
                      </span>
                      <button
                        className="text-destructive"
                        onClick={async () => {
                          await adminDeleteMessage(m.id);
                          await openConversation(c.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </GlassPanel>
      </div>
    </AppShell>
  );
}
