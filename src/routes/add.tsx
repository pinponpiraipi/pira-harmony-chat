import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import jsQR from "jsqr";
import { Camera, Search, UserPlus, X } from "lucide-react";
import { AppShell } from "@/components/pira/shell";
import { Avatar, GlassPanel, PiraButton, PiraInput } from "@/components/pira/ui";
import { usePira } from "@/lib/pira/session";
import { addFriend, listSuggestions, searchProfiles } from "@/lib/pira/db";
import type { Profile } from "@/lib/pira/types";

export const Route = createFileRoute("/add")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "友だち追加｜PIRA" },
      {
        name: "description",
        content:
          "名前で検索、QRコードをサイト内で読み取り、共通の友だちからの紹介でPIRAの友だちを追加できます。",
      },
      { property: "og:title", content: "友だち追加｜PIRA" },
      { property: "og:description", content: "検索・QR・紹介の3つの方法で友だちを増やそう。" },
    ],
  }),
  component: AddPage,
});

function AddPage() {
  const { session, profile } = usePira();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [suggestions, setSuggestions] = useState<{ profile: Profile; via: string[] }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!session) return;
    void listSuggestions(session.user.id).then(setSuggestions);
  }, [session]);

  async function search() {
    if (!session) return;
    setResults(await searchProfiles(term, session.user.id));
  }

  async function add(friendId: string) {
    if (!session) return;
    try {
      await addFriend(session.user.id, friendId);
      setMessage("友だちに追加しました。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "追加できませんでした。");
    }
  }

  return (
    <AppShell title="友だち追加">
      <div className="space-y-3">
        {message && (
          <GlassPanel className="p-3 text-xs text-foreground">{message}</GlassPanel>
        )}

        <GlassPanel className="space-y-3 p-4">
          <p className="text-sm font-bold text-foreground">名前で検索</p>
          <div className="flex gap-2">
            <PiraInput
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="ユーザーネームや表示名"
              onKeyDown={(e) => {
                if (e.key === "Enter") void search();
              }}
            />
            <PiraButton onClick={() => void search()}>
              <Search size={14} /> 検索
            </PiraButton>
          </div>
          {results.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <Avatar path={p.avatar_url} name={p.display_name} size={36} />
              <span className="flex-1 truncate text-sm text-foreground">
                {p.display_name}
                <span className="ml-1 text-xs text-muted-foreground">@{p.username}</span>
              </span>
              <PiraButton variant="soft" onClick={() => void add(p.id)}>
                <UserPlus size={14} /> 追加
              </PiraButton>
            </div>
          ))}
        </GlassPanel>

        <GlassPanel className="space-y-3 p-4">
          <p className="text-sm font-bold text-foreground">QRコード</p>
          {profile && (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-2xl bg-card p-3">
                <QRCodeSVG value={`pira:${profile.id}`} size={148} />
              </div>
              <p className="text-xs text-muted-foreground">このQRを相手に読み取ってもらいましょう。</p>
            </div>
          )}
          {scanning ? (
            <QrScanner
              onClose={() => setScanning(false)}
              onFound={(value) => {
                setScanning(false);
                const id = value.replace(/^pira:/, "").trim();
                void add(id);
              }}
            />
          ) : (
            <PiraButton variant="soft" onClick={() => setScanning(true)}>
              <Camera size={14} /> QRを読み取る
            </PiraButton>
          )}
        </GlassPanel>

        <GlassPanel className="space-y-3 p-4">
          <p className="text-sm font-bold text-foreground">知り合いかも（共通の友だち）</p>
          {suggestions.length === 0 && (
            <p className="text-xs text-muted-foreground">紹介できる友だちがまだいません。</p>
          )}
          {suggestions.map((s) => (
            <div key={s.profile.id} className="flex items-center gap-2">
              <Avatar path={s.profile.avatar_url} name={s.profile.display_name} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{s.profile.display_name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {s.via.length > 0 ? `${s.via.join("・")} の友だち` : "共通の友だち"}
                </span>
              </span>
              <PiraButton variant="soft" onClick={() => void add(s.profile.id)}>
                <UserPlus size={14} /> 追加
              </PiraButton>
            </div>
          ))}
        </GlassPanel>
      </div>
    </AppShell>
  );
}

function QrScanner({ onFound, onClose }: { onFound: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const tick = () => {
          if (stopped) return;
          const canvas = canvasRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(image.data, image.width, image.height);
              if (code?.data) {
                onFound(code.data);
                return;
              }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setError("カメラを利用できませんでした。");
      }
    }
    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onFound]);

  return (
    <div className="space-y-2">
      <video ref={videoRef} className="w-full rounded-2xl" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <PiraButton variant="ghost" onClick={onClose}>
        <X size={14} /> 閉じる
      </PiraButton>
    </div>
  );
}
