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

// JWT plugin only — provides `jwt` in context for sign/verify
export const jwtPlugin = new Elysia({ name: 'jwt-plugin' })
  .use(jwt({
    name: 'jwt',
    secret: env.JWT_SECRET,
  }));

// Helper: call from any handler to get auth context
export async function getAuth(ctx: { jwt: { verify: (token: string) => Promise<JWTPayload | false> }; headers: Record<string, string | undefined> }): Promise<AuthContext> {
  const authorization = typeof ctx.headers.authorization === 'string'
    ? ctx.headers.authorization
    : undefined;
  return resolveAuthContext(ctx.jwt, authorization);
}

// Helper: call from any handler to require auth (throws if not authenticated)
export async function requireAuth(ctx: { jwt: { verify: (token: string) => Promise<JWTPayload | false> }; headers: Record<string, string | undefined> }): Promise<{ user: NonNullable<AuthContext['user']>; sessionId: string }> {
  const auth = await getAuth(ctx);
  if (!auth.user) {
    throw AppError.unauthorized();
  }
  return { user: auth.user, sessionId: auth.sessionId! };
}

// Helper: require admin role
export async function requireAdmin(ctx: { jwt: { verify: (token: string) => Promise<JWTPayload | false> }; headers: Record<string, string | undefined> }): Promise<{ user: NonNullable<AuthContext['user']>; sessionId: string }> {
  const { user, sessionId } = await requireAuth(ctx);
  if ((user as { role?: string }).role !== 'admin') {
    throw AppError.forbidden('Admin access required');
  }
  return { user, sessionId };
}

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
