import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: env.R2_ACCOUNT_ID
    ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined,
  credentials: env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export const s3Helpers = {
  async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
  },

  async getPresignedDownloadUrl(key: string, filename: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
  },

  async uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    await s3Client.send(new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  },

  async deleteFile(key: string): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
    }));
  },

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    const response = await s3Client.send(new CreateMultipartUploadCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    }));
    return response.UploadId!;
  },

  async getUploadPartUrl(key: string, uploadId: string, partNumber: number, expiresIn = 3600): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
  },

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>
  ): Promise<void> {
    await s3Client.send(new CompleteMultipartUploadCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }));
  },

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await s3Client.send(new AbortMultipartUploadCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      UploadId: uploadId,
    }));
  },
};
