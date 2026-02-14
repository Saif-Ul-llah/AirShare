import { Elysia, t } from 'elysia';
import { UserModel } from '../models';
import { AuditLogModel } from '../models';
import { authPlugin, generateTokens, verifyRefreshToken, requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { redisHelpers } from '../config/redis';
import { ERROR_CODES, registerUserSchema, loginUserSchema, updateUserSchema, changePasswordSchema } from '@airshare/shared';
import { hashPassword, verifyPassword } from '../utils/password';

function errorResponse(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)
  .use(authRateLimiter)

  // Register
  .post(
    '/register',
    async ({ body, jwt, set }) => {
      const { email, password, displayName } = body;

      // Check if user exists
      const existing = await UserModel.findByEmail(email);
      if (existing) {
        set.status = 409;
        return errorResponse(ERROR_CODES.USER_EXISTS, 'Email already registered');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const user = await UserModel.create({
        email,
        passwordHash,
        displayName,
      });

      // Generate tokens
      const tokens = await generateTokens(jwt, user._id.toString());

      // Audit log
      AuditLogModel.log({
        userId: user._id,
        action: 'user.registered',
        category: 'user',
        actor: { type: 'user', userId: user._id },
      }).catch(() => {});

      return {
        success: true,
        data: {
          user: user.toJSON(),
          ...tokens,
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8, maxLength: 100 }),
        displayName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      }),
    }
  )

  // Login
  .post(
    '/login',
    async ({ body, jwt, set, headers }) => {
      try {
        const { email, password } = body;

        // Find user
        const user = await UserModel.findByEmail(email);
        if (!user) {
          AuditLogModel.log({
            action: 'security.failed_login',
            category: 'security',
            actor: {
              type: 'anonymous',
              ip: headers['x-forwarded-for']?.toString() || undefined,
            },
            details: { email },
          }).catch(() => {});
          set.status = 401;
          return errorResponse(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
        }

        // Check suspension
        if (user.isSuspended && user.isSuspended()) {
          set.status = 403;
          return errorResponse(ERROR_CODES.USER_SUSPENDED, 'Account suspended');
        }

        // Verify password
        const valid = await verifyPassword(user.passwordHash, password);
        if (!valid) {
          AuditLogModel.log({
            userId: user._id,
            action: 'security.failed_login',
            category: 'security',
            actor: {
              type: 'anonymous',
              ip: headers['x-forwarded-for']?.toString() || undefined,
            },
          }).catch(() => {});
          set.status = 401;
          return errorResponse(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
        }

        // Update last login
        user.lastLoginAt = new Date();
        await user.save();

        // Generate tokens
        const tokens = await generateTokens(jwt, user._id.toString());

        // Audit log (non-blocking)
        AuditLogModel.log({
          userId: user._id,
          action: 'user.login',
          category: 'user',
          actor: { type: 'user', userId: user._id },
        }).catch(() => {});

        return {
          success: true,
          data: {
            user: user.toJSON(),
            ...tokens,
          },
        };
      } catch (error) {
        console.error('[Login Error]', error);
        set.status = 500;
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Login failed');
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String(),
      }),
    }
  )

  // Refresh token
  .post(
    '/refresh',
    async ({ body, jwt, set }) => {
      const result = await verifyRefreshToken(jwt, body.refreshToken);
      if (!result) {
        set.status = 401;
        return errorResponse(ERROR_CODES.TOKEN_INVALID, 'Invalid refresh token');
      }

      // Get user
      const user = await UserModel.findById(result.userId);
      if (!user) {
        set.status = 404;
        return errorResponse(ERROR_CODES.NOT_FOUND, 'User not found');
      }

      // Delete old session and create new one
      await redisHelpers.deleteSession(result.sessionId, result.userId);

      // Generate new tokens
      const tokens = await generateTokens(jwt, user._id.toString());

      return {
        success: true,
        data: tokens,
      };
    },
    {
      body: t.Object({
        refreshToken: t.String(),
      }),
    }
  )

  // Logout
  .post('/logout', async ({ user, sessionId }) => {
    if (user && sessionId) {
      await redisHelpers.deleteSession(sessionId, user._id.toString());

      AuditLogModel.log({
        userId: user._id,
        action: 'user.logout',
        category: 'user',
        actor: { type: 'user', userId: user._id },
      }).catch(() => {});
    }

    return { success: true };
  })

  // Get current user
  .get('/me', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(ERROR_CODES.UNAUTHORIZED, 'Unauthorized');
    }

    return {
      success: true,
      data: { user: user.toJSON() },
    };
  })

  // Update profile
  .patch(
    '/me',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(ERROR_CODES.UNAUTHORIZED, 'Unauthorized');
      }

      if (body.displayName !== undefined) {
        user.displayName = body.displayName;
      }

      if (body.preferences) {
        user.preferences = { ...user.preferences, ...body.preferences };
      }

      await user.save();

      return {
        success: true,
        data: { user: user.toJSON() },
      };
    },
    {
      body: t.Object({
        displayName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        preferences: t.Optional(
          t.Object({
            theme: t.Optional(t.Union([t.Literal('light'), t.Literal('dark'), t.Literal('system')])),
            defaultRoomMode: t.Optional(t.Union([t.Literal('local'), t.Literal('internet')])),
            defaultRoomAccess: t.Optional(t.Union([t.Literal('public'), t.Literal('private'), t.Literal('password')])),
            notifications: t.Optional(t.Boolean()),
          })
        ),
      }),
    }
  )

  // Change password
  .post(
    '/change-password',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(ERROR_CODES.UNAUTHORIZED, 'Unauthorized');
      }

      // Verify current password
      const valid = await verifyPassword(user.passwordHash, body.currentPassword);
      if (!valid) {
        set.status = 400;
        return errorResponse(ERROR_CODES.INVALID_CREDENTIALS, 'Current password is incorrect');
      }

      // Hash new password
      user.passwordHash = await hashPassword(body.newPassword);
      await user.save();

      // Invalidate all sessions except current
      await redisHelpers.deleteAllUserSessions(user._id.toString());

      return { success: true };
    },
    {
      body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String({ minLength: 8, maxLength: 100 }),
      }),
    }
  );
