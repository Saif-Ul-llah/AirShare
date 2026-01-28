import Redis from 'ioredis';
import { env } from './env';

export let redis: Redis;

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
    console.error('[Redis] Failed to connect:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  console.log('[Redis] Disconnected');
}

// Helper functions for common Redis operations
export const redisHelpers = {
  // Session management
  async setSession(userId: string, sessionId: string, data: object, ttl: number): Promise<void> {
    await redis.setex(`session:${sessionId}`, ttl, JSON.stringify({ userId, ...data }));
    await redis.sadd(`user:sessions:${userId}`, sessionId);
  },

  async getSession(sessionId: string): Promise<object | null> {
    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  },

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
    await redis.srem(`user:sessions:${userId}`, sessionId);
  },

  async deleteAllUserSessions(userId: string): Promise<void> {
    const sessions = await redis.smembers(`user:sessions:${userId}`);
    if (sessions.length > 0) {
      await redis.del(...sessions.map((s) => `session:${s}`));
      await redis.del(`user:sessions:${userId}`);
    }
  },

  // Rate limiting
  async checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSec);
    }
    return current <= limit;
  },

  // Room presence
  async addRoomPresence(roomCode: string, peerId: string, data: object): Promise<void> {
    await redis.hset(`room:presence:${roomCode}`, peerId, JSON.stringify(data));
    await redis.expire(`room:presence:${roomCode}`, 3600); // 1 hour TTL
  },

  async removeRoomPresence(roomCode: string, peerId: string): Promise<void> {
    await redis.hdel(`room:presence:${roomCode}`, peerId);
  },

  async getRoomPresence(roomCode: string): Promise<Record<string, object>> {
    const presence = await redis.hgetall(`room:presence:${roomCode}`);
    const result: Record<string, object> = {};
    for (const [peerId, data] of Object.entries(presence)) {
      result[peerId] = JSON.parse(data);
    }
    return result;
  },

  // Caching
  async cacheGet<T>(key: string): Promise<T | null> {
    const data = await redis.get(`cache:${key}`);
    return data ? JSON.parse(data) : null;
  },

  async cacheSet<T>(key: string, value: T, ttl: number): Promise<void> {
    await redis.setex(`cache:${key}`, ttl, JSON.stringify(value));
  },

  async cacheDel(key: string): Promise<void> {
    await redis.del(`cache:${key}`);
  },

  // Pub/Sub for horizontal scaling
  async publish(channel: string, message: object): Promise<void> {
    await redis.publish(channel, JSON.stringify(message));
  },
};
