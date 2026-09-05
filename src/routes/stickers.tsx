import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, Share2 } from "lucide-react";
import { AppShell } from "@/components/pira/shell";
import { GlassPanel, PiraButton, PiraInput, StoredImage } from "@/components/pira/ui";
import { usePira } from "@/lib/pira/session";
import { shrinkImage, uploadMedia } from "@/lib/pira/media";
import {
  createSticker,
  deleteSticker,
  listStickers,
  setStickerShared,
  type Sticker,
} from "@/lib/pira/extras";

export const Route = createFileRoute("/stickers")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "スタンプ｜PIRA" },
      {
        name: "description",
        content:
          "PIRAのスタンプ。好きな画像からスタンプを作成し、種類（パック）ごとにまとめて、友だちにも共有できます。",
      },
      { property: "og:title", content: "スタンプ｜PIRA" },
      { property: "og:description", content: "画像からオリジナルスタンプを作って共有しよう。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StickersPage,
});

function StickersPage() {
  const { session } = usePira();
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [pack, setPack] = useState("マイスタンプ");
  const [name, setName] = useState("");
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setStickers(await listStickers());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    if (!session) return;
    setBusy(true);
    setNote(null);
    try {
      const blob = await shrinkImage(file, 512);
      const path = await uploadMedia(session.user.id, blob, "png");
      await createSticker({
        ownerId: session.user.id,
        pack: pack.trim() || "マイスタンプ",
        name: name.trim(),
        mediaUrl: path,
        shared,
      });
      setName("");
      setNote("スタンプを追加しました。");
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "アップロードに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  const mine = stickers.filter((s) => s.owner_id === session?.user.id);
  const others = stickers.filter((s) => s.owner_id !== session?.user.id);

  return (
    <AppShell title="スタンプ">
      <div className="space-y-3">
        {note && <GlassPanel className="p-3 text-xs text-foreground">{note}</GlassPanel>}

        <GlassPanel className="space-y-3 p-4">
          <p className="text-sm font-bold text-foreground">スタンプを作る</p>
          <PiraInput
            value={pack}
            onChange={(e) => setPack(e.target.value)}
            placeholder="種類（パック名）例：ねこ"
          />
          <PiraInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="スタンプの名前（任意）"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="h-4 w-4"
            />
            みんなに公開する
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <PiraButton disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> 画像を選んで追加
          </PiraButton>
        </GlassPanel>

        <GlassPanel className="space-y-3 p-4">
          <p className="text-sm font-bold text-foreground">自分のスタンプ {mine.length}</p>
          {mine.length === 0 && (
            <p className="text-xs text-muted-foreground">まだスタンプがありません。</p>
          )}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {mine.map((s) => (
              <div key={s.id} className="space-y-1 text-center">
                <StoredImage
                  path={s.media_url}
                  alt={s.name || "スタンプ"}
                  className="h-20 w-full rounded-xl object-contain"
                />
                <p className="truncate text-[10px] text-muted-foreground">{s.pack}</p>
                <div className="flex justify-center gap-1">
                  <button
                    title={s.shared ? "公開中" : "非公開"}
                    className={s.shared ? "text-primary" : "text-muted-foreground"}
                    onClick={() => void setStickerShared(s.id, !s.shared).then(load)}
                  >
                    <Share2 size={14} />
                  </button>
                  <button
                    title="削除"
                    className="text-destructive"
                    onClick={() => void deleteSticker(s.id).then(load)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-3 p-4">
          <p className="text-sm font-bold text-foreground">みんなのスタンプ {others.length}</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {others.map((s) => (
              <div key={s.id} className="space-y-1 text-center">
                <StoredImage
                  path={s.media_url}
                  alt={s.name || "スタンプ"}
                  className="h-20 w-full rounded-xl object-contain"
                />
                <p className="truncate text-[10px] text-muted-foreground">{s.pack}</p>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </AppShell>
  );
}
