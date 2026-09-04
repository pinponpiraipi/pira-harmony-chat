import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePira, usernameToEmail } from "@/lib/pira/session";
import { GlassPanel, PiraButton, PiraInput } from "@/components/pira/ui";
import piraLogo from "@/assets/pira-logo.png.asset.json";

const logo = piraLogo.url;

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PIRAにログイン｜アカウント作成" },
      {
        name: "description",
        content:
          "ユーザーネームとパスワードでPIRAにログイン、または新しいアカウントを作成しましょう。",
      },
      { property: "og:title", content: "PIRAにログイン｜アカウント作成" },
      {
        property: "og:description",
        content: "PIRAのアカウントを作って、友だちとトークを始めよう。",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, profile, loading, refresh } = usePira();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session) return;
    void navigate({ to: profile ? "/" : "/setup", replace: true });
  }, [loading, session, profile, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = username.trim();
    if (name.length < 2) return setError("ユーザーネームは2文字以上にしてください");
    if (password.length < 6) return setError("パスワードは6文字以上にしてください");
    setBusy(true);
    try {
      const email = usernameToEmail(name);
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: name } },
        });
        if (signUpError) throw signUpError;
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        /invalid login/i.test(message)
          ? "ユーザーネームかパスワードが違います"
          : /already registered|already exists/i.test(message)
            ? "このユーザーネームは使われています"
            : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <GlassPanel className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center">
          <img src={logo} alt="PIRAのロゴ" className="h-24 w-24 rounded-2xl object-contain" />
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">PIRA</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            友だちとつながる、ガラス風トークアプリ
          </p>
        </div>

        <div className="mt-5 flex rounded-full glass-soft p-1 text-xs font-semibold">
          {(["signup", "login"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full py-2 transition ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "signup" ? "新規登録" : "ログイン"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-muted-foreground">
            ユーザーネーム
            <PiraInput
              className="mt-1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="pinponpi"
              autoComplete="username"
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            パスワード
            <PiraInput
              className="mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>
          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
          <PiraButton type="submit" className="w-full" disabled={busy}>
            {busy ? "処理中…" : mode === "signup" ? "アカウントを作る" : "ログイン"}
          </PiraButton>
        </form>
      </GlassPanel>
    </div>
  );
}
