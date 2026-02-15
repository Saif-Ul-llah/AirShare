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

interface AuthContext {
  user: Awaited<ReturnType<typeof UserModel.findById>> | null;
  sessionId: string | null;
  authDebug: string;
}

export async function resolveAuthContext(
  jwtVerifier: { verify: (token: string) => Promise<JWTPayload | false> },
  authorization?: string
): Promise<AuthContext> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { user: null, sessionId: null, authDebug: 'no-token' };
  }

  const token = authorization.slice(7);

  try {
    const payload = await jwtVerifier.verify(token);

    if (!payload) {
      return { user: null, sessionId: null, authDebug: 'jwt-verify-false' };
    }

    if (payload.type !== 'access') {
      return { user: null, sessionId: null, authDebug: `wrong-type:${payload.type}` };
    }

    const user = await UserModel.findById(payload.userId);
    if (!user) {
      return { user: null, sessionId: null, authDebug: `user-not-found:${payload.userId}` };
    }

    if (user.isSuspended && user.isSuspended()) {
      return { user: null, sessionId: null, authDebug: 'suspended' };
    }

    return { user, sessionId: payload.sessionId, authDebug: 'ok' };
  } catch (error) {
    return {
      user: null,
      sessionId: null,
      authDebug: `error:${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const authPlugin = new Elysia({ name: 'auth-plugin' })
  .use(jwt({
    name: 'jwt',
    secret: env.JWT_SECRET,
  }))
  .derive(() => ({
    user: null as AuthContext['user'],
    sessionId: null as string | null,
    authDebug: 'not-checked',
  }))
  .onBeforeHandle(async (context) => {
    const authorization = typeof context.headers.authorization === 'string'
      ? context.headers.authorization
      : undefined;
    const auth = await resolveAuthContext(context.jwt, authorization);
    Object.assign(context as Record<string, unknown>, auth);
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
