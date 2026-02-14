import { Elysia, t } from 'elysia';
import { RoomModel, ItemModel, AuditLogModel } from '../models';
import { authPlugin } from '../middleware/auth';
import { roomCreateRateLimiter } from '../middleware/rateLimit';
import { redisHelpers } from '../config/redis';
import { ERROR_CODES, ROOM_CODE_LENGTH, ROOM_CODE_CHARSET, DEFAULT_ROOM_SETTINGS, ROOM_EXPIRY } from '@airshare/shared';
import { CryptoUtils } from '@airshare/crypto';
import { hashPassword, verifyPassword } from '../utils/password';

function generateRoomCode(): string {
  let code = '';
  const randomBytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARSET[randomBytes[i] % ROOM_CODE_CHARSET.length];
  }
  return code;
}

function errorResponse(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

export const roomRoutes = new Elysia({ prefix: '/rooms' })
  .use(authPlugin)

  // Create room
  .post(
    '/',
    async ({ body, user, set }) => {
      // Generate unique code
      let code: string = '';
      let attempts = 0;
      do {
        code = generateRoomCode();
        const existing = await RoomModel.findOne({ code });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        set.status = 500;
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Failed to generate unique room code');
      }

      // Calculate expiry
      let expiresAt: Date | undefined;
      if (body.expiresAt) {
        expiresAt = new Date(body.expiresAt);
      } else if (body.lifespan === 'temporary') {
        const expiry = body.mode === 'local' ? ROOM_EXPIRY.temporary.local : ROOM_EXPIRY.temporary.internet;
        expiresAt = new Date(Date.now() + expiry);
      }

      // Hash password if provided
      let passwordHash: string | undefined;
      let encryptionSalt: string | undefined;
      if (body.password) {
        passwordHash = await hashPassword(body.password);
        // Generate salt for client-side encryption key derivation
        encryptionSalt = CryptoUtils.uint8ArrayToBase64(CryptoUtils.generateSalt());
      }

      // Create room
      const room = await RoomModel.create({
        code,
        name: body.name,
        mode: body.mode,
        access: body.access || (body.password ? 'password' : 'public'),
        lifespan: body.lifespan || 'temporary',
        passwordHash,
        encryptionSalt,
        ownerId: user?._id,
        settings: { ...DEFAULT_ROOM_SETTINGS, ...body.settings },
        expiresAt,
      });

      // Audit log
      AuditLogModel.log({
        roomId: room._id,
        userId: user?._id,
        action: 'room.created',
        category: 'room',
        actor: {
          type: user ? 'user' : 'anonymous',
          userId: user?._id,
        },
        details: { mode: body.mode, access: room.access },
      }).catch(() => {});

      return {
        success: true,
        data: {
          room: {
            ...room.toJSON(),
            encryptionSalt: room.encryptionSalt,
          },
        },
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        mode: t.Union([t.Literal('local'), t.Literal('internet')]),
        access: t.Optional(t.Union([t.Literal('public'), t.Literal('private'), t.Literal('password')])),
        lifespan: t.Optional(t.Union([t.Literal('temporary'), t.Literal('persistent')])),
        password: t.Optional(t.String({ minLength: 4, maxLength: 100 })),
        settings: t.Optional(
          t.Object({
            maxItems: t.Optional(t.Number()),
            maxFileSize: t.Optional(t.Number()),
            allowedFileTypes: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
            requirePassword: t.Optional(t.Boolean()),
            autoExpireItems: t.Optional(t.Boolean()),
            itemExpireDays: t.Optional(t.Number()),
          })
        ),
        expiresAt: t.Optional(t.String()),
      }),
    }
  )

  // Get room by code
  .get(
    '/:code',
    async ({ params, query, user, set }) => {
      const room = await RoomModel.findOne({
        code: params.code.toUpperCase(),
        deletedAt: null,
      });

      if (!room) {
        set.status = 404;
        return errorResponse(ERROR_CODES.ROOM_NOT_FOUND, 'Room not found');
      }

      // Check expiry
      if (room.expiresAt && room.expiresAt < new Date()) {
        set.status = 410;
        return errorResponse(ERROR_CODES.ROOM_EXPIRED, 'Room has expired');
      }

      // Check password if required
      if (room.access === 'password' && !room.ownerId?.equals(user?._id)) {
        if (!query.password) {
          set.status = 401;
          return errorResponse(ERROR_CODES.ROOM_PASSWORD_REQUIRED, 'Password required');
        }
        const valid = await verifyPassword(room.passwordHash!, query.password);
        if (!valid) {
          set.status = 401;
          return errorResponse(ERROR_CODES.ROOM_PASSWORD_INVALID, 'Invalid password');
        }
      }

      // Check private access
      if (room.access === 'private' && !room.ownerId?.equals(user?._id)) {
        set.status = 403;
        return errorResponse(ERROR_CODES.FORBIDDEN, 'Room is private');
      }

      // Update last activity
      room.lastActivityAt = new Date();
      await room.save();

      // Get items
      const items = await ItemModel.find({
        roomId: room._id,
        deletedAt: null,
      }).sort({ createdAt: -1 });

      // Get presence
      const presence = await redisHelpers.getRoomPresence(room.code);

      return {
        success: true,
        data: {
          room: {
            ...room.toJSON(),
            encryptionSalt: room.encryptionSalt,
          },
          items: items.map((item) => item.toJSON()),
          presence: Object.values(presence),
        },
      };
    },
    {
      params: t.Object({
        code: t.String({ minLength: 8, maxLength: 8 }),
      }),
      query: t.Object({
        password: t.Optional(t.String()),
      }),
    }
  )

  // Update room
  .patch(
    '/:code',
    async ({ params, body, user, set }) => {
      const room = await RoomModel.findOne({
        code: params.code.toUpperCase(),
        deletedAt: null,
      });

      if (!room) {
        set.status = 404;
        return errorResponse(ERROR_CODES.ROOM_NOT_FOUND, 'Room not found');
      }

      // Check ownership
      if (room.ownerId && !room.ownerId.equals(user?._id)) {
        set.status = 403;
        return errorResponse(ERROR_CODES.FORBIDDEN, 'Only room owner can update');
      }

      // Update fields
      if (body.name) room.name = body.name;
      if (body.access) room.access = body.access;
      if (body.settings) {
        room.settings = { ...room.settings, ...body.settings };
      }
      if (body.expiresAt) {
        room.expiresAt = new Date(body.expiresAt);
      }

      // Update password
      if (body.password !== undefined) {
        if (body.password) {
          room.passwordHash = await hashPassword(body.password);
          room.encryptionSalt = CryptoUtils.uint8ArrayToBase64(CryptoUtils.generateSalt());
          room.access = 'password';
        } else {
          room.passwordHash = undefined;
          room.encryptionSalt = undefined;
          if (room.access === 'password') {
            room.access = 'public';
          }
        }
      }

      room.lastActivityAt = new Date();
      await room.save();

      AuditLogModel.log({
        roomId: room._id,
        userId: user?._id,
        action: 'room.updated',
        category: 'room',
        actor: { type: 'user', userId: user?._id },
        details: { changes: body },
      }).catch(() => {});

      return {
        success: true,
        data: { room: room.toJSON() },
      };
    },
    {
      params: t.Object({
        code: t.String({ minLength: 8, maxLength: 8 }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        access: t.Optional(t.Union([t.Literal('public'), t.Literal('private'), t.Literal('password')])),
        password: t.Optional(t.Union([t.String({ minLength: 4, maxLength: 100 }), t.Null()])),
        settings: t.Optional(t.Object({})),
        expiresAt: t.Optional(t.String()),
      }),
    }
  )

  // Delete room
  .delete('/:code', async ({ params, user, set }) => {
    const room = await RoomModel.findOne({
      code: params.code.toUpperCase(),
      deletedAt: null,
    });

    if (!room) {
      set.status = 404;
      return errorResponse(ERROR_CODES.ROOM_NOT_FOUND, 'Room not found');
    }

    // Check ownership
    if (room.ownerId && !room.ownerId.equals(user?._id)) {
      set.status = 403;
      return errorResponse(ERROR_CODES.FORBIDDEN, 'Only room owner can delete');
    }

    // Soft delete
    room.deletedAt = new Date();
    await room.save();

    // Also soft delete all items
    await ItemModel.updateMany(
      { roomId: room._id, deletedAt: null },
      { deletedAt: new Date() }
    );

    AuditLogModel.log({
      roomId: room._id,
      userId: user?._id,
      action: 'room.deleted',
      category: 'room',
      actor: { type: 'user', userId: user?._id },
    }).catch(() => {});

    return { success: true };
  })

  // List user's rooms (requires auth)
  .get('/my/rooms', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(ERROR_CODES.UNAUTHORIZED, 'Unauthorized');
    }

    const rooms = await RoomModel.find({
      ownerId: user._id,
      deletedAt: null,
    }).sort({ createdAt: -1 });

    return {
      success: true,
      data: {
        rooms: rooms.map((room) => room.toJSON()),
      },
    };
  })

  // Search items in room
  .get(
    '/:code/search',
    async ({ params, query, set }) => {
      const room = await RoomModel.findOne({
        code: params.code.toUpperCase(),
        deletedAt: null,
      });

      if (!room) {
        set.status = 404;
        return errorResponse(ERROR_CODES.ROOM_NOT_FOUND, 'Room not found');
      }

      const items = await ItemModel.find({
        roomId: room._id,
        deletedAt: null,
        $text: { $search: query.q },
      })
        .sort({ score: { $meta: 'textScore' } })
        .limit(query.limit || 20);

      return {
        success: true,
        data: {
          items: items.map((item) => item.toJSON()),
        },
      };
    },
    {
      params: t.Object({
        code: t.String({ minLength: 8, maxLength: 8 }),
      }),
      query: t.Object({
        q: t.String({ minLength: 1 }),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      }),
    }
  );
