import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "./types";
import {
  DEFAULT_NOTIFY,
  applyCustomTheme,
  getNotifySettings,
  listCustomThemes,
  type NotifySettings,
} from "./extras";
import { notify } from "./notify";

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
};

const PiraContext = createContext<Ctx | null>(null);

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
  const notifyRef = useRef(notifySettings);
  notifyRef.current = notifySettings;

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
          notify(notifyRef.current, "PIRA 新しいメッセージ", preview.slice(0, 60));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session]);

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
    }),
    [loading, session, profile, isAdmin, refresh, device, setDevice, notifySettings],
  );

  return <PiraContext.Provider value={value}>{children}</PiraContext.Provider>;
}

export function usePira() {
  const ctx = useContext(PiraContext);
  if (!ctx) throw new Error("usePira must be used inside PiraProvider");
  return ctx;
}
