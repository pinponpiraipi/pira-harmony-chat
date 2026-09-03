import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePira } from "@/lib/pira/session";
import { GlassPanel, PiraButton, PiraInput, PiraTextarea, Avatar } from "@/components/pira/ui";
import { fileExt, shrinkImage, uploadMedia } from "@/lib/pira/media";
import { ageFromBirthday } from "@/lib/pira/format";
import { THEMES } from "@/lib/pira/types";

export const Route = createFileRoute("/setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "プロフィール作成｜PIRA" },
      {
        name: "description",
        content: "アイコン・背景・ステータスメッセージ・誕生日を設定してPIRAのアカウントを完成させます。",
      },
      { property: "og:title", content: "プロフィール作成｜PIRA" },
      { property: "og:description", content: "アイコンと背景を選んで、自分だけのPIRAを作ろう。" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const { session, profile, loading, refresh } = usePira();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");
  const [birthday, setBirthday] = useState("");
  const [theme, setTheme] = useState("aurora");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const username =
    (session?.user.user_metadata?.["username"] as string | undefined) ??
    session?.user.email?.split("@")[0] ??
    "";

  useEffect(() => {
    if (loading) return;
    if (!session) void navigate({ to: "/auth", replace: true });
    else if (profile) void navigate({ to: "/", replace: true });
  }, [loading, session, profile, navigate]);

  useEffect(() => {
    if (username && !displayName) setDisplayName(username);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);

  async function pick(kind: "avatar" | "cover", file: File | undefined) {
    if (!file || !session) return;
    setBusy(true);
    try {
      const blob = kind === "avatar" ? await shrinkImage(file, 512) : await shrinkImage(file, 1400);
      const path = await uploadMedia(session.user.id, blob, kind === "avatar" ? "png" : fileExt(file));
      if (kind === "avatar") setAvatarPath(path);
      else setCoverPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!session) return;
    setError(null);
    if (displayName.trim().length < 1) return setError("表示名を入れてください");
    if (!birthday) return setError("誕生日を入れてください");
    setBusy(true);
    const { error: insertError } = await supabase.from("profiles").insert({
      id: session.user.id,
      username,
      display_name: displayName.trim(),
      avatar_url: avatarPath,
      cover_url: coverPath,
      status_message: status.trim() || null,
      birthday,
      age: ageFromBirthday(birthday),
      theme,
    });
    setBusy(false);
    if (insertError) return setError(insertError.message);
    await refresh();
    void navigate({ to: "/", replace: true });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-foreground">プロフィールを作る</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        ユーザーネーム: <span className="font-semibold text-foreground">{username}</span>
      </p>

      <GlassPanel className="mt-4 overflow-hidden">
        <button
          onClick={() => coverInput.current?.click()}
          className="relative block h-36 w-full scene-bg"
        >
          {coverPath && <CoverPreview path={coverPath} />}
          <span className="absolute bottom-2 right-2 rounded-full bg-card px-3 py-1 text-xs font-semibold text-card-foreground">
            背景を選ぶ
          </span>
        </button>
        <div className="-mt-8 flex flex-col items-center px-4 pb-4">
          <button onClick={() => avatarInput.current?.click()} className="rounded-full">
            <Avatar path={avatarPath} name={displayName || "P"} size={72} className="ring-2 ring-card" />
          </button>
          <button
            onClick={() => avatarInput.current?.click()}
            className="mt-1 text-xs font-semibold text-muted-foreground"
          >
            アイコンを選ぶ
          </button>
        </div>
      </GlassPanel>

      <input
        ref={avatarInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void pick("avatar", e.target.files?.[0])}
      />
      <input
        ref={coverInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void pick("cover", e.target.files?.[0])}
      />

      <div className="mt-4 space-y-3">
        <label className="block text-xs font-semibold text-muted-foreground">
          表示名
          <PiraInput className="mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          ステータスメッセージ
          <PiraTextarea
            className="mt-1"
            rows={2}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="今の気分をひとこと"
          />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          誕生日
          <PiraInput
            className="mt-1"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
          {birthday && (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              年齢: {ageFromBirthday(birthday)}歳
            </span>
          )}
        </label>
        <div className="text-xs font-semibold text-muted-foreground">
          テーマ
          <div className="mt-2 flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  theme === t.id ? "bg-primary text-primary-foreground" : "glass-soft text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <PiraButton className="w-full" onClick={() => void save()} disabled={busy}>
          {busy ? "保存中…" : "アカウントを完成させる"}
        </PiraButton>
      </div>
    </div>
  );
}

function CoverPreview({ path }: { path: string }) {
  return (
    <span className="absolute inset-0 block">
      <StoredCover path={path} />
    </span>
  );
}

function StoredCover({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void import("@/lib/pira/media").then(({ resolveMedia }) =>
      resolveMedia(path).then((u) => {
        if (active) setUrl(u);
      }),
    );
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) return null;
  return <img src={url} alt="背景プレビュー" className="h-full w-full object-cover" />;
}
