import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "./types";
import {
  DEFAULT_NOTIFY,
  applyCustomTheme,
  getAppFlags,
  getGlobalQuietHours,
  type AppFlags,
  getNotifySettings,
  listCustomThemes,
  type NotifySettings,
  type QuietWindow,
} from "./extras";
import { notify } from "./notify";
import { listChats } from "./db";
import { setUnreadFavicon } from "./favicon";
import { StoredImage } from "@/components/pira/ui";
import { needsModeChoice, openInBlank, setTabMode, type TabMode } from "./cloak";

export const USERNAME_DOMAIN = "pira.local";

export function usernameToEmail(username: string) {
  const normalized = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  return `${normalized || "user"}@${USERNAME_DOMAIN}`;
}

type Ctx = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  device: "mobile" | "desktop";
  setDevice: (d: "mobile" | "desktop") => void;
  notifySettings: NotifySettings;
  setNotifySettings: (s: NotifySettings) => void;
  globalQuiet: QuietWindow[];
  flags: AppFlags;
  unread: number;
  refreshUnread: () => Promise<void>;
};

// Kept on globalThis so hot reloads during editing reuse the same context.
const g = globalThis as unknown as { __piraCtx?: React.Context<Ctx | null> };
const PiraContext = g.__piraCtx ?? (g.__piraCtx = createContext<Ctx | null>(null));

export function PiraProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [device, setDeviceState] = useState<"mobile" | "desktop">("desktop");
  const [notifySettings, setNotifySettings] = useState<NotifySettings>({
    user_id: "",
    ...DEFAULT_NOTIFY,
  });
  const [globalQuiet, setGlobalQuiet] = useState<QuietWindow[]>([]);
  const [unread, setUnread] = useState(0);
  const notifyRef = useRef(notifySettings);
  notifyRef.current = notifySettings;
  const [flags, setFlags] = useState<AppFlags>({ screen_locked: false, notifications_off: false });
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const quietRef = useRef(globalQuiet);
  quietRef.current = globalQuiet;

  const load = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    const [{ data: prof }, { data: roles }, settings] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      getNotifySettings(uid),
    ]);
    setProfile((prof as Profile) ?? null);
    setIsAdmin(Boolean(roles?.some((r) => r.role === "admin")));
    setNotifySettings(settings);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await load(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(next);
      void load(next?.user.id);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  // Quiet hours the admin forces on every account.
  useEffect(() => {
    if (!session) return;
    let active = true;
    void getGlobalQuietHours().then((w) => {
      if (active) setGlobalQuiet(w);
    });
    void getAppFlags().then((f) => {
      if (active) setFlags(f);
    });
    const channel = supabase
      .channel("pira-app-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => {
        void getGlobalQuietHours().then((w) => setGlobalQuiet(w));
        void getAppFlags().then(setFlags);
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [session]);

  useEffect(() => {
    const stored = window.localStorage.getItem("pira-device");
    if (stored === "mobile" || stored === "desktop") setDeviceState(stored);
    else setDeviceState(window.innerWidth < 820 ? "mobile" : "desktop");
  }, []);

  const setDevice = useCallback((d: "mobile" | "desktop") => {
    setDeviceState(d);
    window.localStorage.setItem("pira-device", d);
  }, []);

  // Built-in themes are plain ids; user-made palettes are stored as "custom:<id>".
  useEffect(() => {
    const theme = profile?.theme ?? "aurora";
    if (!theme.startsWith("custom:")) {
      applyCustomTheme(null);
      document.documentElement.dataset["theme"] = theme;
      return;
    }
    let active = true;
    void listCustomThemes().then((themes) => {
      if (!active) return;
      const hit = themes.find((t) => `custom:${t.id}` === theme);
      if (hit) applyCustomTheme(hit.vars);
      else document.documentElement.dataset["theme"] = "aurora";
    });
    return () => {
      active = false;
    };
  }, [profile?.theme]);

  // Global new-message alerts (sound + desktop notification).
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel("pira-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as { sender_id: string; body: string | null; kind: string };
          if (row.sender_id === session.user.id) return;
          const preview =
            row.kind === "text" ? (row.body ?? "") : row.kind === "sticker" ? "スタンプ" : "写真・動画";
          notify(notifyRef.current, "PIRA 新しいメッセージ", preview.slice(0, 60), quietRef.current, flagsRef.current.notifications_off);
          void refreshUnread();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session]);

  const refreshUnread = useCallback(async () => {
    if (!session) {
      setUnread(0);
      return;
    }
    const chats = await listChats(session.user.id);
    setUnread(chats.reduce((sum, c) => sum + c.unread, 0));
  }, [session]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    setUnreadFavicon(unread);
  }, [unread]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await load(data.session?.user.id);
  }, [load]);

  const value = useMemo<Ctx>(
    () => ({
      loading,
      session,
      profile,
      isAdmin,
      refresh,
      device,
      setDevice,
      notifySettings,
      setNotifySettings,
      globalQuiet,
      flags,
      unread,
      refreshUnread,
    }),
    [
      loading,
      session,
      profile,
      isAdmin,
      refresh,
      device,
      setDevice,
      notifySettings,
      globalQuiet,
      flags,
      unread,
      refreshUnread,
    ],
  );

  const [choose, setChoose] = useState(false);
  useEffect(() => {
    setChoose(needsModeChoice());
  }, []);
  function pickMode(m: TabMode, blank: boolean) {
    setTabMode(m);
    setChoose(false);
    if (blank) openInBlank(flags.cloak_url || window.location.href);
  }

  const blocked = Boolean(session) && !isAdmin && (flags.screen_locked || Boolean(profile?.deleted));

  return (
    <PiraContext.Provider value={value}>
      {children}
      {choose && !blocked && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 px-6 backdrop-blur">
          <div className="glass w-full max-w-sm space-y-3 rounded-2xl p-5 text-center">
            <p className="font-display text-lg font-bold text-foreground">モードを選んでください</p>
            <button
              className="w-full rounded-xl glass-soft p-3 text-left text-foreground"
              onClick={() => pickMode("defense", true)}
            >
              <p className="font-bold">自己防衛モード</p>
              <p className="text-xs text-muted-foreground">タブを「Google ドキュメント」に見せかけます。通知が来ると「Google スライド」に。</p>
            </button>
            <button
              className="w-full rounded-xl glass-soft p-3 text-left text-foreground"
              onClick={() => pickMode("pira", true)}
            >
              <p className="font-bold">PIRA尊重モード</p>
              <p className="text-xs text-muted-foreground">タブは「PIRA」。通知が来ると赤いアイコンと「PIRA:通知来たよ」に。</p>
            </button>
            <p className="text-[10px] text-muted-foreground">選ぶと about:blank のタブで開きます。</p>
          </div>
        </div>
      )}
      {blocked && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
          {!profile?.deleted && flags.lock_image_url ? (
            <StoredImage path={flags.lock_image_url} alt="ブロック画面" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <p className="font-display text-2xl font-bold text-foreground">
                {profile?.deleted ? "このアカウントは利用できません" : "ただいま画面がブロックされています"}
              </p>
              <p className="text-sm text-muted-foreground">
                {profile?.deleted ? "管理者にお問い合わせください。" : "管理者が解除するまでお待ちください。"}
              </p>
            </>
          )}
        </div>
      )}
    </PiraContext.Provider>
  );
}

export function usePira() {
  const ctx = useContext(PiraContext);
  if (!ctx) throw new Error("usePira must be used inside PiraProvider");
  return ctx;
}
