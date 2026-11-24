import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle, Camera, CameraOff, LoaderCircle, Mic, MicOff,
  PhoneOff, Signal, Users, Video
} from "lucide-react";
import { supabase } from "./supabase";
import "./LiveRoom.css";

const ROOM_TOPIC = "worrior-2027-live-room";
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" }
];

function createClientId() {
  return window.crypto?.randomUUID?.() ||
    "member-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}
function getInitials(name = "Member") {
  return name.trim().split(/\s+/).filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase();
}
function describeError(error) {
  if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
    return "Camera or microphone permission was blocked. Allow access in your browser and try again.";
  }
  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
    return "No camera or microphone was found on this device.";
  }
  return error?.message || "The room could not be joined. Please try again.";
}

function VideoTile({ stream, name, muted = false, self = false, state = "" }) {
  const videoRef = useRef(null);
  const hasVideo = Boolean(stream?.getVideoTracks().some(track => track.enabled));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream || null;
    if (stream) video.play().catch(() => {});
    return () => { if (video) video.srcObject = null; };
  }, [stream]);

  return (
    <article className={"live-room-tile " + (self ? "is-self" : "")}>
      <video ref={videoRef} autoPlay playsInline muted={muted}
        className={hasVideo ? "live-room-video" : "live-room-video audio-only"} />
      {!hasVideo && <div className="live-room-avatar">{getInitials(name)}</div>}
      <div className="live-room-tile-caption">
        <span>{name}{self ? " · You" : ""}</span>
        <small>{self ? "Your device" : state || "Connecting…"}</small>
      </div>
    </article>
  );
}

export default function LiveRoom({ profile }) {
  const clientIdRef = useRef(null);
  if (!clientIdRef.current) clientIdRef.current = createClientId();
  const clientId = clientIdRef.current;

  const channelRef = useRef(null);
  const streamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const offersStartedRef = useRef(new Set());
  const mountedRef = useRef(true);

  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [peerStates, setPeerStates] = useState({});
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [status, setStatus] = useState("Ready. Join the room to meet your study group.");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fullName = profile?.full_name || "Member";

  function updatePeerState(peerId, nextState) {
    if (!mountedRef.current) return;
    setPeerStates(current => ({ ...current, [peerId]: nextState }));
    if (nextState === "connected") setStatus("You are connected to your study partner.");
  }

  async function sendSignal(peer, signal) {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.send({
      type: "broadcast",
      event: "signal",
      payload: {
        toClientId: peer.clientId,
        from: { clientId, userId: profile.id, fullName },
        signal
      }
    });
  }

  function closePeer(peerId) {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
    offersStartedRef.current.delete(peerId);
    setRemoteStreams(current => {
      const next = { ...current };
      delete next[peerId];
      return next;
    });
    setPeerStates(current => {
      const next = { ...current };
      delete next[peerId];
      return next;
    });
  }

  function getPeerConnection(peer) {
    const existing = peerConnectionsRef.current.get(peer.clientId);
    if (existing && existing.connectionState !== "closed") return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionsRef.current.set(peer.clientId, pc);

    const local = streamRef.current;
    if (local) local.getTracks().forEach(track => pc.addTrack(track, local));

    pc.onicecandidate = event => {
      if (event.candidate) {
        sendSignal(peer, { type: "candidate", candidate: event.candidate.toJSON() })
          .catch(err => console.warn("Could not send ICE candidate:", err));
      }
    };
    pc.ontrack = event => {
      const incoming = event.streams?.[0] || new MediaStream([event.track]);
      setRemoteStreams(current => ({ ...current, [peer.clientId]: incoming }));
    };
    pc.onconnectionstatechange = () => updatePeerState(peer.clientId, pc.connectionState);
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") updatePeerState(peer.clientId, "network connection failed");
    };
    updatePeerState(peer.clientId, "connecting");
    return pc;
  }

  async function flushCandidates(peerId, pc) {
    const queued = pendingCandidatesRef.current.get(peerId) || [];
    pendingCandidatesRef.current.delete(peerId);
    for (const candidate of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (err) { console.warn("Could not add queued network candidate:", err); }
    }
  }

  async function handleSignal(eventData) {
    const message = eventData?.payload || eventData;
    if (!message || message.toClientId !== clientId || !message.from || !message.signal) return;

    const peer = message.from;
    const signal = message.signal;
    try {
      const pc = getPeerConnection(peer);
      if (signal.type === "offer") {
        await pc.setRemoteDescription(signal.sdp);
        await flushCandidates(peer.clientId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(peer, { type: "answer", sdp: pc.localDescription });
      } else if (signal.type === "answer") {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(signal.sdp);
          await flushCandidates(peer.clientId, pc);
        }
      } else if (signal.type === "candidate" && signal.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          const pending = pendingCandidatesRef.current.get(peer.clientId) || [];
          pending.push(signal.candidate);
          pendingCandidatesRef.current.set(peer.clientId, pending);
        }
      }
    } catch (err) {
      console.error("Live Room signalling failed:", err);
      updatePeerState(peer.clientId, "connection error");
    }
  }

  async function startOffer(peer) {
    // A deterministic initiator prevents both members offering at once.
    if (clientId.localeCompare(peer.clientId) >= 0) return;
    if (offersStartedRef.current.has(peer.clientId)) return;
    offersStartedRef.current.add(peer.clientId);
    try {
      const pc = getPeerConnection(peer);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(peer, { type: "offer", sdp: pc.localDescription });
    } catch (err) {
      console.error("Could not start peer connection:", err);
      updatePeerState(peer.clientId, "connection error");
    }
  }

  function syncPresence() {
    const channel = channelRef.current;
    if (!channel) return;

    const entries = Object.values(channel.presenceState()).flat().filter(item => item?.clientId);
    const unique = new Map(entries.map(item => [item.clientId, item]));
    const all = [...unique.values()];
    const otherMembers = all.filter(item => item.clientId !== clientId);
    const own = { clientId, userId: profile.id, fullName, isSelf: true };

    setParticipants([own, ...otherMembers]);
    for (const peer of otherMembers) startOffer(peer).catch(console.error);

    const onlineIds = new Set(otherMembers.map(item => item.clientId));
    for (const peerId of peerConnectionsRef.current.keys()) {
      if (!onlineIds.has(peerId)) closePeer(peerId);
    }

    setStatus(otherMembers.length
      ? "A member has joined. Connecting audio and video…"
      : "You are in the room. Waiting for another member to join…");
  }

  async function stopMedia() {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (mountedRef.current) setLocalStream(null);
  }

  async function leaveRoom() {
    const channel = channelRef.current;
    channelRef.current = null;

    for (const peerId of [...peerConnectionsRef.current.keys()]) closePeer(peerId);
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    offersStartedRef.current.clear();

    if (channel) {
      try { await channel.untrack(); } catch {}
      try { await supabase.removeChannel(channel); } catch {}
    }
    await stopMedia();

    if (mountedRef.current) {
      setJoined(false);
      setJoining(false);
      setParticipants([]);
      setPeerStates({});
      setRemoteStreams({});
      setMicOn(true);
      setCameraOn(true);
      setStatus("You left the live room.");
    }
  }

  async function joinRoom() {
    if (joining || joined) return;
    setJoining(true);
    setError("");
    setNotice("");
    setStatus("Requesting access to your camera and microphone…");

    let stream = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera and microphone access requires HTTPS and a supported browser.");
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 24 } }
        });
      } catch (cameraError) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setNotice("Camera unavailable or permission denied. You joined with microphone audio only.");
      }

      streamRef.current = stream;
      setLocalStream(stream);
      setMicOn(stream.getAudioTracks().some(track => track.enabled));
      setCameraOn(stream.getVideoTracks().some(track => track.enabled));
      setStatus("Joining the private WORRIOR room…");

      const channel = supabase.channel(ROOM_TOPIC, {
        config: {
          private: true,
          presence: { key: clientId },
          broadcast: { ack: true, self: false }
        }
      });
      channelRef.current = channel;
      channel
        .on("presence", { event: "sync" }, syncPresence)
        .on("broadcast", { event: "signal" }, handleSignal);

      await new Promise((resolve, reject) => {
        let settled = false;
        channel.subscribe((state, subscribeError) => {
          if (state === "SUBSCRIBED" && !settled) {
            settled = true;
            resolve();
          } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state) && !settled) {
            settled = true;
            reject(subscribeError || new Error("Private room access failed. Refresh and sign in again."));
          }
        });
      });

      const tracked = await channel.track({
        clientId, userId: profile.id, fullName, joinedAt: new Date().toISOString()
      });
      if (tracked !== "ok") throw new Error("Your presence could not be registered. Please try again.");

      if (mountedRef.current) {
        setJoined(true);
        setJoining(false);
        syncPresence();
      }
    } catch (err) {
      console.error("Live Room join failed:", err);
      if (stream) stream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) {
        try { await supabase.removeChannel(channel); } catch {}
      }
      if (mountedRef.current) {
        setLocalStream(null);
        setJoining(false);
        setJoined(false);
        setError(describeError(err));
        setStatus("Could not join the room.");
      }
    }
  }

  function toggleMicrophone() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }
  function toggleCamera() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) {
      setNotice("No camera video track is available on this device.");
      return;
    }
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const channel = channelRef.current;
      channelRef.current = null;
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const remoteMembers = participants.filter(item => !item.isSelf);

  return (
    <section className="live-room-page">
      <div className="live-room-heading">
        <div>
          <p className="eyebrow">LIVE COLLABORATION</p>
          <h1>WORRIOR Live Room</h1>
          <p className="muted">Join the room. When a second member arrives, both connect automatically.</p>
        </div>
        <div className={"live-room-live-pill " + (joined ? "active" : "")}>
          <span /> {joined ? "IN THE ROOM" : "PRIVATE ROOM"}
        </div>
      </div>

      <div className="live-room-info panel">
        <div className="live-room-info-icon"><Signal size={20} /></div>
        <div className="live-room-info-copy">
          <strong>One shared study room</strong>
          <p>No waiting room and no Admit button. Only signed-in WORRIOR members can enter.</p>
        </div>
        <div className="live-room-count"><Users size={17} /> {participants.length} here</div>
      </div>

      {error && <div className="live-room-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <p className="live-room-notice">{notice}</p>}

      {joined ? (
        <>
          <div className="live-room-status panel">
            <span className="live-room-status-dot" /><span>{status}</span>
          </div>
          <div className="live-room-grid">
            <VideoTile stream={localStream} name={fullName} muted self />
            {remoteMembers.map(person => (
              <VideoTile
                key={person.clientId}
                stream={remoteStreams[person.clientId]}
                name={person.fullName || "Member"}
                state={peerStates[person.clientId] || "Connecting…"}
              />
            ))}
            {!remoteMembers.length && (
              <div className="live-room-waiting">
                <div><Users size={27} /></div>
                <strong>Waiting for your study partner</strong>
                <p>Keep this page open. The next member will connect automatically.</p>
              </div>
            )}
          </div>
          <div className="live-room-controls panel">
            <button className="btn secondary" type="button" onClick={toggleMicrophone} disabled={!localStream?.getAudioTracks().length}>
              {micOn ? <Mic size={17} /> : <MicOff size={17} />} {micOn ? "Mute microphone" : "Unmute microphone"}
            </button>
            <button className="btn secondary" type="button" onClick={toggleCamera} disabled={!localStream?.getVideoTracks().length}>
              {cameraOn ? <Camera size={17} /> : <CameraOff size={17} />} {cameraOn ? "Turn camera off" : "Turn camera on"}
            </button>
            <button className="btn danger" type="button" onClick={leaveRoom}>
              <PhoneOff size={17} /> Leave room
            </button>
          </div>
        </>
      ) : (
        <div className="live-room-lobby panel">
          <div className="live-room-lobby-icon"><Video size={32} /></div>
          <h2>Ready when you are</h2>
          <p>Your camera and microphone start only after you click Join and approve the browser prompt. Keep the page open; the second member will connect automatically.</p>
          <button className="btn primary live-room-join" type="button" onClick={joinRoom} disabled={joining}>
            {joining ? <LoaderCircle size={18} className="live-room-spinner" /> : <Video size={18} />}
            {joining ? "Joining room…" : "Join live room"}
          </button>
          <small>Private to signed-in WORRIOR members. You can mute your microphone or turn off your camera at any time.</small>
        </div>
      )}

      <p className="live-room-footnote">Audio and video travel peer-to-peer and are not saved in the study database. Network restrictions may require a TURN relay for reliable connections on some networks.</p>
    </section>
  );
}
