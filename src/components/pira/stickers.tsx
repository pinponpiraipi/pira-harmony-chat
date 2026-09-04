import { useEffect, useMemo, useState } from "react";
import { listStickers, type Sticker } from "@/lib/pira/extras";
import { StoredImage } from "./ui";

/** Sticker tray grouped by pack (種類別). */
export function StickerPicker({ onPick }: { onPick: (sticker: Sticker) => void }) {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [pack, setPack] = useState<string | null>(null);

  useEffect(() => {
    void listStickers().then(setStickers);
  }, []);

  const packs = useMemo(
    () => [...new Set(stickers.map((s) => s.pack))].sort((a, b) => a.localeCompare(b, "ja")),
    [stickers],
  );
  const active = pack ?? packs[0] ?? null;
  const shown = stickers.filter((s) => s.pack === active);

  if (stickers.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">
        まだスタンプがありません。「スタンプ」ページで作成・共有できます。
      </p>
    );
  }

  return (
    <div className="space-y-2 p-2">
      <div className="pira-scroll flex gap-1 overflow-x-auto pb-1">
        {packs.map((p) => (
          <button
            key={p}
            onClick={() => setPack(p)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
              p === active ? "bg-primary text-primary-foreground" : "glass-soft text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {shown.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            title={s.name || s.pack}
            className="rounded-xl p-1 transition hover:bg-muted active:scale-95"
          >
            <StoredImage path={s.media_url} alt={s.name || "スタンプ"} className="h-16 w-full object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}
