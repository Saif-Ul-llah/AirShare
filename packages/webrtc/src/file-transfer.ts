import { P2P_CHUNK_SIZE } from '@airshare/shared';
import { CryptoUtils } from '@airshare/crypto';
import { PeerConnection } from './peer-connection';
import type { TransferMetadata, TransferChunk, TransferProgress, ProgressHandler } from './types';

interface PendingTransfer {
  metadata: TransferMetadata;
  chunks: Map<number, ArrayBuffer>;
  receivedSize: number;
  startTime: number;
  lastUpdate: number;
}

export class FileTransfer {
  private peer: PeerConnection;
  private onProgress: ProgressHandler | null = null;
  private pendingTransfers: Map<string, PendingTransfer> = new Map();
  private activeTransfer: string | null = null;

  constructor(peer: PeerConnection) {
    this.peer = peer;
    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    this.peer.setOnData((data) => {
      if (typeof data === 'string') {
        this.handleControlMessage(data);
      } else {
        this.handleChunkData(data);
      }
    });
  }

  private handleControlMessage(message: string): void {
    try {
      const parsed = JSON.parse(message);

      switch (parsed.type) {
        case 'transfer-start':
          this.handleTransferStart(parsed.metadata);
          break;
        case 'transfer-complete':
          this.handleTransferComplete(parsed.transferId);
          break;
        case 'transfer-cancel':
          this.handleTransferCancel(parsed.transferId);
          break;
        case 'transfer-ack':
          // Acknowledgment received
          break;
      }
    } catch (error) {
      console.error('Error parsing control message:', error);
    }
  }

  private handleTransferStart(metadata: TransferMetadata): void {
    this.pendingTransfers.set(metadata.transferId, {
      metadata,
      chunks: new Map(),
      receivedSize: 0,
      startTime: Date.now(),
      lastUpdate: Date.now(),
    });

    // Send acknowledgment
    this.peer.send(JSON.stringify({
      type: 'transfer-ack',
      transferId: metadata.transferId,
    }));

    this.updateProgress(metadata.transferId, 'transferring');
  }

  private handleChunkData(data: ArrayBuffer): void {
    // First 36 bytes: transferId (UUID), next 4 bytes: chunk index
    const view = new DataView(data);
    const decoder = new TextDecoder();
    const transferId = decoder.decode(new Uint8Array(data, 0, 36));
    const chunkIndex = view.getUint32(36, true);
    const chunkData = data.slice(40);

    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) {
      console.error('Unknown transfer:', transferId);
      return;
    }

    transfer.chunks.set(chunkIndex, chunkData);
    transfer.receivedSize += chunkData.byteLength;
    transfer.lastUpdate = Date.now();

    this.updateProgress(transferId, 'transferring');

    // Check if transfer is complete
    if (transfer.chunks.size === transfer.metadata.totalChunks) {
      this.handleTransferComplete(transferId);
    }
  }

  private handleTransferComplete(transferId: string): void {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) return;

    this.updateProgress(transferId, 'completed');
  }

  private handleTransferCancel(transferId: string): void {
    this.pendingTransfers.delete(transferId);
    this.updateProgress(transferId, 'cancelled');
  }

  private updateProgress(
    transferId: string,
    status: TransferProgress['status'],
    error?: string
  ): void {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer && status !== 'cancelled') return;

    const now = Date.now();
    const elapsed = transfer ? (now - transfer.startTime) / 1000 : 0;
    const speed = transfer && elapsed > 0 ? transfer.receivedSize / elapsed : 0;
    const remaining = transfer ? transfer.metadata.size - transfer.receivedSize : 0;
    const eta = speed > 0 ? remaining / speed : 0;

    const progress: TransferProgress = {
      transferId,
      filename: transfer?.metadata.filename || '',
      totalSize: transfer?.metadata.size || 0,
      transferredSize: transfer?.receivedSize || 0,
      speed,
      eta,
      status,
      error,
    };

    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  /**
   * Send a file to the peer
   */
  async sendFile(file: File, encrypted = false, encryptionIV?: string): Promise<string> {
    const transferId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / P2P_CHUNK_SIZE);
    const checksum = await CryptoUtils.calculateChecksum(await file.arrayBuffer());

    const metadata: TransferMetadata = {
      transferId,
      filename: file.name,
      size: file.size,
      mimeType: file.type,
      encrypted,
      encryptionIV,
      checksum,
      totalChunks,
    };

    // Send metadata
    this.peer.send(JSON.stringify({
      type: 'transfer-start',
      metadata,
    }));

    // Wait a bit for acknowledgment
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send chunks
    this.activeTransfer = transferId;
    const startTime = Date.now();
    let sentSize = 0;

    for (let i = 0; i < totalChunks; i++) {
      if (this.activeTransfer !== transferId) {
        throw new Error('Transfer cancelled');
      }

      const start = i * P2P_CHUNK_SIZE;
      const end = Math.min(start + P2P_CHUNK_SIZE, file.size);
      const chunk = await file.slice(start, end).arrayBuffer();

      // Create chunk packet: transferId (36) + index (4) + data
      const packet = new ArrayBuffer(40 + chunk.byteLength);
      const encoder = new TextEncoder();
      new Uint8Array(packet).set(encoder.encode(transferId), 0);
      new DataView(packet).setUint32(36, i, true);
      new Uint8Array(packet).set(new Uint8Array(chunk), 40);

      await this.peer.sendWithFlowControl(packet);

      sentSize += chunk.byteLength;

      // Update progress
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? sentSize / elapsed : 0;
      const remaining = file.size - sentSize;

      if (this.onProgress) {
        this.onProgress({
          transferId,
          filename: file.name,
          totalSize: file.size,
          transferredSize: sentSize,
          speed,
          eta: speed > 0 ? remaining / speed : 0,
          status: 'transferring',
        });
      }
    }

    // Send completion
    this.peer.send(JSON.stringify({
      type: 'transfer-complete',
      transferId,
    }));

    this.activeTransfer = null;

    if (this.onProgress) {
      this.onProgress({
        transferId,
        filename: file.name,
        totalSize: file.size,
        transferredSize: file.size,
        speed: 0,
        eta: 0,
        status: 'completed',
      });
    }

    return transferId;
  }

  /**
   * Get a completed transfer as a File
   */
  getReceivedFile(transferId: string): File | null {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer || transfer.chunks.size !== transfer.metadata.totalChunks) {
      return null;
    }

    // Reassemble chunks
    const chunks: ArrayBuffer[] = [];
    for (let i = 0; i < transfer.metadata.totalChunks; i++) {
      const chunk = transfer.chunks.get(i);
      if (!chunk) return null;
      chunks.push(chunk);
    }

    const blob = new Blob(chunks, { type: transfer.metadata.mimeType });
    return new File([blob], transfer.metadata.filename, {
      type: transfer.metadata.mimeType,
    });
  }

  /**
   * Get transfer metadata
   */
  getTransferMetadata(transferId: string): TransferMetadata | null {
    return this.pendingTransfers.get(transferId)?.metadata || null;
  }

  /**
   * Cancel an active transfer
   */
  cancelTransfer(transferId: string): void {
    if (this.activeTransfer === transferId) {
      this.activeTransfer = null;
    }

    this.peer.send(JSON.stringify({
      type: 'transfer-cancel',
      transferId,
    }));

    this.pendingTransfers.delete(transferId);
    this.updateProgress(transferId, 'cancelled');
  }

  /**
   * Set progress handler
   */
  setOnProgress(handler: ProgressHandler): void {
    this.onProgress = handler;
  }

  /**
   * Clean up completed transfers
   */
  cleanupTransfer(transferId: string): void {
    this.pendingTransfers.delete(transferId);
  }
}
