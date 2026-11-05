import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Heart, MessageCircle, Pin, EyeOff, Trash2, Plus, Film, LayoutList } from "lucide-react";
import { AppShell } from "@/components/pira/shell";
import { Avatar, GlassPanel, PiraButton, PiraInput, StoredImage, StoredVideo } from "@/components/pira/ui";
import { usePira } from "@/lib/pira/session";
import { supabase } from "@/integrations/supabase/client";
import { fileExt, uploadMedia } from "@/lib/pira/media";
import { jstTime } from "@/lib/pira/format";

export const Route = createFileRoute("/feed")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PIRA｜タイムライン・ショート動画" },
      { name: "description", content: "友だちの写真投稿やショート動画を見て、いいねやコメントができます。" },
      { property: "og:title", content: "PIRA｜タイムライン・ショート動画" },
      { property: "og:description", content: "友だちの投稿とショート動画をチェック。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeedPage,
});

type Post = {
  id: string;
  author_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  pinned: boolean;
  hidden: boolean;
  created_at: string;
};
type Mini = { id: string; display_name: string; avatar_url: string | null };
type Comment = { id: string; post_id: string; user_id: string; body: string };

function FeedPage() {
  const { session, isAdmin } = usePira();
  const uid = session?.user.id;
  const [tab, setTab] = useState<"feed" | "shorts">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Record<string, Mini>>({});
  const [likes, setLikes] = useState<{ post_id: string; user_id: string }[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [composer, setComposer] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (data as Post[]) ?? [];
    setPosts(list);
    const ids = list.map((p) => p.id);
    if (!ids.length) return;
    const [l, c] = await Promise.all([
      supabase.from("post_likes").select("post_id, user_id").in("post_id", ids),
      supabase.from("post_comments").select("id, post_id, user_id, body").in("post_id", ids).order("created_at"),
    ]);
    setLikes(l.data ?? []);
    setComments((c.data as Comment[]) ?? []);
    const userIds = [...new Set([...list.map((p) => p.author_id), ...(c.data ?? []).map((x) => x.user_id)])];
    const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds);
    setPeople(Object.fromEntries((profs ?? []).map((p) => [p.id, p as Mini])));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function publish() {
    if (!uid || (!file && !caption.trim())) return;
    setBusy(true);
    try {
      let media_url: string | null = null;
      let media_type: string | null = null;
      if (file) {
        media_url = await uploadMedia(uid, file, fileExt(file));
        media_type = file.type.startsWith("video") ? "video" : "image";
      }
      await supabase.from("posts").insert({
        author_id: uid,
        caption: caption.trim() || null,
        media_url,
        media_type,
        kind: media_type === "video" ? "short" : "post",
      });
      setCaption("");
      setFile(null);
      setComposer(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(id: string) {
    if (!uid) return;
    if (likes.some((l) => l.post_id === id && l.user_id === uid))
      await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", uid);
    else await supabase.from("post_likes").insert({ post_id: id, user_id: uid });
    void load();
  }

  async function addComment(id: string) {
    if (!uid || !commentText.trim()) return;
    await supabase.from("post_comments").insert({ post_id: id, user_id: uid, body: commentText.trim().slice(0, 300) });
    setCommentText("");
    void load();
  }

  async function admin(id: string, patch: Partial<Post>) {
    await supabase.from("posts").update(patch).eq("id", id);
    void load();
  }
  async function remove(id: string) {
    if (!confirm("この投稿を削除しますか？")) return;
    await supabase.from("posts").delete().eq("id", id);
    void load();
  }

  const shown = tab === "shorts" ? posts.filter((p) => p.media_type === "video") : posts;

  function Actions({ p, onDark }: { p: Post; onDark?: boolean }) {
    const liked = likes.some((l) => l.post_id === p.id && l.user_id === uid);
    const n = likes.filter((l) => l.post_id === p.id).length;
    const c = comments.filter((x) => x.post_id === p.id).length;
    const cls = onDark ? "text-foreground" : "text-muted-foreground";
    return (
      <div className={`flex items-center gap-4 text-sm ${cls}`}>
        <button onClick={() => void toggleLike(p.id)} className="flex items-center gap-1">
          <Heart size={18} className={liked ? "fill-destructive text-destructive" : ""} /> {n}
        </button>
        <button onClick={() => setOpenComments(openComments === p.id ? null : p.id)} className="flex items-center gap-1">
          <MessageCircle size={18} /> {c}
        </button>
        {isAdmin && (
          <>
            <button title="ピン留め" onClick={() => void admin(p.id, { pinned: !p.pinned })}>
              <Pin size={16} className={p.pinned ? "text-primary" : ""} />
            </button>
            <button title="非表示" onClick={() => void admin(p.id, { hidden: !p.hidden })}>
              <EyeOff size={16} className={p.hidden ? "text-destructive" : ""} />
            </button>
          </>
        )}
        {(isAdmin || p.author_id === uid) && (
          <button title="削除" onClick={() => void remove(p.id)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  }

  function renderComments(p: Post) {
    if (openComments !== p.id) return null;
    return (
      <div className="mt-2 space-y-1">
        {comments
          .filter((c) => c.post_id === p.id)
          .map((c) => (
            <p key={c.id} className="text-xs text-foreground">
              <b>{people[c.user_id]?.display_name ?? "?"}</b> {c.body}
            </p>
          ))}
        <div className="flex gap-2">
          <PiraInput value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="コメントする" />
          <PiraButton onClick={() => void addComment(p.id)}>送信</PiraButton>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title="タイムライン"
      right={
        <PiraButton onClick={() => setComposer((v) => !v)}>
          <Plus size={16} /> 投稿
        </PiraButton>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <PiraButton variant={tab === "feed" ? "primary" : "soft"} onClick={() => setTab("feed")}>
            <LayoutList size={16} /> 投稿
          </PiraButton>
          <PiraButton variant={tab === "shorts" ? "primary" : "soft"} onClick={() => setTab("shorts")}>
            <Film size={16} /> ショート
          </PiraButton>
        </div>

        {composer && (
          <GlassPanel className="space-y-2 p-4">
            <PiraInput value={caption} maxLength={500} onChange={(e) => setCaption(e.target.value)} placeholder="キャプション・#ハッシュタグ" />
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs text-muted-foreground"
            />
            <PiraButton disabled={busy} onClick={() => void publish()}>
              {busy ? "アップロード中…" : "シェアする"}
            </PiraButton>
          </GlassPanel>
        )}

        {shown.length === 0 && (
          <GlassPanel className="p-6 text-center text-sm text-muted-foreground">
            まだ投稿がありません。友だちの投稿がここに表示されます。
          </GlassPanel>
        )}

        {tab === "shorts" ? (
          <div className="h-[75vh] snap-y snap-mandatory overflow-y-auto rounded-3xl">
            {shown.map((p) => (
              <div key={p.id} className="relative flex h-[75vh] snap-start items-center justify-center bg-background">
                <StoredVideo path={p.media_url} className="h-full w-full object-contain" />
                <div className="absolute bottom-4 left-4 right-4 glass-soft rounded-2xl p-3">
                  <p className="text-xs font-bold text-foreground">{people[p.author_id]?.display_name}</p>
                  {p.caption && <p className="text-xs text-foreground">{p.caption}</p>}
                  <Actions p={p} onDark />
                  {renderComments(p)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          shown.map((p) => (
            <GlassPanel key={p.id} className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Avatar path={people[p.author_id]?.avatar_url} name={people[p.author_id]?.display_name ?? "?"} size={32} />
                <span className="flex-1 text-sm font-bold text-foreground">{people[p.author_id]?.display_name}</span>
                {p.pinned && <Pin size={14} className="text-primary" />}
                {p.hidden && <span className="text-[10px] text-destructive">非表示中</span>}
                <span className="text-[10px] text-muted-foreground">{jstTime(p.created_at)}</span>
              </div>
              {p.media_type === "image" && <StoredImage path={p.media_url} alt="投稿写真" className="w-full rounded-2xl" />}
              {p.media_type === "video" && <StoredVideo path={p.media_url} className="w-full rounded-2xl" />}
              {p.caption && <p className="whitespace-pre-wrap text-sm text-foreground">{p.caption}</p>}
              <Actions p={p} />
              {renderComments(p)}
            </GlassPanel>
          ))
        )}
      </div>
    </AppShell>
  );
}
