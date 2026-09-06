import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Ban, Trash2, Save, Eye } from "lucide-react";
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
  const { isAdmin, loading } = usePira();
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
