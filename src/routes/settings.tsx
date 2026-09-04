import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, Palette, KeyRound, Monitor, Smartphone } from "lucide-react";
import { AppShell } from "@/components/pira/shell";
import { GlassPanel, PiraButton, PiraInput } from "@/components/pira/ui";
import { usePira } from "@/lib/pira/session";
import { supabase } from "@/integrations/supabase/client";
import { THEMES } from "@/lib/pira/types";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "設定｜PIRA" },
      {
        name: "description",
        content: "PIRAの設定。ガラス風テーマの切り替え、パスワード変更、表示サイズの切り替えができます。",
      },
      { property: "og:title", content: "設定｜PIRA" },
      { property: "og:description", content: "テーマ・パスワード・表示サイズをカスタマイズ。" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, refresh, device, setDevice } = usePira();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function saveTheme(theme: string) {
    if (!profile) return;
    await supabase.from("profiles").update({ theme }).eq("id", profile.id);
    document.documentElement.dataset["theme"] = theme;
    await refresh();
  }

  async function savePassword() {
    if (password.length < 6) {
      setNote("パスワードは6文字以上にしてください。");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    setNote(error ? error.message : "パスワードを変更しました。");
    setPassword("");
  }

  return (
    <AppShell title="設定">
      <div className="space-y-3">
        {note && <GlassPanel className="p-3 text-xs text-foreground">{note}</GlassPanel>}

        <GlassPanel className="space-y-3 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Palette size={16} /> デザイン
          </p>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => void saveTheme(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  profile?.theme === t.id
                    ? "bg-primary text-primary-foreground"
                    : "glass-soft text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
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
          <PiraButton onClick={() => void savePassword()}>変更する</PiraButton>
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
              void supabase.auth.signOut().then(() => {
                void navigate({ to: "/auth" });
              })
            }
          >
            <LogOut size={14} /> ログアウト
          </PiraButton>
        </GlassPanel>
      </div>
    </AppShell>
  );
}
