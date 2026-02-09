import Redis from 'ioredis';
import { env } from './env';

export let redis: Redis | null;
let useInMemoryStore = false;

type SessionData = { userId: string } & Record<string, any>;

const memoryStore = {
  sessions: new Map<string, SessionData>(),
  userSessions: new Map<string, Set<string>>(),
  rateLimits: new Map<string, { count: number; resetAt: number }>(),
  roomPresence: new Map<string, Map<string, object>>(),
  cache: new Map<string, { value: any; expiresAt: number }>(),
};

export async function connectRedis(): Promise<void> {
  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[Redis] Max retries reached');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redis.on('error', (error) => {
      console.error('[Redis] Connection error:', error);
    });

    redis.on('close', () => {
      console.warn('[Redis] Connection closed');
    });

    // Test connection
    await redis.ping();
  } catch (error) {
    console.error('[Redis] Failed to connect, falling back to in-memory store:', error);
    redis = null;
    useInMemoryStore = true;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (useInMemoryStore || !redis) {
    return;
  }

  await redis.quit();
  console.log('[Redis] Disconnected');
}

// Helper functions for common Redis operations
export const redisHelpers = {
  // Session management
  async setSession(userId: string, sessionId: string, data: object, ttl: number): Promise<void> {
    if (useInMemoryStore || !redis) {
      const session: SessionData = { userId, ...(data as object) };
      memoryStore.sessions.set(sessionId, session);

      const existing = memoryStore.userSessions.get(userId) ?? new Set<string>();
      existing.add(sessionId);
      memoryStore.userSessions.set(userId, existing);
      return;
    }

    await redis.setex(`session:${sessionId}`, ttl, JSON.stringify({ userId, ...data }));
    await redis.sadd(`user:sessions:${userId}`, sessionId);
  },

  async getSession(sessionId: string): Promise<object | null> {
    if (useInMemoryStore || !redis) {
      const session = memoryStore.sessions.get(sessionId);
      return session ?? null;
    }

    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  },

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    if (useInMemoryStore || !redis) {
      memoryStore.sessions.delete(sessionId);
      const userSessions = memoryStore.userSessions.get(userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          memoryStore.userSessions.delete(userId);
        }
      }
      return;
    }

    await redis.del(`session:${sessionId}`);
    await redis.srem(`user:sessions:${userId}`, sessionId);
  },

  async deleteAllUserSessions(userId: string): Promise<void> {
    if (useInMemoryStore || !redis) {
      const sessions = memoryStore.userSessions.get(userId);
      if (sessions) {
        for (const sessionId of sessions) {
          memoryStore.sessions.delete(sessionId);
        }
        memoryStore.userSessions.delete(userId);
      }
      return;
    }

    const sessions = await redis.smembers(`user:sessions:${userId}`);
    if (sessions.length > 0) {
      await redis.del(...sessions.map((s) => `session:${s}`));
      await redis.del(`user:sessions:${userId}`);
    }
  },

  // Rate limiting
  async checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
    if (useInMemoryStore || !redis) {
      const now = Date.now();
      const existing = memoryStore.rateLimits.get(key);

      if (!existing || existing.resetAt <= now) {
        memoryStore.rateLimits.set(key, { count: 1, resetAt: now + windowSec * 1000 });
        return true;
      }

      existing.count += 1;
      return existing.count <= limit;
    }

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSec);
    }
    return current <= limit;
  },

  // Room presence
  async addRoomPresence(roomCode: string, peerId: string, data: object): Promise<void> {
    if (useInMemoryStore || !redis) {
      let room = memoryStore.roomPresence.get(roomCode);
      if (!room) {
        room = new Map<string, object>();
        memoryStore.roomPresence.set(roomCode, room);
      }
      room.set(peerId, data);
      return;
    }

    await redis.hset(`room:presence:${roomCode}`, peerId, JSON.stringify(data));
    await redis.expire(`room:presence:${roomCode}`, 3600); // 1 hour TTL
  },

  async removeRoomPresence(roomCode: string, peerId: string): Promise<void> {
    if (useInMemoryStore || !redis) {
      const room = memoryStore.roomPresence.get(roomCode);
      if (room) {
        room.delete(peerId);
        if (room.size === 0) {
          memoryStore.roomPresence.delete(roomCode);
        }
      }
      return;
    }

    await redis.hdel(`room:presence:${roomCode}`, peerId);
  },

  async getRoomPresence(roomCode: string): Promise<Record<string, object>> {
    if (useInMemoryStore || !redis) {
      const room = memoryStore.roomPresence.get(roomCode);
      const result: Record<string, object> = {};
      if (!room) return result;

      for (const [peerId, data] of room.entries()) {
        result[peerId] = data;
      }
      return result;
    }

    const presence = await redis.hgetall(`room:presence:${roomCode}`);
    const result: Record<string, object> = {};
    for (const [peerId, data] of Object.entries(presence)) {
      result[peerId] = JSON.parse(data);
    }
    return result;
  },

  // Caching
  async cacheGet<T>(key: string): Promise<T | null> {
    if (useInMemoryStore || !redis) {
      const entry = memoryStore.cache.get(key);
      if (!entry) return null;

      if (entry.expiresAt <= Date.now()) {
        memoryStore.cache.delete(key);
        return null;
      }

      return entry.value as T;
    }

    const data = await redis.get(`cache:${key}`);
    return data ? JSON.parse(data) : null;
  },

  async cacheSet<T>(key: string, value: T, ttl: number): Promise<void> {
    if (useInMemoryStore || !redis) {
      memoryStore.cache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
      return;
    }

    await redis.setex(`cache:${key}`, ttl, JSON.stringify(value));
  },

  async cacheDel(key: string): Promise<void> {
    if (useInMemoryStore || !redis) {
      memoryStore.cache.delete(key);
      return;
    }

    await redis.del(`cache:${key}`);
  },

  // Pub/Sub for horizontal scaling
  async publish(channel: string, message: object): Promise<void> {
    if (useInMemoryStore || !redis) {
      // No-op in in-memory mode
      return;
    }

    await redis.publish(channel, JSON.stringify(message));
  },
};
