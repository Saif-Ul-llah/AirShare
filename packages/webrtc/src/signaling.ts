import type { SignalMessage, SignalHandler } from './types';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SignalingConfig {
  url: string;
  roomCode: string;
  peerId: string;
  onSignal: SignalHandler;
  onPeerJoined?: (peerId: string) => void;
  onPeerLeft?: (peerId: string) => void;
  onStateChange?: (state: ConnectionState) => void;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private config: SignalingConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private state: ConnectionState = 'disconnected';
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: SignalingConfig) {
    this.config = config;
  }

  /**
   * Connect to the signaling server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.config.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.setState('connected');
      this.reconnectAttempts = 0;

      // Join the room
      this.send({
        type: 'join',
        roomCode: this.config.roomCode,
        peerId: this.config.peerId,
      });

      // Start ping interval
      this.pingInterval = setInterval(() => {
        this.send({ type: 'ping' });
      }, 30000);
    };

    this.ws.onclose = () => {
      this.setState('disconnected');
      this.cleanup();
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.setState('error');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }

  private handleMessage(message: Record<string, unknown>): void {
    switch (message.type) {
      case 'signal':
        this.config.onSignal(message.signal as SignalMessage);
        break;

      case 'peer-joined':
        if (this.config.onPeerJoined) {
          this.config.onPeerJoined(message.peerId as string);
        }
        break;

      case 'peer-left':
        if (this.config.onPeerLeft) {
          this.config.onPeerLeft(message.peerId as string);
        }
        break;

      case 'room-peers':
        // List of existing peers in the room
        const peers = message.peers as string[];
        peers.forEach((peerId) => {
          if (peerId !== this.config.peerId && this.config.onPeerJoined) {
            this.config.onPeerJoined(peerId);
          }
        });
        break;

      case 'pong':
        // Ping acknowledged
        break;

      case 'error':
        console.error('Signaling error:', message.error);
        break;
    }
  }

  /**
   * Send a signal to a specific peer
   */
  sendSignal(signal: SignalMessage): void {
    this.send({
      type: 'signal',
      signal,
    });
  }

  /**
   * Broadcast to all peers in the room
   */
  broadcast(data: unknown): void {
    this.send({
      type: 'broadcast',
      roomCode: this.config.roomCode,
      data,
    });
  }

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    if (this.config.onStateChange) {
      this.config.onStateChange(state);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect from the signaling server
   */
  disconnect(): void {
    this.cleanup();

    if (this.ws) {
      // Send leave message before closing
      this.send({
        type: 'leave',
        roomCode: this.config.roomCode,
        peerId: this.config.peerId,
      });

      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }
}
