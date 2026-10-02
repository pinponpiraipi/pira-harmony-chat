import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "./types";

/* ---------------- stickers ---------------- */

export type Sticker = {
  id: string;
  owner_id: string;
  pack: string;
  name: string;
  media_url: string;
  shared: boolean;
  created_at: string;
};

export async function listStickers() {
  const { data } = await supabase
    .from("stickers")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Sticker[];
}

export async function createSticker(input: {
  ownerId: string;
  pack: string;
  name: string;
  mediaUrl: string;
  shared: boolean;
}) {
  const { error } = await supabase.from("stickers").insert({
    owner_id: input.ownerId,
    pack: input.pack || "マイスタンプ",
    name: input.name,
    media_url: input.mediaUrl,
    shared: input.shared,
  });
  if (error) throw error;
}

export async function setStickerShared(id: string, shared: boolean) {
  await supabase.from("stickers").update({ shared }).eq("id", id);
}

export async function deleteSticker(id: string) {
  await supabase.from("stickers").delete().eq("id", id);
}

/* ---------------- custom themes ---------------- */

export type ThemeVars = {
  bg: string;
  panel: string;
  text: string;
  accent: string;
};

export type CustomTheme = {
  id: string;
  owner_id: string;
  name: string;
  vars: ThemeVars;
  shared: boolean;
  created_at: string;
};

export const DEFAULT_THEME_VARS: ThemeVars = {
  bg: "#101827",
  panel: "#ffffff",
  text: "#f8fafc",
  accent: "#22c55e",
};

export async function listCustomThemes() {
  const { data } = await supabase
    .from("custom_themes")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    ...row,
    vars: { ...DEFAULT_THEME_VARS, ...((row.vars ?? {}) as Partial<ThemeVars>) },
  })) as CustomTheme[];
}

export async function createCustomTheme(input: {
  ownerId: string;
  name: string;
  vars: ThemeVars;
  shared: boolean;
}) {
  const { data, error } = await supabase
    .from("custom_themes")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      vars: input.vars,
      shared: input.shared,
    })
    .select()
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteCustomTheme(id: string) {
  await supabase.from("custom_themes").delete().eq("id", id);
}

/** Applies a custom palette to the document, or clears it for built-in themes. */
export function applyCustomTheme(vars: ThemeVars | null) {
  const root = document.documentElement;
  const set = (key: string, value: string | null) => {
    if (value) root.style.setProperty(key, value);
    else root.style.removeProperty(key);
  };
  set("--pira-custom-bg", vars?.bg ?? null);
  set("--pira-custom-panel", vars?.panel ?? null);
  set("--pira-custom-text", vars?.text ?? null);
  set("--pira-custom-accent", vars?.accent ?? null);
  if (vars) root.dataset["theme"] = "custom";
}

/* ---------------- notification settings ---------------- */

export type QuietWindow = { start: string; end: string };

export type NotifySettings = {
  user_id: string;
  enabled: boolean;
  sound: string;
  volume: number;
  desktop: boolean;
  quiet_hours: QuietWindow[];
  sound_url: string | null;
};

export const DEFAULT_NOTIFY: Omit<NotifySettings, "user_id"> = {
  enabled: true,
  sound: "pop",
  volume: 0.6,
  desktop: true,
  quiet_hours: [],
  sound_url: null,
};

export async function getNotifySettings(userId: string): Promise<NotifySettings> {
  const { data } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { user_id: userId, ...DEFAULT_NOTIFY };
  return {
    user_id: userId,
    enabled: data.enabled,
    sound: data.sound,
    volume: Number(data.volume),
    desktop: data.desktop,
    quiet_hours: (data.quiet_hours ?? []) as QuietWindow[],
    sound_url: (data as { sound_url?: string | null }).sound_url ?? null,
  };
}

export async function saveNotifySettings(s: NotifySettings) {
  const { error } = await supabase.from("notification_settings").upsert(
    {
      user_id: s.user_id,
      enabled: s.enabled,
      sound: s.sound,
      volume: s.volume,
      desktop: s.desktop,
      quiet_hours: s.quiet_hours,
      sound_url: s.sound_url,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

/* ---------------- global (admin) settings ---------------- */

/** Quiet hours set by an admin; enforced for every account. */
export async function getGlobalQuietHours(): Promise<QuietWindow[]> {
  const { data } = await supabase.from("app_settings").select("quiet_hours").eq("id", true).maybeSingle();
  return ((data?.quiet_hours ?? []) as QuietWindow[]);
}

export async function saveGlobalQuietHours(windows: QuietWindow[]) {
  const { error } = await supabase
    .from("app_settings")
    .update({ quiet_hours: windows })
    .eq("id", true);
  if (error) throw error;
}

export type AppFlags = { screen_locked: boolean; notifications_off: boolean };

export async function getAppFlags(): Promise<AppFlags> {
  const { data } = await supabase
    .from("app_settings")
    .select("screen_locked, notifications_off")
    .eq("id", true)
    .maybeSingle();
  return {
    screen_locked: Boolean(data?.screen_locked),
    notifications_off: Boolean(data?.notifications_off),
  };
}

export async function saveAppFlags(patch: Partial<AppFlags>) {
  const { error } = await supabase.from("app_settings").update(patch).eq("id", true);
  if (error) throw error;
}

export async function adminRestoreProfile(id: string) {
  const { error } = await supabase.from("profiles").update({ deleted: false }).eq("id", id);
  if (error) throw error;
}

/* ---------------- birthday cards ---------------- */

export async function listBirthdayCards(userId: string) {
  const { data } = await supabase
    .from("birthday_cards")
    .select("*")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
  return data ?? [];
}

export async function sendBirthdayCard(input: {
  senderId: string;
  recipientId: string;
  message: string;
}) {
  const year = new Date().getFullYear();
  const { error } = await supabase.from("birthday_cards").upsert(
    {
      sender_id: input.senderId,
      recipient_id: input.recipientId,
      year,
      message: input.message,
    },
    { onConflict: "sender_id,recipient_id,year" },
  );
  if (error) throw error;
}

/* ---------------- admin ---------------- */

export async function adminListProfiles() {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Profile[];
}

export async function adminSetBanned(id: string, banned: boolean) {
  const { error } = await supabase.from("profiles").update({ banned }).eq("id", id);
  if (error) throw error;
}

export async function adminUpdateProfile(
  id: string,
  patch: {
    display_name?: string;
    username?: string;
    status_message?: string | null;
    avatar_url?: string | null;
    cover_url?: string | null;
  },
) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

export async function adminDeleteProfile(id: string) {
  const { error } = await supabase.from("profiles").update({ deleted: true }).eq("id", id);
  if (error) throw error;
}

export async function adminListConversations() {
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

/** Admin-only: read every message of any conversation (allowed by RLS for admins). */
export async function adminListMessages(conversationId: string) {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(300);
  return data ?? [];
}

export async function adminDeleteMessage(id: string) {
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}
