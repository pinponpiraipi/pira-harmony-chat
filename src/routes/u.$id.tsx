import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, UserPlus, Ban } from "lucide-react";
import { AppShell } from "@/components/pira/shell";
import { Avatar, GlassPanel, PiraButton, StoredImage } from "@/components/pira/ui";
import { usePira } from "@/lib/pira/session";
import {
  addFriend,
  getOrCreateDirectChat,
  getProfile,
  listFriends,
  updateFriend,
} from "@/lib/pira/db";
import type { FriendEntry, Profile } from "@/lib/pira/types";

export const Route = createFileRoute("/u/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "プロフィール｜PIRA" },
      {
        name: "description",
        content: "PIRAのプロフィール画面。ステータスメッセージや背景を見て、友だち追加やトークを開始できます。",
      },
      { property: "og:title", content: "プロフィール｜PIRA" },
      { property: "og:description", content: "友だちのプロフィールをチェックしてトークを始めよう。" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = Route.useParams();
  const { session } = usePira();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friend, setFriend] = useState<FriendEntry | null>(null);

  useEffect(() => {
    void getProfile(id).then(setProfile);
  }, [id]);

  useEffect(() => {
    if (!session) return;
    void listFriends(session.user.id).then((list) => {
      setFriend(list.find((f) => f.friend_id === id) ?? null);
    });
  }, [session, id]);

  async function openTalk() {
    if (!session) return;
    const chatId = await getOrCreateDirectChat(session.user.id, id);
    void navigate({ to: "/talk/$id", params: { id: chatId } });
  }

  if (!profile) {
    return (
      <AppShell title="プロフィール">
        <GlassPanel className="p-6 text-sm text-muted-foreground">読み込み中…</GlassPanel>
      </AppShell>
    );
  }

  return (
    <AppShell title={profile.display_name}>
      <GlassPanel className="overflow-hidden">
        <div className="h-36 w-full bg-muted">
          {profile.cover_url && (
            <StoredImage path={profile.cover_url} alt="背景画像" className="h-36 w-full object-cover" />
          )}
        </div>
        <div className="-mt-8 flex flex-col items-center px-4 pb-4">
          <Avatar path={profile.avatar_url} name={profile.display_name} size={72} />
          <h1 className="mt-2 text-lg font-bold text-foreground">
            {friend?.nickname || profile.display_name}
          </h1>
          <p className="text-xs text-muted-foreground">@{profile.username}</p>
          {profile.status_message && (
            <p className="mt-2 text-center text-sm text-foreground">{profile.status_message}</p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <PiraButton onClick={() => void openTalk()}>
              <MessageCircle size={14} /> トーク
            </PiraButton>
            {!friend && session && (
              <PiraButton
                variant="soft"
                onClick={() => void addFriend(session.user.id, id).then(() => location.reload())}
              >
                <UserPlus size={14} /> 友だち追加
              </PiraButton>
            )}
            {friend && (
              <PiraButton
                variant="danger"
                onClick={() =>
                  void updateFriend(friend.id, { blocked: !friend.blocked }).then(() =>
                    setFriend({ ...friend, blocked: !friend.blocked }),
                  )
                }
              >
                <Ban size={14} /> {friend.blocked ? "ブロック解除" : "ブロック"}
              </PiraButton>
            )}
          </div>
        </div>
      </GlassPanel>
    </AppShell>
  );
}
