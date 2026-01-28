import { Elysia, t } from 'elysia';
import { hash, verify } from 'argon2';
import { UserModel } from '../models';
import { AuditLogModel } from '../models';
import { authPlugin, generateTokens, verifyRefreshToken, requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { redisHelpers } from '../config/redis';
import { AppError } from '../middleware/errorHandler';
import { ERROR_CODES, registerUserSchema, loginUserSchema, updateUserSchema, changePasswordSchema } from '@airshare/shared';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)
  .use(authRateLimiter)

  // Register
  .post(
    '/register',
    async ({ body, jwt }) => {
      const { email, password, displayName } = body;

      // Check if user exists
      const existing = await UserModel.findByEmail(email);
      if (existing) {
        throw new AppError(ERROR_CODES.USER_EXISTS, 'Email already registered', 409);
      }

      // Hash password
      const passwordHash = await hash(password);

      // Create user
      const user = await UserModel.create({
        email,
        passwordHash,
        displayName,
      });

      // Generate tokens
      const tokens = await generateTokens(jwt, user._id.toString());

      // Audit log
      await AuditLogModel.log({
        userId: user._id,
        action: 'user.registered',
        category: 'user',
        actor: { type: 'user', userId: user._id },
      });

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
    async ({ body, jwt, headers }) => {
      const { email, password } = body;

      // Find user
      const user = await UserModel.findByEmail(email);
      if (!user) {
        // Log failed attempt
        await AuditLogModel.log({
          action: 'security.failed_login',
          category: 'security',
          actor: {
            type: 'anonymous',
            ip: headers['x-forwarded-for']?.toString() || undefined,
          },
          details: { email },
        });
        throw new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password', 401);
      }

      // Check suspension
      if (user.isSuspended && user.isSuspended()) {
        throw new AppError(ERROR_CODES.USER_SUSPENDED, 'Account suspended', 403);
      }

      // Verify password
      const valid = await verify(user.passwordHash, password);
      if (!valid) {
        await AuditLogModel.log({
          userId: user._id,
          action: 'security.failed_login',
          category: 'security',
          actor: {
            type: 'anonymous',
            ip: headers['x-forwarded-for']?.toString() || undefined,
          },
        });
        throw new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password', 401);
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Generate tokens
      const tokens = await generateTokens(jwt, user._id.toString());

      // Audit log
      await AuditLogModel.log({
        userId: user._id,
        action: 'user.login',
        category: 'user',
        actor: { type: 'user', userId: user._id },
      });

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
        password: t.String(),
      }),
    }
  )

  // Refresh token
  .post(
    '/refresh',
    async ({ body, jwt }) => {
      const result = await verifyRefreshToken(jwt, body.refreshToken);
      if (!result) {
        throw new AppError(ERROR_CODES.TOKEN_INVALID, 'Invalid refresh token', 401);
      }

      // Get user
      const user = await UserModel.findById(result.userId);
      if (!user) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found', 404);
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

      await AuditLogModel.log({
        userId: user._id,
        action: 'user.logout',
        category: 'user',
        actor: { type: 'user', userId: user._id },
      });
    }

    return { success: true };
  })

  // Get current user
  .get('/me', async ({ user }) => {
    if (!user) {
      throw AppError.unauthorized();
    }

    return {
      success: true,
      data: { user: user.toJSON() },
    };
  })

  // Update profile
  .patch(
    '/me',
    async ({ user, body }) => {
      if (!user) {
        throw AppError.unauthorized();
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
    async ({ user, body }) => {
      if (!user) {
        throw AppError.unauthorized();
      }

      // Verify current password
      const valid = await verify(user.passwordHash, body.currentPassword);
      if (!valid) {
        throw new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Current password is incorrect', 400);
      }

      // Hash new password
      user.passwordHash = await hash(body.newPassword);
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
