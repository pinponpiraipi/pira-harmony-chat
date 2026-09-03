import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Users, Plus, Check } from "lucide-react";
import { AppShell } from "@/components/pira/shell";
import { Avatar, GlassPanel, PiraButton, PiraInput } from "@/components/pira/ui";
import { usePira } from "@/lib/pira/session";
import { createGroupChat, listChats, listFriends, type ChatSummary } from "@/lib/pira/db";
import { listTimestamp } from "@/lib/pira/format";
import { supabase } from "@/integrations/supabase/client";
import type { FriendEntry } from "@/lib/pira/types";

export const Route = createFileRoute("/talks")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "トーク一覧｜PIRA" },
      {
        name: "description",
        content: "PIRAのトーク一覧。1対1のトークやグループトークの最新メッセージと未読数を確認できます。",
      },
      { property: "og:title", content: "トーク一覧｜PIRA" },
      { property: "og:description", content: "最新のメッセージと未読をひと目でチェック。" },
    ],
  }),
  component: TalksPage,
});

function TalksPage() {
  const { session } = usePira();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "direct" | "group">("all");
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    setChats(await listChats(session.user.id));
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session) return;
    void listFriends(session.user.id).then(setFriends);
    const channel = supabase
      .channel("talks-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session, load]);

  const shown = chats.filter((c) =>
    filter === "all" ? true : filter === "group" ? c.conversation.is_group : !c.conversation.is_group,
  );

  async function createGroup() {
    if (!session || picked.length === 0) return;
    const id = await createGroupChat(session.user.id, groupName.trim() || "グループ", picked);
    setCreating(false);
    setGroupName("");
    setPicked([]);
    void navigate({ to: "/talk/$id", params: { id } });
  }

  return (
    <AppShell title="トーク">
      <div className="space-y-3">
        <GlassPanel className="flex items-center gap-2 p-2">
          {(
            [
              ["all", "すべて"],
              ["direct", "友だち"],
              ["group", "グループ"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === id ? "bg-primary text-primary-foreground" : "glass-soft text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
          <PiraButton className="ml-auto" onClick={() => setCreating(true)}>
            <Plus size={14} /> グループ作成
          </PiraButton>
        </GlassPanel>

        <GlassPanel className="p-2">
          {shown.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground">まだトークがありません。</p>
          )}
          {shown.map((c) => {
            const other = c.otherProfiles[0];
            const title = c.conversation.is_group
              ? c.conversation.name || "グループ"
              : (other?.display_name ?? "不明なユーザー");
            const last = c.lastMessage;
            return (
              <Link
                key={c.conversation.id}
                to="/talk/$id"
                params={{ id: c.conversation.id }}
                className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
              >
                {c.conversation.is_group ? (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full glass-soft">
                    <Users size={18} />
                  </span>
                ) : (
                  <Avatar path={other?.avatar_url} name={title} size={48} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {last
                      ? last.deleted_at
                        ? "メッセージの送信を取り消しました"
                        : last.kind === "text"
                          ? last.body
                          : last.kind === "sticker"
                            ? "スタンプ"
                            : last.kind === "video"
                              ? "動画"
                              : "写真"
                      : "トークを始めましょう"}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {last ? listTimestamp(last.created_at) : ""}
                  </span>
                  {c.unread > 0 && (
                    <span className="rounded-full bg-primary px-2 text-[10px] font-bold text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </GlassPanel>
      </div>

      {creating && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <GlassPanel className="w-full max-w-sm p-4">
            <p className="text-sm font-bold text-foreground">グループを作る</p>
            <PiraInput
              className="mt-3"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="グループ名"
            />
            <div className="pira-scroll mt-3 max-h-64 space-y-1 overflow-y-auto">
              {friends
                .filter((f) => !f.blocked)
                .map((f) => {
                  const on = picked.includes(f.friend_id);
                  return (
                    <button
                      key={f.id}
                      onClick={() =>
                        setPicked(on ? picked.filter((x) => x !== f.friend_id) : [...picked, f.friend_id])
                      }
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-muted"
                    >
                      <Avatar path={f.profile.avatar_url} name={f.profile.display_name} size={36} />
                      <span className="flex-1 truncate text-sm text-foreground">
                        {f.nickname || f.profile.display_name}
                      </span>
                      {on && <Check size={16} className="text-primary" />}
                    </button>
                  );
                })}
              {friends.length === 0 && (
                <p className="text-xs text-muted-foreground">招待できる友だちがいません。</p>
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <PiraButton variant="ghost" onClick={() => setCreating(false)}>
                やめる
              </PiraButton>
              <PiraButton disabled={picked.length === 0} onClick={() => void createGroup()}>
                作成
              </PiraButton>
            </div>
          </GlassPanel>
        </div>
      )}
    </AppShell>
  );
}
