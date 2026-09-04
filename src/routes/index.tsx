import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Star, EyeOff, Ban, Trash2, MessageCircle, Cake, Users } from "lucide-react";
import { AppShell } from "@/components/pira/shell";
import { Avatar, GlassPanel, PiraButton, PiraInput } from "@/components/pira/ui";
import { usePira } from "@/lib/pira/session";
import {
  getOrCreateDirectChat,
  listChats,
  listFriends,
  removeFriend,
  updateFriend,
  type ChatSummary,
} from "@/lib/pira/db";
import { supabase } from "@/integrations/supabase/client";
import { isBirthdayToday } from "@/lib/pira/format";
import type { FriendEntry } from "@/lib/pira/types";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PIRA｜友だちとトークできるガラス風チャット" },
      {
        name: "description",
        content:
          "PIRAのホーム。友だちリスト、お気に入り、グループ、誕生日のお祝いをまとめてチェックできます。",
      },
      { property: "og:title", content: "PIRA｜友だちとトークできるガラス風チャット" },
      {
        property: "og:description",
        content: "友だち追加・QR交換・グループトーク・スタンプが楽しめるチャットアプリ。",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { session, profile, loading, refresh } = usePira();

  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [groups, setGroups] = useState<ChatSummary[]>([]);
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    const [f, chats] = await Promise.all([listFriends(session.user.id), listChats(session.user.id)]);
    setFriends(f);
    setGroups(chats.filter((c) => c.conversation.is_group));
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setStatus(profile?.status_message ?? "");
  }, [profile?.status_message]);

  async function saveStatus() {
    if (!session) return;
    await supabase
      .from("profiles")
      .update({ status_message: status.trim() || null })
      .eq("id", session.user.id);
    await refresh();
  }

  async function openTalk(friendId: string) {
    if (!session) return;
    const id = await getOrCreateDirectChat(session.user.id, friendId);
    void navigate({ to: "/talk/$id", params: { id } });
  }

  const visible = friends.filter((f) => !f.hidden && !f.blocked);
  const favorites = visible.filter((f) => f.favorite);
  const others = visible.filter((f) => !f.favorite);
  const birthdays = visible.filter((f) => isBirthdayToday(f.profile.birthday));

  return (
    <AppShell>
      <div className="space-y-3">
        <GlassPanel className="p-4">
          <div className="flex items-center gap-3">
            <Link to="/u/$id" params={{ id: session!.user.id }}>
              <Avatar path={profile?.avatar_url} name={profile?.display_name ?? "P"} size={56} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-bold text-foreground">
                {profile?.display_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">@{profile?.username}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <PiraInput
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="ステータスメッセージを入力"
            />
            <PiraButton variant="soft" onClick={() => void saveStatus()}>
              保存
            </PiraButton>
          </div>
        </GlassPanel>

        {birthdays.length > 0 && (
          <GlassPanel className="p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Cake size={16} /> 今日は誕生日の友だちがいます
            </p>
            <div className="mt-2 space-y-2">
              {birthdays.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <Avatar path={f.profile.avatar_url} name={f.profile.display_name} size={32} />
                  <span className="flex-1 truncate text-sm text-foreground">
                    {f.nickname || f.profile.display_name}
                  </span>
                  <PiraButton onClick={() => void openTalk(f.friend_id)}>お祝いする</PiraButton>
                </div>
              ))}
            </div>
          </GlassPanel>
        )}

        {favorites.length > 0 && (
          <Section title={`お気に入り ${favorites.length}`}>
            {favorites.map((f) => (
              <FriendRow
                key={f.id}
                entry={f}
                open={openId === f.id}
                onToggle={() => setOpenId(openId === f.id ? null : f.id)}
                onTalk={() => void openTalk(f.friend_id)}
                onPatch={async (patch) => {
                  await updateFriend(f.id, { ...f, ...patch });
                  await load();
                }}
                onDelete={async () => {
                  await removeFriend(f.id);
                  await load();
                }}
                onRename={() => {
                  setRenameId(f.id);
                  setRenameValue(f.nickname ?? f.profile.display_name);
                }}
              />
            ))}
          </Section>
        )}

        <Section title={`友だち ${others.length}`}>
          {others.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              まだ友だちがいません。「友だち追加」から探してみましょう。
            </p>
          )}
          {others.map((f) => (
            <FriendRow
              key={f.id}
              entry={f}
              open={openId === f.id}
              onToggle={() => setOpenId(openId === f.id ? null : f.id)}
              onTalk={() => void openTalk(f.friend_id)}
              onPatch={async (patch) => {
                await updateFriend(f.id, { ...f, ...patch });
                await load();
              }}
              onDelete={async () => {
                await removeFriend(f.id);
                await load();
              }}
              onRename={() => {
                setRenameId(f.id);
                setRenameValue(f.nickname ?? f.profile.display_name);
              }}
            />
          ))}
        </Section>

        <Section title={`グループ ${groups.length}`}>
          {groups.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              グループはまだありません。トーク画面から作成できます。
            </p>
          )}
          {groups.map((g) => (
            <Link
              key={g.conversation.id}
              to="/talk/$id"
              params={{ id: g.conversation.id }}
              className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full glass-soft">
                <Users size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {g.conversation.name || "グループ"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {g.members.length}人のメンバー
                </span>
              </span>
            </Link>
          ))}
        </Section>
      </div>

      {renameId && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <GlassPanel className="w-full max-w-xs p-4">
            <p className="text-sm font-bold text-foreground">表示名を変更</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              あなたの画面での表示だけが変わります。
            </p>
            <PiraInput
              className="mt-3"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <PiraButton variant="ghost" onClick={() => setRenameId(null)}>
                やめる
              </PiraButton>
              <PiraButton
                onClick={async () => {
                  const target = friends.find((f) => f.id === renameId);
                  if (target) {
                    await updateFriend(target.id, { ...target, nickname: renameValue.trim() || null });
                    await load();
                  }
                  setRenameId(null);
                }}
              >
                保存
              </PiraButton>
            </div>
          </GlassPanel>
        </div>
      )}
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassPanel className="p-3">
      <p className="px-1 pb-1 text-xs font-bold text-muted-foreground">{title}</p>
      <div className="space-y-1">{children}</div>
    </GlassPanel>
  );
}

function FriendRow({
  entry,
  open,
  onToggle,
  onTalk,
  onPatch,
  onDelete,
  onRename,
}: {
  entry: FriendEntry;
  open: boolean;
  onToggle: () => void;
  onTalk: () => void;
  onPatch: (patch: Partial<FriendEntry>) => Promise<void>;
  onDelete: () => Promise<void>;
  onRename: () => void;
}) {
  return (
    <div className="rounded-xl">
      <button onClick={onToggle} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted">
        <Avatar path={entry.profile.avatar_url} name={entry.profile.display_name} size={44} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {entry.nickname || entry.profile.display_name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {entry.profile.status_message ?? `@${entry.profile.username}`}
          </span>
        </span>
        {entry.favorite && <Star size={14} className="text-accent" />}
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 px-2 pb-2">
          <PiraButton onClick={onTalk}>
            <MessageCircle size={14} /> トーク
          </PiraButton>
          <PiraButton variant="soft" onClick={() => void onPatch({ favorite: !entry.favorite })}>
            <Star size={14} /> {entry.favorite ? "お気に入り解除" : "お気に入り"}
          </PiraButton>
          <PiraButton variant="soft" onClick={onRename}>
            表示名の変更
          </PiraButton>
          <PiraButton variant="soft" onClick={() => void onPatch({ hidden: true })}>
            <EyeOff size={14} /> 非表示
          </PiraButton>
          <PiraButton variant="soft" onClick={() => void onPatch({ blocked: true })}>
            <Ban size={14} /> ブロック
          </PiraButton>
          <PiraButton variant="danger" onClick={() => void onDelete()}>
            <Trash2 size={14} /> 削除
          </PiraButton>
        </div>
      )}
    </div>
  );
}
