import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, Phone, Video, X, Users } from "lucide-react";
import { useCall } from "@/components/pira/call";
import { Avatar, StoredImage } from "@/components/pira/ui";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/g/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "グループのプロフィール｜PIRA" },
      { name: "description", content: "PIRAのグループのアイコン・背景・ひとことを確認できます。" },
      { property: "og:title", content: "グループのプロフィール｜PIRA" },
      { property: "og:description", content: "グループのアイコンと背景をチェックしてトークへ。" },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupProfilePage,
});

type Group = { id: string; name: string | null; icon_url: string | null; cover_url: string | null; description: string | null };

function GroupProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const call = useCall();
  const [group, setGroup] = useState<Group | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    void supabase.from("conversations").select("id,name,icon_url,cover_url,description").eq("id", id).maybeSingle()
      .then(({ data }) => setGroup(data as Group | null));
    void supabase.from("conversation_members").select("id", { count: "exact", head: true }).eq("conversation_id", id)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [id]);

  const name = group?.name || "グループ";
  const actions = [
    { label: "トーク", icon: <MessageCircle size={20} />, onClick: () => void navigate({ to: "/talk/$id", params: { id }, replace: true }) },
    { label: "音声通話", icon: <Phone size={20} />, onClick: () => call?.start(id, "audio") },
    { label: "ビデオ通話", icon: <Video size={20} />, onClick: () => call?.start(id, "video") },
  ];

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-background">
      {group?.cover_url ? (
        <StoredImage path={group.cover_url} alt="グループの背景" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 to-background" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
      <button aria-label="閉じる" onClick={() => void navigate({ to: "/" })} className="absolute left-4 top-4 z-10 rounded-full glass p-2 text-foreground">
        <X size={20} />
      </button>
      <div className="relative flex h-full flex-col items-center justify-end px-6 pb-14">
        <div className="rounded-full ring-4 ring-background/60">
          {group?.icon_url ? (
            <Avatar path={group.icon_url} name={name} size={110} />
          ) : (
            <span className="flex h-[110px] w-[110px] items-center justify-center rounded-full glass"><Users size={40} /></span>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-bold text-foreground drop-shadow">{name}</h1>
        <p className="text-xs text-muted-foreground">{count}人のメンバー</p>
        <p className="mt-2 max-w-sm text-center text-sm text-foreground drop-shadow">{group?.description || "ひとことはまだありません"}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-6">
          {actions.map((a) => (
            <button key={a.label} onClick={a.onClick} className="flex w-16 flex-col items-center gap-1 text-xs text-foreground">
              <span className="flex h-12 w-12 items-center justify-center rounded-full glass">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
