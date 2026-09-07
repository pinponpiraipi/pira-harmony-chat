import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LogOut,
  Palette,
  KeyRound,
  Monitor,
  Smartphone,
  Bell,
  BellOff,
  Play,
  Plus,
  Trash2,
  ImagePlus,
  Smile,
  Shield,
  Save,
} from "lucide-react";
import { AppShell } from "@/components/pira/shell";
import { Avatar, GlassPanel, PiraButton, PiraInput, StoredImage } from "@/components/pira/ui";
import { usePira } from "@/lib/pira/session";
import { supabase } from "@/integrations/supabase/client";
import { THEMES } from "@/lib/pira/types";
import { ageFromBirthday } from "@/lib/pira/format";
import { fileExt, shrinkImage, uploadMedia } from "@/lib/pira/media";
import {
  DEFAULT_THEME_VARS,
  applyCustomTheme,
  createCustomTheme,
  deleteCustomTheme,
  listCustomThemes,
  saveNotifySettings,
  type CustomTheme,
  type ThemeVars,
} from "@/lib/pira/extras";
import { SOUNDS, playSound, requestDesktopPermission } from "@/lib/pira/notify";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "設定｜PIRA" },
      {
        name: "description",
        content:
          "PIRAの設定。プロフィールの変更、ガラス風テーマや自作テーマ、通知音と通知オフ時間帯、パスワード、表示サイズを調整できます。",
      },
      { property: "og:title", content: "設定｜PIRA" },
      {
        property: "og:description",
        content: "プロフィール・テーマ・通知・パスワード・表示サイズをカスタマイズ。",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, session, refresh, device, setDevice, isAdmin, notifySettings, setNotifySettings } =
    usePira();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<string | null>(null);

  return (
    <AppShell title="設定">
      <div className="space-y-3">
        {note && <GlassPanel className="p-3 text-xs text-foreground">{note}</GlassPanel>}

        <ProfileSection onNote={setNote} />

        <GlassPanel className="space-y-3 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Palette size={16} /> デザイン
          </p>
          <ThemeSection onNote={setNote} />
        </GlassPanel>

        <NotifySection
          settings={notifySettings}
          userId={session?.user.id ?? ""}
          onChange={setNotifySettings}
          onNote={setNote}
        />

        <GlassPanel className="space-y-2 p-4">
          <p className="text-sm font-bold text-foreground">その他のページ</p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/stickers"
              replace
              className="inline-flex items-center gap-2 rounded-full glass-soft px-4 py-2 text-sm font-semibold text-foreground"
            >
              <Smile size={14} /> スタンプ
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                replace
                className="inline-flex items-center gap-2 rounded-full glass-soft px-4 py-2 text-sm font-semibold text-foreground"
              >
                <Shield size={14} /> 管理者ページ
              </Link>
            )}
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-3 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <KeyRound size={16} /> パスワード
          </p>
          <PiraInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新しいパスワード"
          />
          <PiraButton
            onClick={async () => {
              if (password.length < 6) {
                setNote("パスワードは6文字以上にしてください。");
                return;
              }
              const { error } = await supabase.auth.updateUser({ password });
              setNote(error ? error.message : "パスワードを変更しました。");
              setPassword("");
            }}
          >
            変更する
          </PiraButton>
        </GlassPanel>

        <GlassPanel className="space-y-3 p-4">
          <p className="text-sm font-bold text-foreground">画面サイズ</p>
          <div className="flex gap-2">
            <PiraButton
              variant={device === "mobile" ? "primary" : "soft"}
              onClick={() => setDevice("mobile")}
            >
              <Smartphone size={14} /> スマホ
            </PiraButton>
            <PiraButton
              variant={device === "desktop" ? "primary" : "soft"}
              onClick={() => setDevice("desktop")}
            >
              <Monitor size={14} /> PC
            </PiraButton>
          </div>
        </GlassPanel>

        <GlassPanel className="p-4">
          <PiraButton
            variant="danger"
            onClick={() =>
              void supabase.auth.signOut().then(async () => {
                await refresh();
                void navigate({ to: "/auth", replace: true });
              })
            }
          >
            <LogOut size={14} /> ログアウト
          </PiraButton>
        </GlassPanel>

        {!profile && (
          <p className="px-1 text-xs text-muted-foreground">プロフィールを読み込んでいます…</p>
        )}
      </div>
    </AppShell>
  );
}

/* ---------------- profile ---------------- */

function ProfileSection({ onNote }: { onNote: (s: string) => void }) {
  const { session, profile, refresh } = usePira();
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");
  const [birthday, setBirthday] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setStatus(profile.status_message ?? "");
    setBirthday(profile.birthday ?? "");
    setAvatarPath(profile.avatar_url);
    setCoverPath(profile.cover_url);
  }, [profile]);

  async function pick(kind: "avatar" | "cover", file: File | undefined) {
    if (!file || !session) return;
    setBusy(true);
    try {
      // Covers are resized and re-encoded to WebP so big photos stay light.
      const blob =
        kind === "avatar"
          ? await shrinkImage(file, 512)
          : await shrinkImage(file, 1600, "image/webp", 0.82);
      const path = await uploadMedia(
        session.user.id,
        blob,
        kind === "avatar" ? "png" : "webp",
      );
      if (kind === "avatar") setAvatarPath(path);
      else setCoverPath(path);
      onNote(kind === "avatar" ? "アイコンを選びました。保存してください。" : "背景を選びました。保存してください。");
    } catch (err) {
      onNote(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!session) return;
    if (!displayName.trim()) return onNote("名前を入れてください。");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        status_message: status.trim() || null,
        birthday: birthday || null,
        age: birthday ? ageFromBirthday(birthday) : null,
        avatar_url: avatarPath,
        cover_url: coverPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);
    setBusy(false);
    if (error) return onNote(error.message);
    await refresh();
    onNote("プロフィールを更新しました。");
  }

  return (
    <GlassPanel className="space-y-3 overflow-hidden">
      <div className="relative h-32 w-full bg-muted">
        {coverPath ? (
          <StoredImage path={coverPath} alt="背景画像" className="h-32 w-full object-cover" />
        ) : null}
        <button
          onClick={() => coverInput.current?.click()}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full glass-soft px-3 py-1.5 text-xs font-semibold text-foreground"
        >
          <ImagePlus size={14} /> 背景を変更
        </button>
        {coverPath && (
          <button
            onClick={() => setCoverPath(null)}
            className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full glass-soft px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            <Trash2 size={14} /> 背景を外す
          </button>
        )}
      </div>
      <div className="space-y-3 p-4 pt-0">
        <div className="-mt-8 flex items-end gap-3">
          <button onClick={() => avatarInput.current?.click()} aria-label="アイコンを変更">
            <Avatar path={avatarPath} name={displayName || "P"} size={64} />
          </button>
          <PiraButton variant="soft" onClick={() => avatarInput.current?.click()}>
            <ImagePlus size={14} /> アイコンを変更
          </PiraButton>
        </div>
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pick("avatar", e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pick("cover", e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <label className="block text-xs font-semibold text-muted-foreground">名前</label>
        <PiraInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <label className="block text-xs font-semibold text-muted-foreground">ひとこと</label>
        <PiraInput
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="ステータスメッセージ"
        />
        <label className="block text-xs font-semibold text-muted-foreground">誕生日</label>
        <PiraInput type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        <PiraButton disabled={busy} onClick={() => void save()}>
          <Save size={14} /> プロフィールを保存
        </PiraButton>
        {/* fileExt stays used for non-image uploads elsewhere */}
        <span className="hidden">{fileExt.name}</span>
      </div>
    </GlassPanel>
  );
}

/* ---------------- themes ---------------- */

function ThemeSection({ onNote }: { onNote: (s: string) => void }) {
  const { profile, session, refresh } = usePira();
  const [themes, setThemes] = useState<CustomTheme[]>([]);
  const [name, setName] = useState("");
  const [vars, setVars] = useState<ThemeVars>(DEFAULT_THEME_VARS);
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setThemes(await listCustomThemes());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function apply(theme: string) {
    if (!session) return;
    await supabase.from("profiles").update({ theme }).eq("id", session.user.id);
    await refresh();
  }

  async function create() {
    if (!session) return;
    if (!name.trim()) return onNote("テーマ名を入れてください。");
    setBusy(true);
    try {
      const id = await createCustomTheme({
        ownerId: session.user.id,
        name: name.trim(),
        vars,
        shared,
      });
      setName("");
      await load();
      await apply(`custom:${id}`);
      applyCustomTheme(vars);
      onNote("自作テーマを保存して適用しました。");
    } catch (err) {
      onNote(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const current = profile?.theme ?? "aurora";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => void apply(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              current === t.id ? "bg-primary text-primary-foreground" : "glass-soft text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground">自作テーマ</p>
        {themes.length === 0 && (
          <p className="text-xs text-muted-foreground">まだ自作テーマはありません。</p>
        )}
        <div className="flex flex-wrap gap-2">
          {themes.map((t) => (
            <span key={t.id} className="flex items-center gap-1">
              <button
                onClick={() => void apply(`custom:${t.id}`)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  current === `custom:${t.id}`
                    ? "bg-primary text-primary-foreground"
                    : "glass-soft text-foreground"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: t.vars.accent }}
                  aria-hidden
                />
                {t.name}
                {!t.shared && "（非公開）"}
              </button>
              {t.owner_id === session?.user.id && (
                <button
                  aria-label="テーマを削除"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    await deleteCustomTheme(t.id);
                    if (current === `custom:${t.id}`) await apply("aurora");
                    await load();
                  }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-xl glass-soft p-3">
        <p className="text-xs font-bold text-foreground">テーマを作る</p>
        <PiraInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="テーマ名（例：ミントソーダ）"
        />
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["bg", "背景"],
              ["panel", "パネル"],
              ["text", "文字"],
              ["accent", "アクセント"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="color"
                value={vars[key]}
                onChange={(e) => setVars({ ...vars, [key]: e.target.value })}
                className="h-7 w-10 rounded"
              />
              {label}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
          みんなに公開する
        </label>
        <div className="flex gap-2">
          <PiraButton variant="soft" onClick={() => applyCustomTheme(vars)}>
            おためし表示
          </PiraButton>
          <PiraButton disabled={busy} onClick={() => void create()}>
            保存して使う
          </PiraButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- notifications ---------------- */

function NotifySection({
  settings,
  userId,
  onChange,
  onNote,
}: {
  settings: import("@/lib/pira/extras").NotifySettings;
  userId: string;
  onChange: (s: import("@/lib/pira/extras").NotifySettings) => void;
  onNote: (s: string) => void;
}) {
  const [start, setStart] = useState("22:00");
  const [end, setEnd] = useState("07:00");

  async function persist(next: import("@/lib/pira/extras").NotifySettings) {
    onChange(next);
    if (!userId) return;
    try {
      await saveNotifySettings({ ...next, user_id: userId });
    } catch (err) {
      onNote(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <GlassPanel className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        {settings.enabled ? <Bell size={16} /> : <BellOff size={16} />} 通知
      </p>

      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => void persist({ ...settings, enabled: e.target.checked })}
        />
        通知をオンにする
      </label>

      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground">通知音</p>
        <div className="flex flex-wrap gap-2">
          {SOUNDS.map((s) => (
            <span key={s.id} className="flex items-center gap-1">
              <button
                onClick={() => void persist({ ...settings, sound: s.id })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  settings.sound === s.id
                    ? "bg-primary text-primary-foreground"
                    : "glass-soft text-foreground"
                }`}
              >
                {s.label}
              </button>
              <button
                aria-label={`${s.label}をおためし再生`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => playSound(s.id, settings.volume)}
              >
                <Play size={12} />
              </button>
            </span>
          ))}
        </div>
        <label className="block text-xs text-muted-foreground">
          音量 {Math.round(settings.volume * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) => onChange({ ...settings, volume: Number(e.target.value) })}
            onMouseUp={() => void persist(settings)}
            onTouchEnd={() => void persist(settings)}
            className="mt-1 w-full"
          />
        </label>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={settings.desktop}
            onChange={(e) => void persist({ ...settings, desktop: e.target.checked })}
          />
          PC（デスクトップ）通知を使う
        </label>
        <PiraButton
          variant="soft"
          onClick={async () => {
            const result = await requestDesktopPermission();
            onNote(
              result === "granted"
                ? "PC通知が許可されました。"
                : result === "unsupported"
                  ? "この端末はPC通知に対応していません。"
                  : "PC通知は許可されていません。ブラウザの設定から許可してください。",
            );
          }}
        >
          PC通知を許可する
        </PiraButton>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground">通知オフの時間帯（日本時間）</p>
        {settings.quiet_hours.length === 0 && (
          <p className="text-xs text-muted-foreground">設定されていません。</p>
        )}
        {settings.quiet_hours.map((w, i) => (
          <div key={`${w.start}-${w.end}-${i}`} className="flex items-center gap-2 text-xs text-foreground">
            <span className="tabular-nums">
              {w.start} 〜 {w.end}
            </span>
            <button
              aria-label="時間帯を削除"
              className="text-muted-foreground hover:text-destructive"
              onClick={() =>
                void persist({
                  ...settings,
                  quiet_hours: settings.quiet_hours.filter((_, idx) => idx !== i),
                })
              }
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-xl bg-input px-2 py-1 text-xs text-foreground"
          />
          <span className="text-xs text-muted-foreground">〜</span>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-xl bg-input px-2 py-1 text-xs text-foreground"
          />
          <PiraButton
            variant="soft"
            onClick={() =>
              void persist({
                ...settings,
                quiet_hours: [...settings.quiet_hours, { start, end }],
              })
            }
          >
            <Plus size={14} /> 追加
          </PiraButton>
        </div>
      </div>
    </GlassPanel>
  );
}
