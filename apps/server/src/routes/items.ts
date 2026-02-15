import { Elysia, t } from 'elysia';
import { RoomModel, ItemModel, VersionModel, AuditLogModel } from '../models';
import { jwtPlugin, getAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { s3Helpers } from '../config/s3';
import { ERROR_CODES } from '@airshare/shared';
import { nanoid } from 'nanoid';
import { hashPassword, verifyPassword } from '../utils/password';

export const itemRoutes = new Elysia({ prefix: '/items' })
  .use(jwtPlugin)

  // Create item in room
  .post(
    '/rooms/:code',
    async (ctx: any) => {
      const { params, body } = ctx;
      const { user } = await getAuth(ctx);
      const room = await RoomModel.findOne({
        code: params.code.toUpperCase(),
        deletedAt: null,
      });

      if (!room) {
        throw new AppError(ERROR_CODES.ROOM_NOT_FOUND, 'Room not found', 404);
      }

      // Check room item limit
      const itemCount = await ItemModel.countDocuments({
        roomId: room._id,
        deletedAt: null,
      });

      if (itemCount >= room.settings.maxItems) {
        throw new AppError(ERROR_CODES.ROOM_FULL, 'Room has reached maximum items', 400);
      }

      // Hash password if provided
      let accessConfig = body.access || { type: 'public' as const, downloadCount: 0, oneTimeAccess: false };
      if (accessConfig.password) {
        accessConfig = {
          ...accessConfig,
          type: 'password' as const,
          passwordHash: await hashPassword(accessConfig.password),
        };
        delete (accessConfig as { password?: string }).password;
      }

      // Generate share URL
      const shareUrl = nanoid(10);

      // Create item
      const item = await ItemModel.create({
        roomId: room._id,
        parentId: body.parentId,
        type: body.type,
        content: { type: body.type, data: body.content },
        access: accessConfig,
        shareUrl,
        createdBy: user?._id,
      });

      // Create initial version for versionable content
      if (['text', 'code', 'note'].includes(body.type)) {
        await VersionModel.createVersion(
          item._id.toString(),
          room._id.toString(),
          { type: body.type, data: body.content },
          user?._id?.toString()
        );
      }

      // Update room activity
      room.lastActivityAt = new Date();
      await room.save();

      // Audit log
      await AuditLogModel.log({
        roomId: room._id,
        itemId: item._id,
        userId: user?._id,
        action: 'item.created',
        category: 'item',
        actor: {
          type: user ? 'user' : 'anonymous',
          userId: user?._id,
        },
        details: { type: body.type },
      });

      return {
        success: true,
        data: { item: item.toJSON() },
      };
    },
    {
      params: t.Object({
        code: t.String({ minLength: 8, maxLength: 8 }),
      }),
      body: t.Object({
        type: t.Union([
          t.Literal('text'),
          t.Literal('link'),
          t.Literal('code'),
          t.Literal('note'),
          t.Literal('folder'),
        ]),
        content: t.Any(),
        parentId: t.Optional(t.String()),
        access: t.Optional(
          t.Object({
            type: t.Optional(t.Union([t.Literal('public'), t.Literal('private'), t.Literal('password')])),
            password: t.Optional(t.String({ minLength: 4 })),
            expiresAt: t.Optional(t.String()),
            maxDownloads: t.Optional(t.Number()),
            oneTimeAccess: t.Optional(t.Boolean()),
          })
        ),
      }),
    }
  )

  // Get item by ID
  .get(
    '/:id',
    async (ctx: any) => {
      const { params, query } = ctx;
      const { user } = await getAuth(ctx);
      const item = await ItemModel.findOne({
        _id: params.id,
        deletedAt: null,
      }).populate('roomId');

      if (!item) {
        throw new AppError(ERROR_CODES.ITEM_NOT_FOUND, 'Item not found', 404);
      }

      // Check expiry
      if (item.access.expiresAt && item.access.expiresAt < new Date()) {
        throw new AppError(ERROR_CODES.ITEM_EXPIRED, 'Item has expired', 410);
      }

      // Check download limit
      if (item.access.maxDownloads && item.access.downloadCount >= item.access.maxDownloads) {
        throw new AppError(ERROR_CODES.ITEM_DOWNLOAD_LIMIT, 'Download limit reached', 410);
      }

      // Check password
      if (item.access.type === 'password' && !item.createdBy?.equals(user?._id)) {
        if (!query.password) {
          throw new AppError(ERROR_CODES.ROOM_PASSWORD_REQUIRED, 'Password required', 401);
        }
        const valid = await verifyPassword(item.access.passwordHash!, query.password);
        if (!valid) {
          throw new AppError(ERROR_CODES.ROOM_PASSWORD_INVALID, 'Invalid password', 401);
        }
      }

      // Check private access
      if (item.access.type === 'private' && !item.createdBy?.equals(user?._id)) {
        throw new AppError(ERROR_CODES.ITEM_ACCESS_DENIED, 'Item is private', 403);
      }

      // Handle one-time access
      if (item.access.oneTimeAccess && item.access.accessedAt) {
        throw new AppError(ERROR_CODES.ITEM_EXPIRED, 'Item already accessed', 410);
      }

      // Increment access count
      if (!item.createdBy?.equals(user?._id)) {
        item.access.downloadCount += 1;
        item.access.accessedAt = new Date();
        await item.save();
      }

      await AuditLogModel.log({
        roomId: item.roomId as unknown as import('mongoose').Types.ObjectId,
        itemId: item._id,
        userId: user?._id,
        action: 'item.viewed',
        category: 'item',
        actor: {
          type: user ? 'user' : 'anonymous',
          userId: user?._id,
        },
      });

      return {
        success: true,
        data: { item: item.toJSON() },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        password: t.Optional(t.String()),
      }),
    }
  )

  // Get item by share URL
  .get(
    '/share/:shareUrl',
    async (ctx: any) => {
      const { params, query } = ctx;
      const { user } = await getAuth(ctx);
      const item = await ItemModel.findOne({
        shareUrl: params.shareUrl,
        deletedAt: null,
      });

      if (!item) {
        throw new AppError(ERROR_CODES.ITEM_NOT_FOUND, 'Item not found', 404);
      }

      // Same access checks as above
      if (item.access.expiresAt && item.access.expiresAt < new Date()) {
        throw new AppError(ERROR_CODES.ITEM_EXPIRED, 'Item has expired', 410);
      }

      if (item.access.maxDownloads && item.access.downloadCount >= item.access.maxDownloads) {
        throw new AppError(ERROR_CODES.ITEM_DOWNLOAD_LIMIT, 'Download limit reached', 410);
      }

      if (item.access.type === 'password') {
        if (!query.password) {
          throw new AppError(ERROR_CODES.ROOM_PASSWORD_REQUIRED, 'Password required', 401);
        }
        const valid = await verifyPassword(item.access.passwordHash!, query.password);
        if (!valid) {
          throw new AppError(ERROR_CODES.ROOM_PASSWORD_INVALID, 'Invalid password', 401);
        }
      }

      if (item.access.type === 'private' && !item.createdBy?.equals(user?._id)) {
        throw new AppError(ERROR_CODES.ITEM_ACCESS_DENIED, 'Item is private', 403);
      }

      if (item.access.oneTimeAccess && item.access.accessedAt) {
        throw new AppError(ERROR_CODES.ITEM_EXPIRED, 'Item already accessed', 410);
      }

      item.access.downloadCount += 1;
      item.access.accessedAt = new Date();
      await item.save();

      return {
        success: true,
        data: { item: item.toJSON() },
      };
    },
    {
      params: t.Object({
        shareUrl: t.String(),
      }),
      query: t.Object({
        password: t.Optional(t.String()),
      }),
    }
  )

  // Update item
  .patch(
    '/:id',
    async (ctx: any) => {
      const { params, body } = ctx;
      const { user } = await getAuth(ctx);
      const item = await ItemModel.findOne({
        _id: params.id,
        deletedAt: null,
      });

      if (!item) {
        throw new AppError(ERROR_CODES.ITEM_NOT_FOUND, 'Item not found', 404);
      }

      // Check ownership
      if (item.createdBy && !item.createdBy.equals(user?._id)) {
        throw AppError.forbidden('Only item owner can update');
      }

      // Create version before updating (for versionable content)
      if (body.content && ['text', 'code', 'note'].includes(item.type)) {
        await VersionModel.createVersion(
          item._id.toString(),
          item.roomId.toString(),
          { type: item.type, data: body.content },
          user?._id?.toString()
        );

        // Prune old versions
        await VersionModel.pruneVersions(item._id.toString(), 10);

        item.content = { type: item.type, data: body.content };
        item.version += 1;
      }

      // Update access
      if (body.access) {
        if (body.access.password) {
          item.access.type = 'password';
          item.access.passwordHash = await hash(body.access.password);
        } else if (body.access.type) {
          item.access.type = body.access.type;
        }

        if (body.access.expiresAt !== undefined) {
          item.access.expiresAt = body.access.expiresAt ? new Date(body.access.expiresAt) : undefined;
        }
        if (body.access.maxDownloads !== undefined) {
          item.access.maxDownloads = body.access.maxDownloads;
        }
        if (body.access.oneTimeAccess !== undefined) {
          item.access.oneTimeAccess = body.access.oneTimeAccess;
        }
      }

      await item.save();

      await AuditLogModel.log({
        roomId: item.roomId,
        itemId: item._id,
        userId: user?._id,
        action: 'item.updated',
        category: 'item',
        actor: { type: 'user', userId: user?._id },
      });

      return {
        success: true,
        data: { item: item.toJSON() },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        content: t.Optional(t.Any()),
        access: t.Optional(
          t.Object({
            type: t.Optional(t.Union([t.Literal('public'), t.Literal('private'), t.Literal('password')])),
            password: t.Optional(t.String({ minLength: 4 })),
            expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
            maxDownloads: t.Optional(t.Union([t.Number(), t.Null()])),
            oneTimeAccess: t.Optional(t.Boolean()),
          })
        ),
      }),
    }
  )

  // Delete item
  .delete('/:id', async (ctx: any) => {
    const { params } = ctx;
    const { user } = await getAuth(ctx);
    const item = await ItemModel.findOne({
      _id: params.id,
      deletedAt: null,
    });

    if (!item) {
      throw new AppError(ERROR_CODES.ITEM_NOT_FOUND, 'Item not found', 404);
    }

    // Check ownership
    if (item.createdBy && !item.createdBy.equals(user?._id)) {
      throw AppError.forbidden('Only item owner can delete');
    }

    // Soft delete
    item.deletedAt = new Date();
    await item.save();

    // If folder, soft delete children
    if (item.type === 'folder') {
      await ItemModel.updateMany(
        { parentId: item._id, deletedAt: null },
        { deletedAt: new Date() }
      );
    }

    await AuditLogModel.log({
      roomId: item.roomId,
      itemId: item._id,
      userId: user?._id,
      action: 'item.deleted',
      category: 'item',
      actor: { type: 'user', userId: user?._id },
    });

    return { success: true };
  })

  // Get item versions
  .get('/:id/versions', async ({ params, query }) => {
    const item = await ItemModel.findOne({
      _id: params.id,
      deletedAt: null,
    });

    if (!item) {
      throw new AppError(ERROR_CODES.ITEM_NOT_FOUND, 'Item not found', 404);
    }

    const versions = await VersionModel.find({ itemId: item._id })
      .sort({ version: -1 })
      .limit(query.limit || 10);

    return {
      success: true,
      data: {
        versions: versions.map((v) => v.toJSON()),
      },
    };
  })

  // Restore item version
  .post('/:id/versions/:version/restore', async (ctx: any) => {
    const { params } = ctx;
    const { user } = await getAuth(ctx);
    const item = await ItemModel.findOne({
      _id: params.id,
      deletedAt: null,
    });

    if (!item) {
      throw new AppError(ERROR_CODES.ITEM_NOT_FOUND, 'Item not found', 404);
    }

    if (item.createdBy && !item.createdBy.equals(user?._id)) {
      throw AppError.forbidden('Only item owner can restore versions');
    }

    const version = await VersionModel.findOne({
      itemId: item._id,
      version: parseInt(params.version),
    });

    if (!version) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Version not found', 404);
    }

    // Create new version with current content
    await VersionModel.createVersion(
      item._id.toString(),
      item.roomId.toString(),
      item.content,
      user?._id?.toString()
    );

    // Restore the old version's content
    item.content = version.content;
    item.version += 1;
    await item.save();

    return {
      success: true,
      data: { item: item.toJSON() },
    };
  })

  // Download file
  .get('/:id/download', async (ctx: any) => {
    const { params, query, set } = ctx;
    const { user } = await getAuth(ctx);
    const item = await ItemModel.findOne({
      _id: params.id,
      deletedAt: null,
      type: { $in: ['file', 'image'] },
    });

    if (!item) {
      throw new AppError(ERROR_CODES.ITEM_NOT_FOUND, 'Item not found', 404);
    }

    // Access checks
    if (item.access.expiresAt && item.access.expiresAt < new Date()) {
      throw new AppError(ERROR_CODES.ITEM_EXPIRED, 'Item has expired', 410);
    }

    if (item.access.maxDownloads && item.access.downloadCount >= item.access.maxDownloads) {
      throw new AppError(ERROR_CODES.ITEM_DOWNLOAD_LIMIT, 'Download limit reached', 410);
    }

    if (item.access.type === 'password') {
      if (!query.password) {
        throw new AppError(ERROR_CODES.ROOM_PASSWORD_REQUIRED, 'Password required', 401);
      }
      const valid = await verify(item.access.passwordHash!, query.password);
      if (!valid) {
        throw new AppError(ERROR_CODES.ROOM_PASSWORD_INVALID, 'Invalid password', 401);
      }
    }

    if (item.access.type === 'private' && !item.createdBy?.equals(user?._id)) {
      throw new AppError(ERROR_CODES.ITEM_ACCESS_DENIED, 'Item is private', 403);
    }

    if (item.access.oneTimeAccess && item.access.accessedAt) {
      throw new AppError(ERROR_CODES.ITEM_EXPIRED, 'Item already accessed', 410);
    }

    // Increment download count
    item.access.downloadCount += 1;
    item.access.accessedAt = new Date();
    await item.save();

    // Get presigned download URL
    const content = item.content.data as { storageKey: string; filename: string };
    const downloadUrl = await s3Helpers.getPresignedDownloadUrl(
      content.storageKey,
      content.filename,
      3600
    );

    await AuditLogModel.log({
      roomId: item.roomId,
      itemId: item._id,
      userId: user?._id,
      action: 'item.downloaded',
      category: 'item',
      actor: {
        type: user ? 'user' : 'anonymous',
        userId: user?._id,
      },
    });

    // Redirect to presigned URL
    set.redirect = downloadUrl;
    return;
  });
