/**
 * @file WebRTC peer-to-peer mesh for voice/video/screen-share.
 *
 * Each participant maintains one RTCPeerConnection per remote peer (full mesh).
 * Signaling (offer/answer/ICE) flows through the existing sshx WS relay via
 * Signal messages. Media tracks go peer-to-peer (or via TURN when NAT blocks).
 *
 * Fixes (2026-07-23 camera black):
 *   - Queue ICE candidates until remote description is set (was drop → black video)
 *   - Perfect negotiation / glare: only the higher UID is impolite offerer
 *   - Fleet TURN (coturn) ahead of public openrelay
 *   - addTrack(track, stream) so receivers get a real MediaStream
 *   - iceConnectionState failed → restartIce + status callback
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

export type OnPeerStateCallback = (
  uid: number,
  state: RTCIceConnectionState | "closed",
) => void;

export type SendSignal = (target: number, payload: string) => void;

export type RtcConfig = {
  iceServers: RTCIceServer[];
};

/**
 * ICE servers: fleet coturn first (works behind symmetric/double NAT),
 * then public STUN, then openrelay as last-resort TURN.
 * Credentials are already public in browser bundles for board media.
 */
const DEFAULT_CONFIG: RtcConfig = {
  iceServers: [
    // Fleet coturn (public IP) — primary relay for cross-house boards
    {
      urls: [
        "turn:103.208.27.171:3478?transport=udp",
        "turn:103.208.27.171:3478?transport=tcp",
      ],
      username: "oracle",
      credential: "phd-turn-key-e9aae52e-2026",
    },
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turns:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

type PeerSlot = {
  pc: RTCPeerConnection;
  /** ICE candidates that arrived before setRemoteDescription completed. */
  pendingIce: RTCIceCandidateInit[];
  makingOffer: boolean;
  ignoreOffer: boolean;
  /** Local MediaStream holding tracks we send (required for addTrack 2-arg). */
  outbound: MediaStream;
};

export class RtcMesh {
  readonly myUid: number;
  private peers = new Map<number, PeerSlot>();
  private sendSignal: SendSignal;
  private onTrack: OnTrackCallback;
  private onPeerState: OnPeerStateCallback | null;
  private config: RtcConfig;
  private localTracks: MediaStreamTrack[] = [];
  private negotiateTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private disposed = false;

  constructor(
    myUid: number,
    sendSignal: SendSignal,
    onTrack: OnTrackCallback,
    config?: Partial<RtcConfig>,
    onPeerState?: OnPeerStateCallback,
  ) {
    this.myUid = myUid;
    this.sendSignal = sendSignal;
    this.onTrack = onTrack;
    this.onPeerState = onPeerState ?? null;
    this.config = {
      iceServers: config?.iceServers ?? DEFAULT_CONFIG.iceServers,
    };
  }

  /** Higher UID is the impolite peer (always offers / wins glare). */
  private isPolite(remoteUid: number): boolean {
    return this.myUid < remoteUid;
  }

  /** Add a peer and optionally initiate the connection (caller = higher UID). */
  addPeer(uid: number) {
    if (uid === this.myUid || this.peers.has(uid)) return;
    const slot = this.createPeerSlot(uid);
    this.peers.set(uid, slot);

    for (const track of this.localTracks) {
      this.attachLocalTrack(slot, track);
    }

    // Impolite (higher UID) initiates the first offer.
    if (!this.isPolite(uid)) {
      this.scheduleNegotiate(uid);
    }
  }

  /** Remove a peer (user left). */
  removePeer(uid: number) {
    const slot = this.peers.get(uid);
    if (slot) {
      slot.pc.close();
      this.peers.delete(uid);
      this.onPeerState?.(uid, "closed");
    }
    const timer = this.negotiateTimers.get(uid);
    if (timer) {
      clearTimeout(timer);
      this.negotiateTimers.delete(uid);
    }
  }

  /** Handle an incoming signaling message from the WS relay. */
  async handleSignal(from: number, payloadJson: string) {
    if (this.disposed) return;
    let payload: SignalPayload;
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      return;
    }

    let slot = this.peers.get(from);
    if (!slot) {
      // Remote peer initiated before we knew about them — create lazily.
      slot = this.createPeerSlot(from);
      this.peers.set(from, slot);
      for (const track of this.localTracks) {
        this.attachLocalTrack(slot, track);
      }
    }

    const pc = slot.pc;

    try {
      if (payload.type === "offer") {
        const offerCollision =
          slot.makingOffer || pc.signalingState !== "stable";
        // Impolite peer ignores colliding remote offers (perfect negotiation).
        slot.ignoreOffer = !this.isPolite(from) && offerCollision;
        if (slot.ignoreOffer) return;

        await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
        await this.flushPendingIce(slot);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(
          from,
          JSON.stringify({ type: "answer", sdp: answer.sdp }),
        );
      } else if (payload.type === "answer") {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
          await this.flushPendingIce(slot);
        }
      } else if (payload.type === "ice") {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(payload.candidate).catch(() => {});
        } else {
          slot.pendingIce.push(payload.candidate);
        }
      } else if (payload.type === "negotiate") {
        // Remote asked us to (re)offer if we are the impolite peer.
        if (!this.isPolite(from)) {
          this.scheduleNegotiate(from);
        }
      }
    } catch (err) {
      console.warn("[rtc] handleSignal error", from, payload.type, err);
    }
  }

  /** Add a local media track (mic, camera, screen) to all current + future peers. */
  addTrack(track: MediaStreamTrack) {
    if (this.localTracks.includes(track)) return;
    this.localTracks.push(track);
    for (const [uid, slot] of this.peers) {
      this.attachLocalTrack(slot, track);
      this.scheduleNegotiate(uid);
    }
  }

  /** Remove a local media track from all peers. */
  removeTrack(track: MediaStreamTrack) {
    this.localTracks = this.localTracks.filter((t) => t !== track);
    for (const [uid, slot] of this.peers) {
      const sender = slot.pc.getSenders().find((s) => s.track === track);
      if (sender) slot.pc.removeTrack(sender);
      try {
        slot.outbound.removeTrack(track);
      } catch {
        /* already gone */
      }
      this.scheduleNegotiate(uid);
    }
  }

  /**
   * Debounced renegotiation. Adding video + audio back-to-back (e.g. camera +
   * auto-mic) would otherwise fire two offers while the first is still in
   * flight, producing SDP m-line ordering errors. Coalescing into one offer —
   * and only offering from a stable signaling state — avoids the glare.
   */
  private scheduleNegotiate(uid: number) {
    const existing = this.negotiateTimers.get(uid);
    if (existing) clearTimeout(existing);
    this.negotiateTimers.set(
      uid,
      setTimeout(() => {
        this.negotiateTimers.delete(uid);
        void this.createOffer(uid);
      }, 80),
    );
  }

  /** Tear down all peer connections. */
  dispose() {
    this.disposed = true;
    for (const timer of this.negotiateTimers.values()) clearTimeout(timer);
    this.negotiateTimers.clear();
    for (const [uid, slot] of this.peers) {
      slot.pc.close();
      this.onPeerState?.(uid, "closed");
    }
    this.peers.clear();
    this.localTracks = [];
  }

  /** ICE connection state for a peer (for UI). */
  getIceState(uid: number): RTCIceConnectionState | null {
    return this.peers.get(uid)?.pc.iceConnectionState ?? null;
  }

  private attachLocalTrack(slot: PeerSlot, track: MediaStreamTrack) {
    // Skip if already sending this track.
    if (slot.pc.getSenders().some((s) => s.track === track)) return;
    try {
      slot.outbound.addTrack(track);
    } catch {
      /* duplicate on stream */
    }
    // Two-arg form gives the remote side a proper MediaStream in ontrack.
    slot.pc.addTrack(track, slot.outbound);
  }

  private async flushPendingIce(slot: PeerSlot) {
    const pending = slot.pendingIce.splice(0, slot.pendingIce.length);
    for (const c of pending) {
      await slot.pc.addIceCandidate(c).catch(() => {});
    }
  }

  private createPeerSlot(uid: number): PeerSlot {
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      // Prefer relay when available so cross-NAT boards don't stick on host.
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    const slot: PeerSlot = {
      pc,
      pendingIce: [],
      makingOffer: false,
      ignoreOffer: false,
      outbound: new MediaStream(),
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && !this.disposed) {
        this.sendSignal(
          uid,
          JSON.stringify({ type: "ice", candidate: event.candidate.toJSON() }),
        );
      }
    };

    pc.ontrack = (event) => {
      if (this.disposed) return;
      this.onTrack(uid, event.track, event.streams);
      // Some browsers fire track muted until first packet — re-notify on unmute.
      event.track.addEventListener("unmute", () => {
        if (!this.disposed) {
          this.onTrack(uid, event.track, event.streams);
        }
      });
    };

    pc.oniceconnectionstatechange = () => {
      if (this.disposed) return;
      const st = pc.iceConnectionState;
      this.onPeerState?.(uid, st);
      if (st === "failed") {
        try {
          pc.restartIce();
          // Ask the impolite side to re-offer after ICE restart.
          if (!this.isPolite(uid)) {
            this.scheduleNegotiate(uid);
          } else {
            this.sendSignal(uid, JSON.stringify({ type: "negotiate" }));
          }
        } catch {
          /* ignore */
        }
      }
    };

    pc.onnegotiationneeded = () => {
      if (this.disposed) return;
      // Only impolite peer drives offers from negotiationneeded.
      if (!this.isPolite(uid)) {
        this.scheduleNegotiate(uid);
      }
    };

    return slot;
  }

  private async createOffer(uid: number) {
    const slot = this.peers.get(uid);
    if (!slot || this.disposed) return;
    const pc = slot.pc;

    // Perfect negotiation: only impolite peer creates offers.
    if (this.isPolite(uid)) return;

    if (pc.signalingState !== "stable") {
      this.scheduleNegotiate(uid);
      return;
    }

    try {
      slot.makingOffer = true;
      const offer = await pc.createOffer();
      // Raced while awaiting?
      if (pc.signalingState !== "stable") return;
      await pc.setLocalDescription(offer);
      this.sendSignal(uid, JSON.stringify({ type: "offer", sdp: offer.sdp }));
    } catch (err) {
      console.warn("[rtc] createOffer failed", uid, err);
    } finally {
      slot.makingOffer = false;
    }
  }
}
