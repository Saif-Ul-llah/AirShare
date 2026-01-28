import { WEBRTC_CONFIG, DATA_CHANNEL_CONFIG } from '@airshare/shared';
import type { PeerConfig, SignalMessage, SignalHandler, DataHandler, StateHandler, PeerState } from './types';

export class PeerConnection {
  private pc: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private config: PeerConfig;
  private onSignal: SignalHandler;
  private onData: DataHandler | null = null;
  private onStateChange: StateHandler | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isNegotiating = false;

  constructor(config: PeerConfig, onSignal: SignalHandler) {
    this.config = config;
    this.onSignal = onSignal;

    this.pc = new RTCPeerConnection({
      ...WEBRTC_CONFIG,
      iceServers: config.iceServers || WEBRTC_CONFIG.iceServers,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onSignal({
          type: 'ice-candidate',
          from: this.config.peerId,
          to: '', // Will be set by caller
          roomCode: this.config.roomCode,
          payload: event.candidate.toJSON(),
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.notifyStateChange();
    };

    this.pc.onnegotiationneeded = async () => {
      if (this.isNegotiating) return;
      this.isNegotiating = true;

      try {
        await this.createOffer();
      } finally {
        this.isNegotiating = false;
      }
    };

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
  }

  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      this.notifyStateChange();
    };

    this.dataChannel.onclose = () => {
      this.notifyStateChange();
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.notifyStateChange();
    };

    this.dataChannel.onmessage = (event) => {
      if (this.onData) {
        this.onData(event.data);
      }
    };
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  /**
   * Create a data channel and offer (as initiator)
   */
  async createOffer(targetPeerId?: string): Promise<SignalMessage> {
    // Create data channel before offer
    this.dataChannel = this.pc.createDataChannel('file-transfer', DATA_CHANNEL_CONFIG);
    this.setupDataChannel();

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const signal: SignalMessage = {
      type: 'offer',
      from: this.config.peerId,
      to: targetPeerId || '',
      roomCode: this.config.roomCode,
      payload: offer,
    };

    return signal;
  }

  /**
   * Handle incoming offer and create answer
   */
  async handleOffer(signal: SignalMessage): Promise<SignalMessage> {
    if (signal.payload && 'sdp' in signal.payload) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
    }

    // Process any pending ICE candidates
    await this.processPendingCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return {
      type: 'answer',
      from: this.config.peerId,
      to: signal.from,
      roomCode: this.config.roomCode,
      payload: answer,
    };
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(signal: SignalMessage): Promise<void> {
    if (signal.payload && 'sdp' in signal.payload) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
    }

    // Process any pending ICE candidates
    await this.processPendingCandidates();
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleIceCandidate(signal: SignalMessage): Promise<void> {
    if (!signal.payload) return;

    // If remote description isn't set yet, queue the candidate
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(signal.payload as RTCIceCandidateInit);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  private async processPendingCandidates(): Promise<void> {
    for (const candidate of this.pendingCandidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding pending ICE candidate:', error);
      }
    }
    this.pendingCandidates = [];
  }

  /**
   * Send data through the data channel
   */
  send(data: ArrayBuffer | string): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }

    try {
      this.dataChannel.send(data);
      return true;
    } catch (error) {
      console.error('Error sending data:', error);
      return false;
    }
  }

  /**
   * Send data with flow control (for large transfers)
   */
  async sendWithFlowControl(data: ArrayBuffer): Promise<boolean> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }

    const BUFFER_THRESHOLD = 64 * 1024; // 64KB

    return new Promise((resolve) => {
      const trySend = () => {
        if (!this.dataChannel) {
          resolve(false);
          return;
        }

        if (this.dataChannel.bufferedAmount < BUFFER_THRESHOLD) {
          try {
            this.dataChannel.send(data);
            resolve(true);
          } catch {
            resolve(false);
          }
        } else {
          // Wait for buffer to drain
          setTimeout(trySend, 10);
        }
      };

      trySend();
    });
  }

  /**
   * Set data handler
   */
  setOnData(handler: DataHandler): void {
    this.onData = handler;
  }

  /**
   * Set state change handler
   */
  setOnStateChange(handler: StateHandler): void {
    this.onStateChange = handler;
  }

  /**
   * Get current peer state
   */
  getState(): PeerState {
    return {
      peerId: this.config.peerId,
      connectionState: this.pc.connectionState,
      dataChannelState: this.dataChannel?.readyState || null,
    };
  }

  /**
   * Check if data channel is open and ready
   */
  isReady(): boolean {
    return (
      this.pc.connectionState === 'connected' &&
      this.dataChannel?.readyState === 'open'
    );
  }

  /**
   * Get buffered amount (for flow control)
   */
  getBufferedAmount(): number {
    return this.dataChannel?.bufferedAmount || 0;
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.pc.close();
  }
}
