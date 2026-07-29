/**
 * @file WebRTC peer-to-peer mesh for voice/video/screen-share.
 *
 * Each participant maintains one RTCPeerConnection per remote peer (full mesh).
 * Signaling (offer/answer/ICE) flows through the existing sshx WS relay via
 * Signal messages. Media tracks go peer-to-peer (or via TURN when NAT blocks).
 *
 * ICE servers are build-time configurable via Vite env.
 */

type SignalPayload =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: RTCIceCandidateInit }
  | { type: "negotiate" };

export type OnTrackCallback = (
  uid: number,
  track: MediaStreamTrack,
  streams: readonly MediaStream[],
) => void;

export type SendSignal = (target: number, payload: string) => void;

export type RtcConfig = {
  iceServers: RTCIceServer[];
};

const DEFAULT_CONFIG: RtcConfig = {
  iceServers: iceServersFromEnv(),
};

function splitUrls(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

function parseIceServersJson(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const parsed = JSON.parse(value) as { iceServers?: RTCIceServer[] };
    return Array.isArray(parsed) ? parsed : parsed.iceServers ?? null;
  } catch {
    return null;
  }
}

function iceServersFromEnv(env = import.meta.env): RTCIceServer[] {
  const jsonServers = parseIceServersJson(env.VITE_RTC_ICE_SERVERS);
  if (jsonServers) return jsonServers;

  const iceServers: RTCIceServer[] = [];
  const stunUrls = splitUrls(env.VITE_RTC_STUN_URLS);
  if (stunUrls.length) iceServers.push({ urls: stunUrls });

  const turnUrls = splitUrls(env.VITE_RTC_TURN_URLS);
  if (turnUrls.length) {
    iceServers.push({
      urls: turnUrls,
      username: env.VITE_RTC_TURN_USERNAME,
      credential: env.VITE_RTC_TURN_CREDENTIAL,
    });
  }

  return iceServers;
}

export class RtcMesh {
  readonly myUid: number;
  private peers = new Map<number, RTCPeerConnection>();
  private sendSignal: SendSignal;
  private onTrack: OnTrackCallback;
  private config: RtcConfig;
  private localTracks: MediaStreamTrack[] = [];
  private negotiateTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private disposed = false;

  constructor(
    myUid: number,
    sendSignal: SendSignal,
    onTrack: OnTrackCallback,
    config?: Partial<RtcConfig>,
  ) {
    this.myUid = myUid;
    this.sendSignal = sendSignal;
    this.onTrack = onTrack;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Add a peer and optionally initiate the connection (caller = higher UID). */
  addPeer(uid: number) {
    if (uid === this.myUid || this.peers.has(uid)) return;
    const pc = this.createPeerConnection(uid);
    this.peers.set(uid, pc);

    // Add any existing local tracks to the new peer connection.
    for (const track of this.localTracks) {
      pc.addTrack(track);
    }

    // Higher UID initiates the offer (deterministic tie-breaking).
    if (this.myUid > uid) {
      this.createOffer(uid, pc);
    }
  }

  /** Remove a peer (user left). */
  removePeer(uid: number) {
    const pc = this.peers.get(uid);
    if (pc) {
      pc.close();
      this.peers.delete(uid);
    }
  }

  /** Handle an incoming signaling message from the WS relay. */
  async handleSignal(from: number, payloadJson: string) {
    let payload: SignalPayload;
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      return;
    }

    let pc = this.peers.get(from);
    if (!pc) {
      // Remote peer initiated before we knew about them — create lazily.
      pc = this.createPeerConnection(from);
      this.peers.set(from, pc);
      for (const track of this.localTracks) {
        pc.addTrack(track);
      }
    }

    if (payload.type === "offer") {
      await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal(
        from,
        JSON.stringify({ type: "answer", sdp: answer.sdp }),
      );
    } else if (payload.type === "answer") {
      await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
    } else if (payload.type === "ice") {
      await pc.addIceCandidate(payload.candidate).catch(() => {});
    } else if (payload.type === "negotiate") {
      if (this.myUid > from) {
        await this.createOffer(from, pc);
      }
    }
  }

  /** Add a local media track (mic, camera, screen) to all current + future peers. */
  addTrack(track: MediaStreamTrack) {
    this.localTracks.push(track);
    for (const [uid, pc] of this.peers) {
      pc.addTrack(track);
      this.scheduleNegotiate(uid, pc);
    }
  }

  /** Remove a local media track from all peers. */
  removeTrack(track: MediaStreamTrack) {
    this.localTracks = this.localTracks.filter((t) => t !== track);
    for (const [uid, pc] of this.peers) {
      const sender = pc.getSenders().find((s) => s.track === track);
      if (sender) pc.removeTrack(sender);
      this.scheduleNegotiate(uid, pc);
    }
  }

  /**
   * Debounced renegotiation. Adding video + audio back-to-back (e.g. camera +
   * auto-mic) would otherwise fire two offers while the first is still in
   * flight, producing SDP m-line ordering errors. Coalescing into one offer —
   * and only offering from a stable signaling state — avoids the glare.
   */
  private scheduleNegotiate(uid: number, pc: RTCPeerConnection) {
    const existing = this.negotiateTimers.get(uid);
    if (existing) clearTimeout(existing);
    this.negotiateTimers.set(
      uid,
      setTimeout(() => {
        this.negotiateTimers.delete(uid);
        this.createOffer(uid, pc);
      }, 60),
    );
  }

  /** Tear down all peer connections. */
  dispose() {
    this.disposed = true;
    for (const timer of this.negotiateTimers.values()) clearTimeout(timer);
    this.negotiateTimers.clear();
    for (const [, pc] of this.peers) {
      pc.close();
    }
    this.peers.clear();
    this.localTracks = [];
  }

  private createPeerConnection(uid: number): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && !this.disposed) {
        this.sendSignal(
          uid,
          JSON.stringify({ type: "ice", candidate: event.candidate.toJSON() }),
        );
      }
    };

    pc.ontrack = (event) => {
      if (!this.disposed) {
        this.onTrack(uid, event.track, event.streams);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    return pc;
  }

  private async createOffer(uid: number, pc: RTCPeerConnection) {
    // Only offer from a stable state — otherwise an in-flight negotiation is
    // still settling; retry once it completes (avoids SDP m-line errors).
    if (pc.signalingState !== "stable") {
      this.scheduleNegotiate(uid, pc);
      return;
    }
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== "stable") return; // raced while awaiting
      await pc.setLocalDescription(offer);
      this.sendSignal(uid, JSON.stringify({ type: "offer", sdp: offer.sdp }));
    } catch {
      // Transient negotiation error — a later track change will renegotiate.
    }
  }
}
