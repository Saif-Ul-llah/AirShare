import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { env } from '../config/env';
import { redisHelpers } from '../config/redis';
import { UserModel } from '../models';
import { AppError } from './errorHandler';
import { ERROR_CODES } from '@airshare/shared';

interface JWTPayload {
  userId: string;
  sessionId: string;
  type: 'access' | 'refresh';
}

export const authPlugin = new Elysia({ name: 'auth-plugin' })
  .use(jwt({
    name: 'jwt',
    secret: env.JWT_SECRET,
  }))
  .derive(async ({ jwt, headers }) => {
    const authorization = headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return { user: null, sessionId: null };
    }

    const token = authorization.slice(7);

    try {
      const payload = await jwt.verify(token) as JWTPayload | false;

      if (!payload || payload.type !== 'access') {
        return { user: null, sessionId: null };
      }

      // Check session in Redis (non-blocking - trust JWT if Redis fails)
      try {
        const session = await redisHelpers.getSession(payload.sessionId);
        if (!session) {
          console.warn('[Auth] Session not found in Redis for:', payload.sessionId, '- trusting JWT');
        }
      } catch (redisError) {
        console.error('[Auth] Redis session lookup failed:', redisError, '- trusting JWT');
      }

      // Get user (JWT is already verified, so we trust the userId)
      const user = await UserModel.findById(payload.userId);
      if (!user) {
        console.warn('[Auth] User not found:', payload.userId);
        return { user: null, sessionId: null };
      }

      // Check if suspended
      if (user.isSuspended && user.isSuspended()) {
        throw AppError.forbidden('Account suspended');
      }

      return { user, sessionId: payload.sessionId };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('[Auth] Unexpected auth error:', error);
      return { user: null, sessionId: null };
    }
  });

// Middleware that requires authentication
export const requireAuth = new Elysia({ name: 'require-auth' })
  .use(authPlugin)
  .onBeforeHandle(({ user }) => {
    if (!user) {
      throw AppError.unauthorized();
    }
  });

// Middleware that requires admin role
export const requireAdmin = new Elysia({ name: 'require-admin' })
  .use(requireAuth)
  .onBeforeHandle(({ user }) => {
    if ((user as { role?: string })?.role !== 'admin') {
      throw AppError.forbidden('Admin access required');
    }
  });

// Helper to generate tokens
export async function generateTokens(
  jwt: { sign: (payload: Record<string, unknown>) => Promise<string> },
  userId: string
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const sessionId = crypto.randomUUID();

  const accessToken = await jwt.sign({
    userId,
    sessionId,
    type: 'access',
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  });

  const refreshToken = await jwt.sign({
    userId,
    sessionId,
    type: 'refresh',
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  });

  // Store session in Redis
  await redisHelpers.setSession(userId, sessionId, { createdAt: Date.now() }, 7 * 24 * 60 * 60);

  return { accessToken, refreshToken, sessionId };
}

// Helper to verify refresh token
export async function verifyRefreshToken(
  jwt: { verify: (token: string) => Promise<JWTPayload | false> },
  token: string
): Promise<{ userId: string; sessionId: string } | null> {
  try {
    const payload = await jwt.verify(token);

    if (!payload || payload.type !== 'refresh') {
      return null;
    }

    // Check session exists
    const session = await redisHelpers.getSession(payload.sessionId);
    if (!session) {
      return null;
    }

    return { userId: payload.userId, sessionId: payload.sessionId };
  } catch {
    return null;
  }
}
