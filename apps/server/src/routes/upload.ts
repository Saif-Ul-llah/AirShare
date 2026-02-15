import { Elysia, t } from 'elysia';
import { RoomModel, ItemModel, UploadModel, UserModel, AuditLogModel } from '../models';
import { jwtPlugin, getAuth } from '../middleware/auth';
import { uploadRateLimiter } from '../middleware/rateLimit';
import { AppError } from '../middleware/errorHandler';
import { s3Helpers } from '../config/s3';
import { ERROR_CODES, UPLOAD_CHUNK_SIZE, MAX_FILE_SIZE } from '@airshare/shared';
import { nanoid } from 'nanoid';

export const uploadRoutes = new Elysia({ prefix: '/upload' })
  .use(jwtPlugin)
  .use(uploadRateLimiter)

  // Initialize upload
  .post(
    '/init',
    async (ctx: any) => {
      const { body } = ctx;
      const { user } = await getAuth(ctx);
      const room = await RoomModel.findOne({
        code: body.roomCode.toUpperCase(),
        deletedAt: null,
      });

      if (!room) {
        throw new AppError(ERROR_CODES.ROOM_NOT_FOUND, 'Room not found', 404);
      }

      // Check file size
      if (body.size > MAX_FILE_SIZE) {
        throw new AppError(ERROR_CODES.UPLOAD_SIZE_EXCEEDED, 'File too large', 400);
      }

      // Check room's max file size setting
      if (body.size > room.settings.maxFileSize) {
        throw new AppError(
          ERROR_CODES.UPLOAD_SIZE_EXCEEDED,
          `File exceeds room limit of ${room.settings.maxFileSize} bytes`,
          400
        );
      }

      // Check allowed file types
      if (room.settings.allowedFileTypes) {
        const ext = body.filename.split('.').pop()?.toLowerCase();
        const allowed = room.settings.allowedFileTypes.some(
          (type) => type === body.mimeType || type === `.${ext}`
        );
        if (!allowed) {
          throw new AppError(ERROR_CODES.UPLOAD_TYPE_NOT_ALLOWED, 'File type not allowed', 400);
        }
      }

      // Check user storage quota if authenticated
      if (user) {
        if (!user.canUpload(body.size)) {
          throw new AppError(ERROR_CODES.STORAGE_QUOTA_EXCEEDED, 'Storage quota exceeded', 400);
        }
      }

      // Generate upload ID and storage key
      const uploadId = nanoid(21);
      const storageKey = `rooms/${room.code}/${uploadId}/${body.filename}`;

      // Calculate chunks
      const totalChunks = Math.ceil(body.size / UPLOAD_CHUNK_SIZE);
      const chunks = Array.from({ length: totalChunks }, (_, i) => ({
        index: i,
        uploaded: false,
      }));

      // Initiate multipart upload in S3
      let s3UploadId: string | undefined;
      if (totalChunks > 1) {
        s3UploadId = await s3Helpers.initiateMultipartUpload(storageKey, body.mimeType);
      }

      // Create upload record
      const upload = await UploadModel.create({
        uploadId,
        roomId: room._id,
        userId: user?._id,
        filename: body.filename,
        mimeType: body.mimeType,
        size: body.size,
        storageKey,
        s3UploadId,
        encrypted: body.encrypted || false,
        encryptionIV: body.encryptionIV,
        parentId: body.parentId,
        access: body.access,
        chunks,
        totalChunks,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Generate presigned URLs for chunks
      const presignedUrls: string[] = [];
      if (totalChunks === 1) {
        // Single part upload
        presignedUrls.push(await s3Helpers.getPresignedUploadUrl(storageKey, body.mimeType));
      } else {
        // Multipart upload
        for (let i = 0; i < totalChunks; i++) {
          const url = await s3Helpers.getUploadPartUrl(storageKey, s3UploadId!, i + 1);
          presignedUrls.push(url);
        }
      }

      return {
        success: true,
        data: {
          uploadId,
          chunkSize: UPLOAD_CHUNK_SIZE,
          totalChunks,
          presignedUrls,
          storageKey,
        },
      };
    },
    {
      body: t.Object({
        roomCode: t.String({ minLength: 8, maxLength: 8 }),
        filename: t.String({ minLength: 1, maxLength: 255 }),
        mimeType: t.String(),
        size: t.Number({ minimum: 1 }),
        encrypted: t.Optional(t.Boolean()),
        encryptionIV: t.Optional(t.String()),
        parentId: t.Optional(t.String()),
        access: t.Optional(t.Object({})),
      }),
    }
  )

  // Mark chunk as uploaded
  .post(
    '/chunk',
    async ({ body }) => {
      const upload = await UploadModel.findOne({ uploadId: body.uploadId });

      if (!upload) {
        throw new AppError(ERROR_CODES.UPLOAD_NOT_FOUND, 'Upload not found', 404);
      }

      if (upload.status === 'completed' || upload.status === 'cancelled') {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Upload already completed or cancelled', 400);
      }

      // Mark chunk as uploaded
      await upload.markChunkUploaded(body.chunkIndex, body.etag);

      return {
        success: true,
        data: {
          uploadedChunks: upload.getUploadedChunks(),
          totalChunks: upload.totalChunks,
          progress: upload.getProgress(),
        },
      };
    },
    {
      body: t.Object({
        uploadId: t.String(),
        chunkIndex: t.Number({ minimum: 0 }),
        etag: t.Optional(t.String()),
      }),
    }
  )

  // Complete upload
  .post(
    '/complete',
    async (ctx: any) => {
      const { body } = ctx;
      const { user } = await getAuth(ctx);
      const upload = await UploadModel.findOne({ uploadId: body.uploadId });

      if (!upload) {
        throw new AppError(ERROR_CODES.UPLOAD_NOT_FOUND, 'Upload not found', 404);
      }

      if (upload.status === 'completed') {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Upload already completed', 400);
      }

      // Verify all chunks uploaded
      if (!upload.isComplete()) {
        throw new AppError(
          ERROR_CODES.UPLOAD_CHUNK_INVALID,
          `Missing chunks: ${upload.totalChunks - upload.getUploadedChunks()} remaining`,
          400
        );
      }

      // Complete multipart upload if needed
      if (upload.s3UploadId && upload.totalChunks > 1) {
        const parts = upload.chunks
          .filter((c) => c.uploaded && c.etag)
          .map((c) => ({ PartNumber: c.index + 1, ETag: c.etag! }))
          .sort((a, b) => a.PartNumber - b.PartNumber);

        await s3Helpers.completeMultipartUpload(upload.storageKey, upload.s3UploadId, parts);
      }

      // Create item
      const isImage = upload.mimeType.startsWith('image/');
      const item = await ItemModel.create({
        roomId: upload.roomId,
        parentId: upload.parentId,
        type: isImage ? 'image' : 'file',
        content: {
          type: isImage ? 'image' : 'file',
          data: {
            filename: upload.filename,
            mimeType: upload.mimeType,
            size: upload.size,
            storageKey: upload.storageKey,
            encrypted: upload.encrypted,
            encryptionIV: upload.encryptionIV,
            checksum: body.checksum,
          },
        },
        access: upload.access || {
          type: 'public',
          downloadCount: 0,
          oneTimeAccess: false,
        },
        shareUrl: nanoid(10),
        createdBy: upload.userId,
      });

      // Update upload status
      upload.status = 'completed';
      await upload.save();

      // Update user storage if authenticated
      if (upload.userId) {
        const uploadUser = await UserModel.findById(upload.userId);
        if (uploadUser) {
          await uploadUser.addStorageUsage(upload.size);
        }
      }

      // Update room activity
      await RoomModel.updateOne(
        { _id: upload.roomId },
        { lastActivityAt: new Date() }
      );

      // Audit log
      await AuditLogModel.log({
        roomId: upload.roomId,
        itemId: item._id,
        userId: upload.userId,
        action: 'item.created',
        category: 'item',
        actor: {
          type: upload.userId ? 'user' : 'anonymous',
          userId: upload.userId,
        },
        details: {
          type: item.type,
          filename: upload.filename,
          size: upload.size,
        },
      });

      return {
        success: true,
        data: {
          item: item.toJSON(),
        },
      };
    },
    {
      body: t.Object({
        uploadId: t.String(),
        checksum: t.String(),
      }),
    }
  )

  // Cancel upload
  .delete('/:uploadId', async ({ params }) => {
    const upload = await UploadModel.findOne({ uploadId: params.uploadId });

    if (!upload) {
      throw new AppError(ERROR_CODES.UPLOAD_NOT_FOUND, 'Upload not found', 404);
    }

    if (upload.status === 'completed') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Cannot cancel completed upload', 400);
    }

    // Abort multipart upload if in progress
    if (upload.s3UploadId) {
      try {
        await s3Helpers.abortMultipartUpload(upload.storageKey, upload.s3UploadId);
      } catch (error) {
        console.error('Failed to abort multipart upload:', error);
      }
    }

    upload.status = 'cancelled';
    await upload.save();

    return { success: true };
  })

  // Get upload status
  .get('/:uploadId', async ({ params }) => {
    const upload = await UploadModel.findOne({ uploadId: params.uploadId });

    if (!upload) {
      throw new AppError(ERROR_CODES.UPLOAD_NOT_FOUND, 'Upload not found', 404);
    }

    return {
      success: true,
      data: {
        uploadId: upload.uploadId,
        filename: upload.filename,
        size: upload.size,
        status: upload.status,
        uploadedChunks: upload.getUploadedChunks(),
        totalChunks: upload.totalChunks,
        progress: upload.getProgress(),
      },
    };
  });
