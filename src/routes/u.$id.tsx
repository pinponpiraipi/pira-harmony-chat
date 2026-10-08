import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, UserPlus, Ban, Phone, Video, X } from "lucide-react";
import { useCall } from "@/components/pira/call";
import { AppShell } from "@/components/pira/shell";
import { Avatar, GlassPanel, StoredImage } from "@/components/pira/ui";
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
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = Route.useParams();
  const { session } = usePira();
  const navigate = useNavigate();
  const call = useCall();
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
    void navigate({ to: "/talk/$id", params: { id: chatId }, replace: true });
  }

  if (!profile) {
    return (
      <AppShell title="プロフィール">
        <GlassPanel className="p-6 text-sm text-muted-foreground">読み込み中…</GlassPanel>
      </AppShell>
    );
  }

  async function startCall(mode: "audio" | "video") {
    if (!session) return;
    const chatId = await getOrCreateDirectChat(session.user.id, id);
    call?.start(chatId, mode);
  }

  const name = friend?.nickname || profile.display_name;
  const actions: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [
    { label: "トーク", icon: <MessageCircle size={20} />, onClick: () => void openTalk() },
    { label: "音声通話", icon: <Phone size={20} />, onClick: () => void startCall("audio") },
    { label: "ビデオ通話", icon: <Video size={20} />, onClick: () => void startCall("video") },
  ];
  if (!friend && session)
    actions.push({
      label: "友だち追加",
      icon: <UserPlus size={20} />,
      onClick: () => void addFriend(session.user.id, id).then(() => location.reload()),
    });
  if (friend)
    actions.push({
      label: friend.blocked ? "ブロック解除" : "ブロック",
      icon: <Ban size={20} />,
      danger: true,
      onClick: () =>
        void updateFriend(friend.id, { blocked: !friend.blocked }).then(() =>
          setFriend({ ...friend, blocked: !friend.blocked }),
        ),
    });

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-background">
      {profile.cover_url ? (
        <StoredImage path={profile.cover_url} alt="背景画像" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 to-background" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
      <button
        aria-label="閉じる"
        onClick={() => (history.length > 1 ? history.back() : void navigate({ to: "/" }))}
        className="absolute left-4 top-4 rounded-full glass p-2 text-foreground"
      >
        <X size={20} />
      </button>
      <div className="relative flex h-full flex-col items-center justify-end px-6 pb-14">
        <div className="rounded-full ring-4 ring-background/60">
          <Avatar path={profile.avatar_url} name={profile.display_name} size={110} />
        </div>
        <h1 className="mt-3 text-2xl font-bold text-foreground drop-shadow">{name}</h1>
        <p className="text-xs text-muted-foreground">@{profile.username}</p>
        <p className="mt-2 max-w-sm text-center text-sm text-foreground drop-shadow">
          {profile.status_message || "ひとことはまだありません"}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-6">
          {actions.map((a) => (
            <button key={a.label} onClick={a.onClick} className="flex w-16 flex-col items-center gap-1 text-xs text-foreground">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full glass ${a.danger ? "text-destructive" : ""}`}>
                {a.icon}
              </span>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
