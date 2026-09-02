export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  status_message: string | null;
  birthday: string | null;
  age: number | null;
  theme: string;
  banned: boolean;
  created_at: string;
};

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  nickname: string | null;
  favorite: boolean;
  hidden: boolean;
  blocked: boolean;
};

export type FriendEntry = Friendship & { profile: Profile };

export type Conversation = {
  id: string;
  is_group: boolean;
  name: string | null;
  icon_url: string | null;
  created_by: string;
  created_at: string;
};

export type MessageKind = "text" | "image" | "video" | "sticker" | "card";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  media_url: string | null;
  reply_to: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

export type MemberRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  joined_at: string;
};

export const THEMES = [
  { id: "aurora", label: "オーロラグリーン" },
  { id: "sakura", label: "さくらピンク" },
  { id: "ocean", label: "オーシャンブルー" },
  { id: "midnight", label: "ミッドナイト" },
  { id: "sunset", label: "サンセット" },
] as const;
