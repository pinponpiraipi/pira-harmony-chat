import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video, Mic, MicOff } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, PiraButton } from "./ui";

type Mode = "audio" | "video";
type CallState = "idle" | "calling" | "incoming" | "live";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }],
};

/** Voice / video calling for one conversation, signalled over a realtime channel. */
export function CallCenter({
  conversationId,
  selfId,
  title,
  avatarPath,
}: {
  conversationId: string;
  selfId: string;
  title: string;
  avatarPath?: string | null;
}) {
  const chanRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const [state, setState] = useState<CallState>("idle");
  const [mode, setMode] = useState<Mode>("audio");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      void chanRef.current?.send({ type: "broadcast", event, payload: { from: selfId, ...payload } });
    },
    [selfId],
  );

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pendingOffer.current = null;
    pendingIce.current = [];
    setMuted(false);
    setState("idle");
  }, []);

  const attachRemote = useCallback((stream: MediaStream) => {
    if (remoteVideo.current) remoteVideo.current.srcObject = stream;
    if (remoteAudio.current) remoteAudio.current.srcObject = stream;
  }, []);

  const createPeer = useCallback(
    async (m: Mode) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: m === "video",
      });
      streamRef.current = stream;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate) send("ice", { candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        const [remote] = e.streams;
        if (remote) attachRemote(remote);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") cleanup();
      };
      pcRef.current = pc;
      return pc;
    },
    [attachRemote, cleanup, send],
  );

  const drainIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const list = pendingIce.current;
    pendingIce.current = [];
    for (const c of list) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore late candidates */
      }
    }
  }, []);

  useEffect(() => {
    const channel = supabase.channel(`call-${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    chanRef.current = channel;
    channel
      .on("broadcast", { event: "offer" }, ({ payload }) => {
        const p = payload as { from: string; mode: Mode; sdp: RTCSessionDescriptionInit };
        if (p.from === selfId || pcRef.current) return;
        pendingOffer.current = p.sdp;
        setMode(p.mode);
        setState("incoming");
      })
      .on("broadcast", { event: "answer" }, ({ payload }) => {
        const p = payload as { from: string; sdp: RTCSessionDescriptionInit };
        if (p.from === selfId) return;
        const pc = pcRef.current;
        if (!pc) return;
        void pc
          .setRemoteDescription(p.sdp)
          .then(drainIce)
          .then(() => setState("live"));
      })
      .on("broadcast", { event: "ice" }, ({ payload }) => {
        const p = payload as { from: string; candidate: RTCIceCandidateInit };
        if (p.from === selfId) return;
        pendingIce.current.push(p.candidate);
        void drainIce();
      })
      .on("broadcast", { event: "hangup" }, ({ payload }) => {
        if ((payload as { from: string }).from === selfId) return;
        cleanup();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      chanRef.current = null;
    };
  }, [conversationId, selfId, cleanup, drainIce]);

  useEffect(() => {
    return () => {
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Local preview appears only once the overlay is mounted.
  useEffect(() => {
    if (localVideo.current && streamRef.current) localVideo.current.srcObject = streamRef.current;
  }, [state, mode]);

  async function startCall(m: Mode) {
    setError(null);
    setMode(m);
    setState("calling");
    try {
      const pc = await createPeer(m);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send("offer", { mode: m, sdp: offer });
    } catch (err) {
      setError(err instanceof Error ? err.message : "カメラ・マイクを使えませんでした");
      cleanup();
    }
  }

  async function accept() {
    const sdp = pendingOffer.current;
    if (!sdp) return;
    setError(null);
    try {
      const pc = await createPeer(mode);
      await pc.setRemoteDescription(sdp);
      await drainIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send("answer", { sdp: answer });
      pendingOffer.current = null;
      setState("live");
    } catch (err) {
      setError(err instanceof Error ? err.message : "カメラ・マイクを使えませんでした");
      cleanup();
    }
  }

  function hangup() {
    send("hangup", {});
    cleanup();
  }

  function toggleMute() {
    const stream = streamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void startCall("audio")}
          aria-label="音声通話をかける"
          className="rounded-full glass-soft p-2 text-foreground"
        >
          <Phone size={16} />
        </button>
        <button
          onClick={() => void startCall("video")}
          aria-label="ビデオ通話をかける"
          className="rounded-full glass-soft p-2 text-foreground"
        >
          <Video size={16} />
        </button>
      </div>

      {state !== "idle" && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {mode === "video" && (
            <video
              ref={remoteVideo}
              autoPlay
              playsInline
              className={`absolute inset-0 h-full w-full object-cover ${state === "live" ? "" : "opacity-0"}`}
            />
          )}
          <audio ref={remoteAudio} autoPlay />
          <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
            {!(mode === "video" && state === "live") && (
              <>
                <div className={state === "live" ? "" : "animate-pulse"}>
                  <Avatar path={avatarPath} name={title} size={160} />
                </div>
                <p className="font-display text-2xl font-bold text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">
                  {state === "calling"
                    ? "呼び出し中…"
                    : state === "incoming"
                      ? `${mode === "video" ? "ビデオ" : "音声"}通話の着信`
                      : "通話中"}
                </p>
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          {mode === "video" && (
            <video
              ref={localVideo}
              autoPlay
              playsInline
              muted
              className="absolute right-4 top-4 h-40 w-28 rounded-xl object-cover ring-2 ring-border"
            />
          )}
          <div className="relative flex flex-wrap justify-center gap-3 pb-10">
            {state === "incoming" && (
              <PiraButton onClick={() => void accept()}>
                <Phone size={14} /> 応答する
              </PiraButton>
            )}
            {state === "live" && (
              <PiraButton variant="soft" onClick={toggleMute}>
                {muted ? <MicOff size={14} /> : <Mic size={14} />}
                {muted ? "ミュート解除" : "ミュート"}
              </PiraButton>
            )}
            <PiraButton variant="danger" onClick={hangup}>
              <PhoneOff size={14} /> {state === "incoming" ? "拒否" : "終了"}
            </PiraButton>
          </div>
        </div>
      )}
    </>
  );
}
