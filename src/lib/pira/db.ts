import { supabase } from "@/integrations/supabase/client";
import type { Conversation, FriendEntry, MemberRow, Message, Profile, Reaction } from "./types";

export async function searchProfiles(term: string, excludeId: string) {
  const clean = term.trim();
  if (!clean) return [];
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
    .neq("id", excludeId)
    .limit(20);
  return (data ?? []) as Profile[];
}

export async function getProfile(id: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return (data as Profile) ?? null;
}

export async function listFriends(userId: string): Promise<FriendEntry[]> {
  const { data } = await supabase
    .from("friendships")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .in(
      "id",
      rows.map((r) => r.friend_id),
    );
  const map = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
  return rows
    .filter((r) => map.has(r.friend_id))
    .map((r) => ({ ...r, profile: map.get(r.friend_id)! })) as FriendEntry[];
}

/** Friends of my friends that I am not friends with yet. */
export async function listSuggestions(userId: string) {
  const friends = await listFriends(userId);
  const friendIds = friends.map((f) => f.friend_id);
  if (friendIds.length === 0) return [];
  const { data } = await supabase
    .from("friendships")
    .select("user_id, friend_id")
    .in("user_id", friendIds);
  const candidateIds = [
    ...new Set(
      (data ?? [])
        .map((r) => r.friend_id)
        .filter((id) => id !== userId && !friendIds.includes(id)),
    ),
  ];
  if (candidateIds.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", candidateIds);
  const via = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!candidateIds.includes(row.friend_id)) continue;
    const list = via.get(row.friend_id) ?? [];
    const f = friends.find((x) => x.friend_id === row.user_id);
    if (f) list.push(f.nickname || f.profile.display_name);
    via.set(row.friend_id, list);
  }
  return (profiles ?? []).map((p) => ({
    profile: p as Profile,
    via: via.get(p.id) ?? [],
  }));
}

export async function addFriend(userId: string, friendId: string) {
  if (userId === friendId) throw new Error("自分は追加できません");
  const { error } = await supabase.from("friendships").upsert(
    [
      { user_id: userId, friend_id: friendId },
      { user_id: friendId, friend_id: userId },
    ],
    { onConflict: "user_id,friend_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function updateFriend(id: string, patch: Partial<FriendEntry>) {
  const update: {
    nickname?: string | null;
    favorite?: boolean;
    hidden?: boolean;
    blocked?: boolean;
    removed?: boolean;
  } = {};
  if (patch.removed !== undefined) update.removed = patch.removed;
  if (patch.nickname !== undefined) update.nickname = patch.nickname;
  if (patch.favorite !== undefined) update.favorite = patch.favorite;
  if (patch.hidden !== undefined) update.hidden = patch.hidden;
  if (patch.blocked !== undefined) update.blocked = patch.blocked;
  const { error } = await supabase.from("friendships").update(update).eq("id", id);
  if (error) throw error;
}

export async function removeFriend(id: string) {
  await supabase.from("friendships").update({ removed: true, favorite: false }).eq("id", id);
}

export type ChatSummary = {
  conversation: Conversation;
  members: MemberRow[];
  otherProfiles: Profile[];
  lastMessage: Message | null;
  unread: number;
  myMember: MemberRow;
};

export async function listChats(userId: string): Promise<ChatSummary[]> {
  const { data: myMemberships } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("user_id", userId);
  const memberships = (myMemberships ?? []) as MemberRow[];
  if (memberships.length === 0) return [];
  const convIds = memberships.map((m) => m.conversation_id);
  const [{ data: convs }, { data: allMembers }, { data: msgs }] = await Promise.all([
    supabase.from("conversations").select("*").in("id", convIds),
    supabase.from("conversation_members").select("*").in("conversation_id", convIds),
    supabase
      .from("messages")
      .select("*")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const memberRows = (allMembers ?? []) as MemberRow[];
  const otherIds = [...new Set(memberRows.map((m) => m.user_id).filter((id) => id !== userId))];
  const { data: profiles } = otherIds.length
    ? await supabase.from("profiles").select("*").in("id", otherIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
  const messages = (msgs ?? []) as Message[];

  const summaries: ChatSummary[] = (convs ?? []).map((c) => {
    const conv = c as Conversation;
    const mine = memberships.find((m) => m.conversation_id === conv.id)!;
    const members = memberRows.filter((m) => m.conversation_id === conv.id);
    const convMsgs = messages.filter((m) => m.conversation_id === conv.id);
    return {
      conversation: conv,
      members,
      myMember: mine,
      otherProfiles: members
        .filter((m) => m.user_id !== userId)
        .map((m) => profileMap.get(m.user_id))
        .filter(Boolean) as Profile[],
      lastMessage: convMsgs[0] ?? null,
      unread: convMsgs.filter(
        (m) => m.sender_id !== userId && new Date(m.created_at) > new Date(mine.last_read_at),
      ).length,
    };
  });
  return summaries.sort((a, b) => {
    const at = a.lastMessage?.created_at ?? a.conversation.created_at;
    const bt = b.lastMessage?.created_at ?? b.conversation.created_at;
    return bt.localeCompare(at);
  });
}

export async function getOrCreateDirectChat(userId: string, otherId: string) {
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  const ids = (mine ?? []).map((m) => m.conversation_id);
  if (ids.length) {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .in("id", ids)
      .eq("is_group", false);
    const dmIds = (convs ?? []).map((c) => c.id);
    if (dmIds.length) {
      const { data: theirs } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", otherId)
        .in("conversation_id", dmIds);
      if (theirs && theirs.length > 0) return theirs[0]!.conversation_id;
    }
  }
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ is_group: false, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  const { error: memberError } = await supabase.from("conversation_members").insert([
    { conversation_id: created.id, user_id: userId },
    { conversation_id: created.id, user_id: otherId },
  ]);
  if (memberError) throw memberError;
  return created.id as string;
}

export async function createGroupChat(userId: string, name: string, memberIds: string[]) {
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ is_group: true, name, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  const rows = [userId, ...memberIds].map((id) => ({
    conversation_id: created.id,
    user_id: id,
  }));
  const { error: memberError } = await supabase.from("conversation_members").insert(rows);
  if (memberError) throw memberError;
  return created.id as string;
}

export async function inviteToGroup(conversationId: string, memberIds: string[]) {
  if (memberIds.length === 0) return;
  await supabase
    .from("conversation_members")
    .upsert(
      memberIds.map((id) => ({ conversation_id: conversationId, user_id: id })),
      { onConflict: "conversation_id,user_id", ignoreDuplicates: true },
    );
}

export async function loadConversation(conversationId: string) {
  const [{ data: conv }, { data: members }, { data: msgs }] = await Promise.all([
    supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle(),
    supabase.from("conversation_members").select("*").eq("conversation_id", conversationId),
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(400),
  ]);
  const memberRows = (members ?? []) as MemberRow[];
  const { data: profiles } = memberRows.length
    ? await supabase
        .from("profiles")
        .select("*")
        .in(
          "id",
          memberRows.map((m) => m.user_id),
        )
    : { data: [] };
  const messages = (msgs ?? []) as Message[];
  const { data: reactions } = messages.length
    ? await supabase
        .from("message_reactions")
        .select("*")
        .in(
          "message_id",
          messages.map((m) => m.id),
        )
    : { data: [] };
  return {
    conversation: (conv as Conversation) ?? null,
    members: memberRows,
    profiles: (profiles ?? []) as Profile[],
    messages,
    reactions: (reactions ?? []) as Reaction[],
  };
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  kind: string;
  body?: string | null;
  mediaUrl?: string | null;
  replyTo?: string | null;
}) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    kind: input.kind,
    body: input.body ?? null,
    media_url: input.mediaUrl ?? null,
    reply_to: input.replyTo ?? null,
  });
  if (error) throw error;
}

export async function deleteMessage(id: string) {
  await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), body: null, media_url: null })
    .eq("id", id);
}

export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();
  if (existing) {
    await supabase.from("message_reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
  }
}

export async function markRead(memberRowId: string) {
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", memberRowId);
}
