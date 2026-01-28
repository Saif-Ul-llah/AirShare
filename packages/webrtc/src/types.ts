export interface PeerConfig {
  peerId: string;
  roomCode: string;
  iceServers?: RTCIceServer[];
}

export interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;
  to: string;
  roomCode: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
}

export interface TransferMetadata {
  transferId: string;
  filename: string;
  size: number;
  mimeType: string;
  encrypted: boolean;
  encryptionIV?: string;
  checksum: string;
  totalChunks: number;
}

export interface TransferChunk {
  transferId: string;
  index: number;
  data: ArrayBuffer;
  isLast: boolean;
}

export interface TransferProgress {
  transferId: string;
  filename: string;
  totalSize: number;
  transferredSize: number;
  speed: number;
  eta: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

export interface PeerState {
  peerId: string;
  connectionState: RTCPeerConnectionState;
  dataChannelState: RTCDataChannelState | null;
}

export type SignalHandler = (signal: SignalMessage) => void;
export type ProgressHandler = (progress: TransferProgress) => void;
export type DataHandler = (data: ArrayBuffer | string) => void;
export type StateHandler = (state: PeerState) => void;
