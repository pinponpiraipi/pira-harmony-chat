import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { GlassPanel, PiraButton, PiraInput } from "@/components/pira/ui";
import { getAppFlags, saveAppFlags, type CalcTrigger } from "@/lib/pira/extras";

/** Admin: calculator secret codes (result → site) and max coins per question. */
export function AdminCalcPanel() {
  const [list, setList] = useState<CalcTrigger[]>([]);
  const [max, setMax] = useState(5);
  const [note, setNote] = useState("");
  useEffect(() => {
    void getAppFlags().then((f) => {
      setList(f.calc_triggers ?? []);
      setMax(f.max_coins_per_question ?? 5);
    });
  }, []);
  const upd = (i: number, p: Partial<CalcTrigger>) => setList((l) => l.map((t, j) => (j === i ? { ...t, ...p } : t)));
  return (
    <GlassPanel className="space-y-3 p-4">
      <p className="text-sm font-bold text-foreground">電卓の合言葉（計算結果 → 開くサイト）</p>
      <p className="text-xs text-muted-foreground">URLを空にするとPIRA本体が開きます。</p>
      {list.map((t, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <PiraInput className="w-24" value={t.code} onChange={(e) => upd(i, { code: e.target.value })} placeholder="810" />
          <PiraInput className="w-28" value={t.label ?? ""} onChange={(e) => upd(i, { label: e.target.value })} placeholder="名前" />
          <PiraInput className="min-w-0 flex-1" value={t.url} onChange={(e) => upd(i, { url: e.target.value })} placeholder="https://…（空=PIRA）" />
          <button aria-label="削除" onClick={() => setList((l) => l.filter((_, j) => j !== i))} className="text-destructive">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <PiraButton variant="soft" onClick={() => setList((l) => [...l, { code: "", url: "", label: "" }])}>
        <Plus size={14} /> 合言葉を追加
      </PiraButton>
      <div className="flex items-center gap-2 text-sm text-foreground">
        1問あたりの最大コイン
        <PiraInput type="number" min={0} max={5} className="w-20" value={max} onChange={(e) => setMax(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
        枚（上限5）
      </div>
      <PiraButton
        onClick={async () => {
          try {
            await saveAppFlags({ calc_triggers: list.filter((t) => t.code.trim()), max_coins_per_question: max });
            setNote("保存しました。");
          } catch (e) {
            setNote(e instanceof Error ? e.message : "保存できませんでした");
          }
        }}
      >
        <Save size={14} /> 保存
      </PiraButton>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </GlassPanel>
  );
}
