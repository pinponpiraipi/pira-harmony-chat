import { createPortal } from "react-dom";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video, Mic, MicOff, Move } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, PiraButton, StoredImage } from "./ui";
import { usePira } from "@/lib/pira/session";
import { playKind, stopTone } from "@/lib/pira/notify";

type Mode = "audio" | "video";
type Phase = "idle" | "incoming" | "calling" | "live";
type RoomInfo = {
  cid: string;
  mode: Mode;
  title: string;
  avatar: string | null;
  cover: string | null;
  memberIds: string[];
  names: Record<string, { name: string; avatar: string | null }>;
};
type Peer = { id: string; stream: MediaStream | null };

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }],
};

export const CALL_POPUP_KEY = "pira-call-popup";
const SELFVIEW_KEY = "pira-selfview";

type CallCtx = { start: (cid: string, mode: Mode) => void; busy: boolean };
const g = globalThis as unknown as { __piraCallCtx?: React.Context<CallCtx | null> };
const CallContext = g.__piraCallCtx ?? (g.__piraCallCtx = createContext<CallCtx | null>(null));

async function loadRoom(cid: string, selfId: string, mode: Mode): Promise<RoomInfo | null> {
  const [{ data: conv }, { data: mem }] = await Promise.all([
    supabase.from("conversations").select("*").eq("id", cid).maybeSingle(),
    supabase.from("conversation_members").select("user_id").eq("conversation_id", cid),
  ]);
  if (!conv) return null;
  const memberIds = (mem ?? []).map((m) => m.user_id);
  const { data: profs } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url, cover_url").in("id", memberIds)
    : { data: [] as { id: string; display_name: string; avatar_url: string | null; cover_url: string | null }[] };
  const names: RoomInfo["names"] = {};
  (profs ?? []).forEach((p) => (names[p.id] = { name: p.display_name, avatar: p.avatar_url }));
  const other = (profs ?? []).find((p) => p.id !== selfId);
  return conv.is_group
    ? { cid, mode, title: conv.name || "グループ", avatar: conv.icon_url, cover: conv.icon_url, memberIds, names }
    : {
        cid,
        mode,
        title: other?.display_name ?? "通話",
        avatar: other?.avatar_url ?? null,
        cover: other?.cover_url ?? null,
        memberIds,
        names,
      };
}

function sendTo(topic: string, event: string, payload: Record<string, unknown>) {
  const ch = supabase.channel(topic);
  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    void ch.send({ type: "broadcast", event, payload }).finally(() => {
      setTimeout(() => void supabase.removeChannel(ch), 800);
    });
  });
}

/** Global voice/video calling: rings people anywhere in PIRA and supports group (mesh) calls. */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const { session, flags, notifySettings } = usePira();
  const logRef = useRef<{ id: string | null; answeredAt: number | null }>({ id: null, answeredAt: null });
  const markAnswered = useCallback(() => {
    const l = logRef.current;
    if (!l.id || l.answeredAt) return;
    l.answeredAt = Date.now();
    void supabase.from("call_logs").update({ status: "answered", answered_at: new Date().toISOString() }).eq("id", l.id);
  }, []);
  const closeLog = useCallback(() => {
    const l = logRef.current;
    if (l.id && l.answeredAt) {
      void supabase
        .from("call_logs")
        .update({ ended_at: new Date().toISOString(), duration_sec: Math.round((Date.now() - l.answeredAt) / 1000) })
        .eq("id", l.id);
    }
    logRef.current = { id: null, answeredAt: null };
  }, []);
  const selfId = session?.user.id ?? null;
  const [phase, setPhase] = useState<Phase>("idle");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const roomRef = useRef<RoomInfo | null>(null);
  roomRef.current = room;
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const chanRef = useRef<RealtimeChannel | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const streamRef = useRef<MediaStream | null>(null);
  const gotPeer = useRef(false);
  const incomingLog = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== "live") return setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const removePeer = useCallback((id: string) => {
    pcs.current.get(id)?.close();
    pcs.current.delete(id);
    pendingIce.current.delete(id);
    setPeers((list) => list.filter((p) => p.id !== id));
  }, []);

  const cleanup = useCallback(() => {
    closeLog();
    pcs.current.forEach((pc) => pc.close());
    pcs.current.clear();
    pendingIce.current.clear();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    if (chanRef.current) void supabase.removeChannel(chanRef.current);
    chanRef.current = null;
    gotPeer.current = false;
    setPeers([]);
    setMuted(false);
    setRoom(null);
    setPhase("idle");
  }, [closeLog]);

  const roomSend = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      void chanRef.current?.send({ type: "broadcast", event, payload: { from: selfId, ...payload } });
    },
    [selfId],
  );

  const makePeer = useCallback(
    (id: string) => {
      const existing = pcs.current.get(id);
      if (existing) return existing;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate) roomSend("ice", { to: id, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        const [remote] = e.streams;
        if (!remote) return;
        setPeers((list) => [...list.filter((p) => p.id !== id), { id, stream: remote }]);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          gotPeer.current = true;
          markAnswered();
          setPhase("live");
        }
        if (pc.connectionState === "failed" || pc.connectionState === "closed") removePeer(id);
      };
      pcs.current.set(id, pc);
      setPeers((list) => (list.some((p) => p.id === id) ? list : [...list, { id, stream: null }]));
      return pc;
    },
    [roomSend, removePeer, markAnswered],
  );

  const drainIce = useCallback(async (id: string) => {
    const pc = pcs.current.get(id);
    if (!pc?.remoteDescription) return;
    const list = pendingIce.current.get(id) ?? [];
    pendingIce.current.set(id, []);
    for (const c of list) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }, []);

  /** Enter the room channel; existing participants send us offers. */
  const joinRoom = useCallback(
    async (info: RoomInfo, ringOthers: boolean) => {
      if (!selfId) return;
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: info.mode === "video" });
        streamRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        setError(err instanceof Error ? err.message : "カメラ・マイクを使えませんでした");
        cleanup();
        return;
      }
      const ch = supabase.channel(`room-${info.cid}`, { config: { broadcast: { self: false } } });
      chanRef.current = ch;
      ch.on("broadcast", { event: "join" }, ({ payload }) => {
        const p = payload as { from: string };
        if (p.from === selfId) return;
        const pc = makePeer(p.from);
        void pc
          .createOffer()
          .then((o) => pc.setLocalDescription(o).then(() => roomSend("offer", { to: p.from, sdp: o })));
      })
        .on("broadcast", { event: "offer" }, ({ payload }) => {
          const p = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit };
          if (p.to !== selfId) return;
          gotPeer.current = true;
          const pc = makePeer(p.from);
          void (async () => {
            await pc.setRemoteDescription(p.sdp);
            await drainIce(p.from);
            const a = await pc.createAnswer();
            await pc.setLocalDescription(a);
            roomSend("answer", { to: p.from, sdp: a });
          })();
        })
        .on("broadcast", { event: "answer" }, ({ payload }) => {
          const p = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit };
          if (p.to !== selfId) return;
          const pc = pcs.current.get(p.from);
          if (pc) void pc.setRemoteDescription(p.sdp).then(() => drainIce(p.from));
        })
        .on("broadcast", { event: "ice" }, ({ payload }) => {
          const p = payload as { from: string; to: string; candidate: RTCIceCandidateInit };
          if (p.to !== selfId) return;
          const list = pendingIce.current.get(p.from) ?? [];
          list.push(p.candidate);
          pendingIce.current.set(p.from, list);
          void drainIce(p.from);
        })
        .on("broadcast", { event: "leave" }, ({ payload }) => {
          const id = (payload as { from: string }).from;
          removePeer(id);
          // A 1:1 call ends when the other person leaves.
          const r = roomRef.current;
          if (r && r.memberIds.length <= 2 && pcs.current.size === 0) cleanup();
        })
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          roomSend("join", {});
          if (!ringOthers) return;
          // If nobody answers our join, the call is new: ring everyone else.
          setTimeout(() => {
            if (gotPeer.current || chanRef.current !== ch) return;
            info.memberIds
              .filter((id) => id !== selfId)
              .forEach((id) =>
                sendTo(`ring-${id}`, "invite", { cid: info.cid, mode: info.mode, from: selfId, logId: logRef.current.id }),
              );
          }, 1500);
        });
    },
    [selfId, makePeer, roomSend, drainIce, removePeer, cleanup],
  );

  const start = useCallback(
    (cid: string, mode: Mode) => {
      if (!selfId || phaseRef.current !== "idle") return;
      setPhase("calling");
      void loadRoom(cid, selfId, mode).then((info) => {
        if (!info) return cleanup();
        setRoom(info);
        void supabase
          .from("call_logs")
          .insert({ conversation_id: cid, caller_id: selfId, mode, status: "missed" })
          .select("id")
          .single()
          .then(({ data }) => {
            if (data && !logRef.current.id) logRef.current = { id: data.id, answeredAt: null };
          });
        void joinRoom(info, true);
      });
    },
    [selfId, joinRoom, cleanup],
  );

  const hangup = useCallback(() => {
    const r = roomRef.current;
    roomSend("leave", {});
    if (r && selfId && !gotPeer.current && phaseRef.current === "calling") {
      r.memberIds
        .filter((id) => id !== selfId)
        .forEach((id) => sendTo(`ring-${id}`, "cancel", { cid: r.cid, from: selfId }));
    }
    cleanup();
  }, [roomSend, selfId, cleanup]);

  const accept = useCallback(() => {
    const r = roomRef.current;
    if (!r) return;
    logRef.current = { id: incomingLog.current, answeredAt: null };
    incomingLog.current = null;
    setPhase("calling");
    void joinRoom(r, false);
  }, [joinRoom]);

  const decline = useCallback(() => {
    const id = incomingLog.current;
    if (id) void supabase.from("call_logs").update({ status: "declined" }).eq("id", id).eq("status", "missed");
    incomingLog.current = null;
    setRoom(null);
    setPhase("idle");
  }, []);

  // Personal ring channel: incoming calls arrive wherever you are in PIRA.
  useEffect(() => {
    if (!selfId) return;
    const ch = supabase
      .channel(`ring-${selfId}`)
      .on("broadcast", { event: "invite" }, ({ payload }) => {
        const p = payload as { cid: string; mode: Mode; from: string; logId?: string | null };
        if (phaseRef.current !== "idle") return;
        incomingLog.current = p.logId ?? null;
        void loadRoom(p.cid, selfId, p.mode).then((info) => {
          if (!info || phaseRef.current !== "idle") return;
          if (!info.names[p.from]) return;
          setRoom(info);
          setPhase("incoming");
          const caller = info.names[p.from]?.name ?? info.title;
          if (window.localStorage.getItem(CALL_POPUP_KEY) === "1") {
            try {
              window.focus();
              window.parent?.focus();
            } catch {
              /* ignore */
            }
            if (document.hidden && "Notification" in window && Notification.permission === "granted") {
              const n = new Notification(`PIRA ${p.mode === "video" ? "ビデオ" : "音声"}通話の着信`, {
                body: `${caller} から着信中`,
                requireInteraction: true,
                tag: "pira-call",
              });
              n.onclick = () => {
                window.focus();
                n.close();
              };
            }
          }
        });
      })
      .on("broadcast", { event: "cancel" }, ({ payload }) => {
        const p = payload as { cid: string };
        if (phaseRef.current === "incoming" && roomRef.current?.cid === p.cid) {
          setRoom(null);
          setPhase("idle");
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [selfId]);

  // Ringtone while a call is coming in.
  useEffect(() => {
    if (phase !== "incoming" || flags.notifications_off || !notifySettings.enabled) return;
    void playKind(notifySettings, roomRef.current?.mode === "video" ? "video" : "audio", true);
    return () => stopTone();
  }, [phase, flags.notifications_off, notifySettings]);

  useEffect(() => () => cleanup(), [cleanup]);

  function toggleMute() {
    const s = streamRef.current;
    if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  const showVideo = room?.mode === "video" && phase === "live";
  const isGroup = (room?.memberIds.length ?? 0) > 2;

  return (
    <CallContext.Provider value={{ start, busy: phase !== "idle" }}>
      {children}
      {phase !== "idle" &&
        room &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-background" role="dialog" aria-label="通話画面">
            {!showVideo && room.cover && (
              <>
                <StoredImage path={room.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-background/45" />
              </>
            )}
            {peers.map((p) => (
              <AudioSink key={p.id} stream={p.stream} />
            ))}
            {showVideo ? (
              <div
                className={`relative grid flex-1 gap-1 ${peers.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {peers.map((p) => (
                  <div key={p.id} className="relative min-h-0 overflow-hidden bg-card">
                    <VideoTile stream={p.stream} />
                    <span className="absolute bottom-2 left-2 rounded-full glass-soft px-2 py-0.5 text-xs text-foreground">
                      {room.names[p.id]?.name ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
                <div className={phase === "live" ? "" : "animate-pulse"}>
                  <Avatar path={room.avatar} name={room.title} size={160} />
                </div>
                <p className="font-display text-2xl font-bold text-foreground">{room.title}</p>
                <p className="text-sm text-foreground/80">
                  {phase === "calling"
                    ? "呼び出し中…"
                    : phase === "incoming"
                      ? `${room.mode === "video" ? "ビデオ" : "音声"}通話の着信`
                      : `通話中 ${fmt(seconds)}`}
                </p>
                {isGroup && peers.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {peers.map((p) => (
                      <div key={p.id} className="flex flex-col items-center gap-1">
                        <Avatar path={room.names[p.id]?.avatar} name={room.names[p.id]?.name ?? "?"} size={48} />
                        <span className="text-xs text-foreground">{room.names[p.id]?.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            )}
            {showVideo && (
              <p className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full glass-soft px-3 py-1 text-xs text-foreground">
                {room.title} ・ {fmt(seconds)}
              </p>
            )}
            {room.mode === "video" && localStream && phase !== "incoming" && <SelfView stream={localStream} />}
            <div className="relative flex flex-wrap justify-center gap-3 pb-10 pt-3">
              {phase === "incoming" && (
                <PiraButton onClick={accept}>
                  <Phone size={14} /> 応答する
                </PiraButton>
              )}
              {phase !== "incoming" && (
                <PiraButton variant="soft" onClick={toggleMute}>
                  {muted ? <MicOff size={14} /> : <Mic size={14} />}
                  {muted ? "ミュート解除" : "ミュート"}
                </PiraButton>
              )}
              <PiraButton variant="danger" onClick={phase === "incoming" ? decline : hangup}>
                <PhoneOff size={14} /> {phase === "incoming" ? "拒否" : "終了"}
              </PiraButton>
            </div>
          </div>,
          document.body,
        )}
    </CallContext.Provider>
  );
}

function AudioSink({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

function VideoTile({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="h-full w-full object-cover" />;
}

/** Your own camera preview. Drag to move, drag the corner to resize; saved on this device only. */
function SelfView({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [box, setBox] = useState({ x: 16, y: 16, w: 128 });
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SELFVIEW_KEY) ?? "null");
      if (saved && typeof saved.w === "number") setBox(saved);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  function drag(e: React.PointerEvent, kind: "move" | "size") {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const start = box;
    let latest = box;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      const w = kind === "size" ? Math.min(window.innerWidth * 0.9, Math.max(80, start.w + dx)) : start.w;
      const h = (w * 4) / 3;
      const x = kind === "move" ? Math.min(window.innerWidth - w, Math.max(0, start.x + dx)) : start.x;
      const y = kind === "move" ? Math.min(window.innerHeight - h, Math.max(0, start.y + dy)) : start.y;
      latest = { x, y, w };
      setBox(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.localStorage.setItem(SELFVIEW_KEY, JSON.stringify(latest));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      className="absolute z-10 cursor-move touch-none overflow-hidden rounded-xl ring-2 ring-border"
      style={{ left: box.x, top: box.y, width: box.w, height: (box.w * 4) / 3 }}
      onPointerDown={(e) => drag(e, "move")}
    >
      <video ref={ref} autoPlay playsInline muted className="pointer-events-none h-full w-full -scale-x-100 object-cover" />
      <Move size={12} className="pointer-events-none absolute left-1 top-1 text-foreground/80" />
      <div
        aria-label="大きさを変える"
        className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize rounded-tl-lg bg-foreground/60"
        onPointerDown={(e) => drag(e, "size")}
      />
    </div>
  );
}

/** Call buttons for a chat header. Pressing one in a group with a call in progress joins it. */
export function CallCenter({ conversationId }: { conversationId: string }) {
  const ctx = useContext(CallContext);
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => ctx?.start(conversationId, "audio")}
        aria-label="音声通話"
        className="rounded-full glass-soft p-2 text-foreground"
      >
        <Phone size={16} />
      </button>
      <button
        onClick={() => ctx?.start(conversationId, "video")}
        aria-label="ビデオ通話"
        className="rounded-full glass-soft p-2 text-foreground"
      >
        <Video size={16} />
      </button>
    </div>
  );
}

/** Start (or join) a call from anywhere, e.g. call history or profile pages. */
export function useCall() {
  return useContext(CallContext);
}
