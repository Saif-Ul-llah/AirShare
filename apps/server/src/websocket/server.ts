import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { redis, redisHelpers } from '../config/redis';
import { RoomModel, AuditLogModel } from '../models';
import { WS_EVENTS } from '@airshare/shared';

let io: Server;

interface RoomJoinData {
  roomCode: string;
  peerId: string;
  displayName?: string;
}

interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;
  to: string;
  roomCode: string;
  payload: unknown;
}

export function setupWebSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis adapter for horizontal scaling (when multiple server instances)
  // TODO: Add Redis adapter when scaling: io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket: Socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    let currentRoom: string | null = null;
    let currentPeerId: string | null = null;

    // Join room
    socket.on(WS_EVENTS.ROOM_JOIN, async (data: RoomJoinData) => {
      try {
        const { roomCode, peerId, displayName } = data;

        // Verify room exists
        const room = await RoomModel.findOne({
          code: roomCode.toUpperCase(),
          deletedAt: null,
        });

        if (!room) {
          socket.emit(WS_EVENTS.ERROR, { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
          return;
        }

        // Leave previous room if any
        if (currentRoom) {
          socket.leave(currentRoom);
          await redisHelpers.removeRoomPresence(currentRoom, currentPeerId!);
          io.to(currentRoom).emit(WS_EVENTS.ROOM_USER_LEFT, { peerId: currentPeerId });
        }

        // Join new room
        currentRoom = roomCode.toUpperCase();
        currentPeerId = peerId;

        socket.join(currentRoom);

        // Add to presence
        await redisHelpers.addRoomPresence(currentRoom, peerId, {
          displayName,
          joinedAt: new Date(),
          socketId: socket.id,
        });

        // Get current presence
        const presence = await redisHelpers.getRoomPresence(currentRoom);

        // Notify others
        socket.to(currentRoom).emit(WS_EVENTS.ROOM_USER_JOINED, {
          peerId,
          displayName,
        });

        // Send room peers to the joining user
        socket.emit('room:peers', {
          peers: Object.entries(presence)
            .filter(([id]) => id !== peerId)
            .map(([id, data]) => ({ peerId: id, ...(data as object) })),
        });

        // Audit log
        await AuditLogModel.log({
          roomId: room._id,
          action: 'room.joined',
          category: 'room',
          actor: { type: 'anonymous', ip: socket.handshake.address },
          details: { peerId },
        });
      } catch (error) {
        console.error('[WS] Error joining room:', error);
        socket.emit(WS_EVENTS.ERROR, { code: 'JOIN_ERROR', message: 'Failed to join room' });
      }
    });

    // Leave room
    socket.on(WS_EVENTS.ROOM_LEAVE, async () => {
      if (currentRoom && currentPeerId) {
        socket.leave(currentRoom);
        await redisHelpers.removeRoomPresence(currentRoom, currentPeerId);
        io.to(currentRoom).emit(WS_EVENTS.ROOM_USER_LEFT, { peerId: currentPeerId });
        currentRoom = null;
        currentPeerId = null;
      }
    });

    // WebRTC signaling relay
    socket.on(WS_EVENTS.WEBRTC_SIGNAL, async (data: SignalData) => {
      if (!currentRoom) {
        socket.emit(WS_EVENTS.ERROR, { code: 'NOT_IN_ROOM', message: 'Not in a room' });
        return;
      }

      // Get target socket from presence
      const presence = await redisHelpers.getRoomPresence(currentRoom);
      const targetPresence = presence[data.to] as { socketId?: string } | undefined;

      if (targetPresence?.socketId) {
        // Send signal to specific peer
        io.to(targetPresence.socketId).emit(WS_EVENTS.WEBRTC_SIGNAL, {
          ...data,
          from: currentPeerId,
        });
      }
    });

    // Item events - broadcast to room
    socket.on(WS_EVENTS.ITEM_CREATE, (data) => {
      if (currentRoom) {
        socket.to(currentRoom).emit(WS_EVENTS.ITEM_CREATED, data);
      }
    });

    socket.on(WS_EVENTS.ITEM_UPDATE, (data) => {
      if (currentRoom) {
        socket.to(currentRoom).emit(WS_EVENTS.ITEM_UPDATED, data);
      }
    });

    socket.on(WS_EVENTS.ITEM_DELETE, (data) => {
      if (currentRoom) {
        socket.to(currentRoom).emit(WS_EVENTS.ITEM_DELETED, data);
      }
    });

    // Ping/pong for connection health
    socket.on(WS_EVENTS.PING, () => {
      socket.emit(WS_EVENTS.PONG);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);

      if (currentRoom && currentPeerId) {
        await redisHelpers.removeRoomPresence(currentRoom, currentPeerId);
        io.to(currentRoom).emit(WS_EVENTS.ROOM_USER_LEFT, { peerId: currentPeerId });
      }
    });
  });

  console.log('[WS] WebSocket server initialized');
  return io;
}

// Helper to broadcast to a room from outside socket handlers
export function broadcastToRoom(roomCode: string, event: string, data: unknown): void {
  if (io) {
    io.to(roomCode.toUpperCase()).emit(event, data);
  }
}

// Helper to disconnect all users from a room
export function disconnectRoom(roomCode: string): void {
  if (io) {
    io.in(roomCode.toUpperCase()).disconnectSockets(true);
  }
}

export { io };
