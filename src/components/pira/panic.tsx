import { useEffect, useRef, useState } from "react";

/** Press Esc twice quickly to cover the screen with a fake Google Docs page; twice again to return. */
export function PanicGuard() {
  const [on, setOn] = useState(false);
  const last = useRef(0);
  const savedTitle = useRef("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const now = Date.now();
      if (now - last.current < 500) {
        setOn((v) => !v);
        last.current = 0;
      } else last.current = now;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (on) {
      savedTitle.current = document.title;
      document.title = "無題のドキュメント - Google ドキュメント";
      document.querySelectorAll("audio,video").forEach((m) => (m as HTMLMediaElement).pause());
    } else if (savedTitle.current) {
      document.title = savedTitle.current;
    }
  }, [on]);

  if (!on) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-muted" onDoubleClick={() => setOn(false)}>
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
        <img src="/tab-documents.png" alt="" className="h-8 w-8" />
        <div>
          <p className="text-sm text-foreground">無題のドキュメント</p>
          <p className="text-xs text-muted-foreground">ファイル　編集　表示　挿入　表示形式　ツール　拡張機能　ヘルプ</p>
        </div>
      </div>
      <div className="flex flex-1 justify-center overflow-auto py-6">
        <div
          contentEditable
          suppressContentEditableWarning
          className="min-h-[1000px] w-full max-w-[816px] bg-card p-16 text-sm text-foreground shadow outline-none"
        >
          レポート下書き
        </div>
      </div>
    </div>
  );
}
