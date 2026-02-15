import { Elysia, t } from 'elysia';
import { RoomModel, ItemModel, UserModel, AuditLogModel } from '../models';
import { jwtPlugin, requireAdmin } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { s3Helpers } from '../config/s3';
import { redisHelpers, redis } from '../config/redis';
import { ERROR_CODES } from '@airshare/shared';

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(jwtPlugin)

  // Dashboard stats
  .get('/stats', async (ctx: any) => {
    await requireAdmin(ctx);
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalRooms,
      activeRooms24h,
      totalUsers,
      totalItems,
      uploadsToday,
      storageUsed,
    ] = await Promise.all([
      RoomModel.countDocuments({ deletedAt: null }),
      RoomModel.countDocuments({ deletedAt: null, lastActivityAt: { $gte: dayAgo } }),
      UserModel.countDocuments(),
      ItemModel.countDocuments({ deletedAt: null }),
      AuditLogModel.countDocuments({
        action: 'item.created',
        timestamp: { $gte: dayAgo },
        'details.type': { $in: ['file', 'image'] },
      }),
      UserModel.aggregate([
        { $group: { _id: null, total: { $sum: '$storage.used' } } },
      ]).then((r) => r[0]?.total || 0),
    ]);

    return {
      success: true,
      data: {
        totalRooms,
        activeRooms24h,
        totalUsers,
        totalItems,
        uploadsToday,
        storageUsed,
      },
    };
  })

  // List rooms with filters
  .get(
    '/rooms',
    async (ctx: any) => {
      await requireAdmin(ctx);
      const { query } = ctx;
      const filter: Record<string, unknown> = {};

      if (query.mode) filter.mode = query.mode;
      if (query.access) filter.access = query.access;
      if (query.search) {
        filter.$or = [
          { name: { $regex: query.search, $options: 'i' } },
          { code: { $regex: query.search.toUpperCase(), $options: 'i' } },
        ];
      }
      if (!query.includeDeleted) {
        filter.deletedAt = null;
      }

      const [rooms, total] = await Promise.all([
        RoomModel.find(filter)
          .sort({ createdAt: -1 })
          .skip((query.page - 1) * query.pageSize)
          .limit(query.pageSize)
          .populate('ownerId', 'email displayName'),
        RoomModel.countDocuments(filter),
      ]);

      // Get item counts for each room
      const roomsWithCounts = await Promise.all(
        rooms.map(async (room) => {
          const itemCount = await ItemModel.countDocuments({
            roomId: room._id,
            deletedAt: null,
          });
          return {
            ...room.toJSON(),
            itemCount,
          };
        })
      );

      return {
        success: true,
        data: {
          rooms: roomsWithCounts,
          total,
          page: query.page,
          pageSize: query.pageSize,
          hasMore: query.page * query.pageSize < total,
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
        mode: t.Optional(t.Union([t.Literal('local'), t.Literal('internet')])),
        access: t.Optional(t.Union([t.Literal('public'), t.Literal('private'), t.Literal('password')])),
        search: t.Optional(t.String()),
        includeDeleted: t.Optional(t.Boolean()),
      }),
    }
  )

  // Disable room
  .post(
    '/rooms/:code/disable',
    async (ctx: any) => {
      const { user } = await requireAdmin(ctx);
      const { params, body } = ctx;
      const room = await RoomModel.findOne({ code: params.code.toUpperCase() });

      if (!room) {
        throw new AppError(ERROR_CODES.ROOM_NOT_FOUND, 'Room not found', 404);
      }

      room.set('settings.disabled', true);
      room.set('settings.disabledReason', body.reason);
      room.set('settings.disabledAt', new Date());
      room.set('settings.disabledBy', user._id);
      await room.save();

      await AuditLogModel.log({
        roomId: room._id,
        action: 'admin.room_disabled',
        category: 'admin',
        actor: { type: 'admin', userId: user._id },
        details: { reason: body.reason },
      });

      return { success: true };
    },
    {
      params: t.Object({
        code: t.String(),
      }),
      body: t.Object({
        reason: t.String({ minLength: 1, maxLength: 500 }),
      }),
    }
  )

  // Delete room (hard delete with files)
  .delete(
    '/rooms/:code',
    async (ctx: any) => {
      const { user } = await requireAdmin(ctx);
      const { params, query } = ctx;
      const room = await RoomModel.findOne({ code: params.code.toUpperCase() });

      if (!room) {
        throw new AppError(ERROR_CODES.ROOM_NOT_FOUND, 'Room not found', 404);
      }

      // Delete files from S3 if requested
      if (query.deleteFiles) {
        const items = await ItemModel.find({
          roomId: room._id,
          type: { $in: ['file', 'image'] },
        });

        for (const item of items) {
          const content = item.content.data as { storageKey?: string };
          if (content.storageKey) {
            try {
              await s3Helpers.deleteFile(content.storageKey);
            } catch (error) {
              console.error('Failed to delete file:', content.storageKey, error);
            }
          }
        }
      }

      // Delete all items
      await ItemModel.deleteMany({ roomId: room._id });

      // Delete room
      await RoomModel.deleteOne({ _id: room._id });

      await AuditLogModel.log({
        roomId: room._id,
        action: 'admin.room_deleted',
        category: 'admin',
        actor: { type: 'admin', userId: user._id },
        details: { deleteFiles: query.deleteFiles },
      });

      return { success: true };
    },
    {
      params: t.Object({
        code: t.String(),
      }),
      query: t.Object({
        deleteFiles: t.Optional(t.Boolean()),
      }),
    }
  )

  // List users
  .get(
    '/users',
    async (ctx: any) => {
      await requireAdmin(ctx);
      const { query } = ctx;
      const filter: Record<string, unknown> = {};

      if (query.search) {
        filter.$or = [
          { email: { $regex: query.search, $options: 'i' } },
          { displayName: { $regex: query.search, $options: 'i' } },
        ];
      }
      if (query.suspended) {
        filter['suspension.active'] = true;
      }

      const [users, total] = await Promise.all([
        UserModel.find(filter)
          .sort({ createdAt: -1 })
          .skip((query.page - 1) * query.pageSize)
          .limit(query.pageSize),
        UserModel.countDocuments(filter),
      ]);

      return {
        success: true,
        data: {
          users: users.map((u) => u.toJSON()),
          total,
          page: query.page,
          pageSize: query.pageSize,
          hasMore: query.page * query.pageSize < total,
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
        search: t.Optional(t.String()),
        suspended: t.Optional(t.Boolean()),
      }),
    }
  )

  // Suspend user
  .post(
    '/users/:id/suspend',
    async (ctx: any) => {
      const { user } = await requireAdmin(ctx);
      const { params, body } = ctx;
      const targetUser = await UserModel.findById(params.id);

      if (!targetUser) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found', 404);
      }

      const suspendUntil = body.duration
        ? new Date(Date.now() + body.duration * 60 * 60 * 1000)
        : undefined;

      targetUser.suspension = {
        active: true,
        reason: body.reason,
        until: suspendUntil,
        by: user._id,
        at: new Date(),
      };
      await targetUser.save();

      // Invalidate all sessions
      await redisHelpers.deleteAllUserSessions(targetUser._id.toString());

      await AuditLogModel.log({
        userId: targetUser._id,
        action: 'admin.user_suspended',
        category: 'admin',
        actor: { type: 'admin', userId: user._id },
        details: { reason: body.reason, duration: body.duration },
      });

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        reason: t.String({ minLength: 1, maxLength: 500 }),
        duration: t.Optional(t.Number({ minimum: 1 })), // hours
      }),
    }
  )

  // Unsuspend user
  .post('/users/:id/unsuspend', async (ctx: any) => {
    const { user } = await requireAdmin(ctx);
    const { params } = ctx;
    const targetUser = await UserModel.findById(params.id);

    if (!targetUser) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found', 404);
    }

    targetUser.suspension = {
      active: false,
    };
    await targetUser.save();

    await AuditLogModel.log({
      userId: targetUser._id,
      action: 'admin.user_unsuspended',
      category: 'admin',
      actor: { type: 'admin', userId: user._id },
    });

    return { success: true };
  })

  // Get audit logs
  .get(
    '/audit-logs',
    async (ctx: any) => {
      await requireAdmin(ctx);
      const { query } = ctx;
      const filter: Record<string, unknown> = {};

      if (query.category) filter.category = query.category;
      if (query.action) filter.action = query.action;
      if (query.roomId) filter.roomId = query.roomId;
      if (query.userId) filter.userId = query.userId;
      if (query.since) filter.timestamp = { $gte: new Date(query.since) };

      const logs = await AuditLogModel.find(filter)
        .sort({ timestamp: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .populate('userId', 'email displayName')
        .populate('actor.userId', 'email displayName');

      const total = await AuditLogModel.countDocuments(filter);

      return {
        success: true,
        data: {
          logs: logs.map((l) => l.toJSON()),
          total,
          page: query.page,
          pageSize: query.pageSize,
          hasMore: query.page * query.pageSize < total,
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 50 })),
        category: t.Optional(t.String()),
        action: t.Optional(t.String()),
        roomId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
        since: t.Optional(t.String()),
      }),
    }
  )

  // Get security events
  .get('/security', async (ctx: any) => {
    await requireAdmin(ctx);
    const { query } = ctx;
    const since = query.since ? new Date(query.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const events = await AuditLogModel.find({
      category: 'security',
      timestamp: { $gte: since },
    })
      .sort({ timestamp: -1 })
      .limit(100);

    const summary = await AuditLogModel.aggregate([
      { $match: { category: 'security', timestamp: { $gte: since } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
    ]);

    return {
      success: true,
      data: {
        events: events.map((e) => e.toJSON()),
        summary: Object.fromEntries(summary.map((s) => [s._id, s.count])),
      },
    };
  });
