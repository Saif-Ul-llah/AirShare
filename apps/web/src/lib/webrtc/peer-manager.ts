'use client';

import { PeerConnection, FileTransfer } from '@airshare/webrtc';
import type { SignalMessage, TransferProgress, PeerState } from '@airshare/webrtc';
import { wsClient, PeerInfo } from '@/lib/websocket/client';

export interface P2PPeer {
  peerId: string;
  displayName?: string;
  connection: PeerConnection;
  fileTransfer: FileTransfer;
  state: PeerState;
  isConnected: boolean;
}

export interface TransferTask {
  transferId: string;
  peerId: string;
  direction: 'send' | 'receive';
  filename: string;
  totalSize: number;
  transferredSize: number;
  speed: number;
  eta: number;
  status: TransferProgress['status'];
  error?: string;
  file?: File;
}

type PeerConnectedHandler = (peer: P2PPeer) => void;
type PeerDisconnectedHandler = (peerId: string) => void;
type TransferProgressHandler = (transfer: TransferTask) => void;
type FileReceivedHandler = (transfer: TransferTask, file: File) => void;

export class PeerManager {
  private roomCode: string;
  private myPeerId: string;
  private peers: Map<string, P2PPeer> = new Map();
  private transfers: Map<string, TransferTask> = new Map();
  private peerInfoMap: Map<string, PeerInfo> = new Map();

  // Event handlers
  private onPeerConnected: PeerConnectedHandler | null = null;
  private onPeerDisconnected: PeerDisconnectedHandler | null = null;
  private onTransferProgress: TransferProgressHandler | null = null;
  private onFileReceived: FileReceivedHandler | null = null;

  constructor(roomCode: string, myPeerId: string) {
    this.roomCode = roomCode;
    this.myPeerId = myPeerId;
    this.setupSignalingHandlers();
  }

  private setupSignalingHandlers(): void {
    // Handle incoming WebRTC signals via WebSocket
    wsClient.onSignal((signal) => {
      this.handleSignal(signal as SignalMessage);
    });
  }

  private async handleSignal(signal: SignalMessage): Promise<void> {
    // Ignore signals not meant for us
    if (signal.to && signal.to !== this.myPeerId) return;

    const peerId = signal.from;

    switch (signal.type) {
      case 'offer':
        await this.handleOffer(peerId, signal);
        break;
      case 'answer':
        await this.handleAnswer(peerId, signal);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(peerId, signal);
        break;
    }
  }

  private async handleOffer(peerId: string, signal: SignalMessage): Promise<void> {
    // Create peer if doesn't exist
    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = this.createPeer(peerId);
    }

    // Handle offer and send answer
    const answerSignal = await peer.connection.handleOffer(signal);
    answerSignal.to = peerId;
    this.sendSignal(answerSignal);
  }

  private async handleAnswer(peerId: string, signal: SignalMessage): Promise<void> {
    const peer = this.peers.get(peerId);
    if (peer) {
      await peer.connection.handleAnswer(signal);
    }
  }

  private async handleIceCandidate(peerId: string, signal: SignalMessage): Promise<void> {
    const peer = this.peers.get(peerId);
    if (peer) {
      await peer.connection.handleIceCandidate(signal);
    }
  }

  private createPeer(peerId: string): P2PPeer {
    const connection = new PeerConnection(
      { peerId: this.myPeerId, roomCode: this.roomCode },
      (signal) => {
        signal.to = peerId;
        this.sendSignal(signal);
      }
    );

    const fileTransfer = new FileTransfer(connection);

    // Set up progress handler
    fileTransfer.setOnProgress((progress) => {
      this.handleTransferProgress(peerId, progress);
    });

    // Set up state change handler
    connection.setOnStateChange((state) => {
      this.handleStateChange(peerId, state);
    });

    const peerInfo = this.peerInfoMap.get(peerId);
    const peer: P2PPeer = {
      peerId,
      displayName: peerInfo?.displayName,
      connection,
      fileTransfer,
      state: connection.getState(),
      isConnected: false,
    };

    this.peers.set(peerId, peer);
    return peer;
  }

  private handleStateChange(peerId: string, state: PeerState): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    peer.state = state;
    const wasConnected = peer.isConnected;
    peer.isConnected = state.connectionState === 'connected' && state.dataChannelState === 'open';

    if (peer.isConnected && !wasConnected && this.onPeerConnected) {
      this.onPeerConnected(peer);
    } else if (!peer.isConnected && wasConnected && this.onPeerDisconnected) {
      this.onPeerDisconnected(peerId);
    }
  }

  private handleTransferProgress(peerId: string, progress: TransferProgress): void {
    let transfer = this.transfers.get(progress.transferId);

    if (!transfer) {
      // This is a new incoming transfer
      transfer = {
        transferId: progress.transferId,
        peerId,
        direction: 'receive',
        filename: progress.filename,
        totalSize: progress.totalSize,
        transferredSize: progress.transferredSize,
        speed: progress.speed,
        eta: progress.eta,
        status: progress.status,
        error: progress.error,
      };
      this.transfers.set(progress.transferId, transfer);
    } else {
      // Update existing transfer
      transfer.transferredSize = progress.transferredSize;
      transfer.speed = progress.speed;
      transfer.eta = progress.eta;
      transfer.status = progress.status;
      transfer.error = progress.error;
    }

    if (this.onTransferProgress) {
      this.onTransferProgress(transfer);
    }

    // Check if file is complete and received
    if (progress.status === 'completed' && transfer.direction === 'receive') {
      const peer = this.peers.get(peerId);
      if (peer) {
        const file = peer.fileTransfer.getReceivedFile(progress.transferId);
        if (file && this.onFileReceived) {
          transfer.file = file;
          this.onFileReceived(transfer, file);
        }
      }
    }
  }

  private sendSignal(signal: SignalMessage): void {
    wsClient.sendSignal(signal);
  }

  /**
   * Connect to a peer
   */
  async connectToPeer(peerId: string): Promise<P2PPeer> {
    // Check if already connected
    const existing = this.peers.get(peerId);
    if (existing?.isConnected) {
      return existing;
    }

    // Create new peer and initiate connection
    const peer = existing || this.createPeer(peerId);
    const offerSignal = await peer.connection.createOffer(peerId);
    this.sendSignal(offerSignal);

    // Wait for connection to establish
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 30000);

      const checkConnection = () => {
        const p = this.peers.get(peerId);
        if (p?.isConnected) {
          clearTimeout(timeout);
          resolve(p);
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Disconnect from a peer
   */
  disconnectPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
      if (this.onPeerDisconnected) {
        this.onPeerDisconnected(peerId);
      }
    }
  }

  /**
   * Send a file to a specific peer
   */
  async sendFile(peerId: string, file: File, encrypted = false, iv?: string): Promise<string> {
    let peer = this.peers.get(peerId);

    // Connect if not already connected
    if (!peer?.isConnected) {
      peer = await this.connectToPeer(peerId);
    }

    // Create transfer task
    const transferId = await peer.fileTransfer.sendFile(file, encrypted, iv);

    const transfer: TransferTask = {
      transferId,
      peerId,
      direction: 'send',
      filename: file.name,
      totalSize: file.size,
      transferredSize: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      file,
    };

    this.transfers.set(transferId, transfer);

    return transferId;
  }

  /**
   * Send a file to all connected peers
   */
  async broadcastFile(file: File, encrypted = false, iv?: string): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const peer of this.peers.values()) {
      if (peer.isConnected) {
        try {
          const transferId = await this.sendFile(peer.peerId, file, encrypted, iv);
          results.set(peer.peerId, transferId);
        } catch (error) {
          console.error(`Failed to send to ${peer.peerId}:`, error);
        }
      }
    }

    return results;
  }

  /**
   * Cancel a transfer
   */
  cancelTransfer(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;

    const peer = this.peers.get(transfer.peerId);
    if (peer) {
      peer.fileTransfer.cancelTransfer(transferId);
    }

    transfer.status = 'cancelled';
    if (this.onTransferProgress) {
      this.onTransferProgress(transfer);
    }
  }

  /**
   * Set the list of peers in the room
   */
  setPeers(peers: PeerInfo[]): void {
    this.peerInfoMap.clear();
    peers.forEach((p) => {
      if (p.peerId !== this.myPeerId) {
        this.peerInfoMap.set(p.peerId, p);
      }
    });
  }

  /**
   * Add a peer to the list
   */
  addPeer(peer: PeerInfo): void {
    if (peer.peerId !== this.myPeerId) {
      this.peerInfoMap.set(peer.peerId, peer);
    }
  }

  /**
   * Remove a peer from the list
   */
  removePeer(peerId: string): void {
    this.peerInfoMap.delete(peerId);
    this.disconnectPeer(peerId);
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers(): P2PPeer[] {
    return Array.from(this.peers.values()).filter((p) => p.isConnected);
  }

  /**
   * Get all available peers (in room but not necessarily connected)
   */
  getAvailablePeers(): PeerInfo[] {
    return Array.from(this.peerInfoMap.values());
  }

  /**
   * Get all active transfers
   */
  getActiveTransfers(): TransferTask[] {
    return Array.from(this.transfers.values()).filter(
      (t) => t.status === 'pending' || t.status === 'transferring'
    );
  }

  /**
   * Get transfer by ID
   */
  getTransfer(transferId: string): TransferTask | undefined {
    return this.transfers.get(transferId);
  }

  /**
   * Clean up a completed transfer
   */
  cleanupTransfer(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      const peer = this.peers.get(transfer.peerId);
      if (peer) {
        peer.fileTransfer.cleanupTransfer(transferId);
      }
      this.transfers.delete(transferId);
    }
  }

  // Event handler setters
  setOnPeerConnected(handler: PeerConnectedHandler): void {
    this.onPeerConnected = handler;
  }

  setOnPeerDisconnected(handler: PeerDisconnectedHandler): void {
    this.onPeerDisconnected = handler;
  }

  setOnTransferProgress(handler: TransferProgressHandler): void {
    this.onTransferProgress = handler;
  }

  setOnFileReceived(handler: FileReceivedHandler): void {
    this.onFileReceived = handler;
  }

  /**
   * Close all connections
   */
  close(): void {
    for (const peer of this.peers.values()) {
      peer.connection.close();
    }
    this.peers.clear();
    this.transfers.clear();
    this.peerInfoMap.clear();
  }
}
