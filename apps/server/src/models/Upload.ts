import mongoose, { Schema, Document } from 'mongoose';

export interface UploadDocument extends Document {
  uploadId: string;
  roomId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  s3UploadId?: string;
  encrypted: boolean;
  encryptionIV?: string;
  parentId?: mongoose.Types.ObjectId;
  access?: Record<string, unknown>;
  chunks: Array<{
    index: number;
    etag?: string;
    uploaded: boolean;
  }>;
  totalChunks: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const uploadChunkSchema = new Schema(
  {
    index: { type: Number, required: true },
    etag: { type: String },
    uploaded: { type: Boolean, default: false },
  },
  { _id: false }
);

const uploadSchema = new Schema<UploadDocument>(
  {
    uploadId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    filename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    s3UploadId: {
      type: String,
    },
    encrypted: {
      type: Boolean,
      default: false,
    },
    encryptionIV: {
      type: String,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
    },
    access: {
      type: Schema.Types.Mixed,
    },
    chunks: {
      type: [uploadChunkSchema],
      default: [],
    },
    totalChunks: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'uploading', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// TTL index - auto-delete incomplete uploads
uploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Indexes
uploadSchema.index({ status: 1 });
uploadSchema.index({ userId: 1, status: 1 });

// Methods
uploadSchema.methods.isComplete = function (): boolean {
  return this.chunks.every((chunk: { uploaded: boolean }) => chunk.uploaded);
};

uploadSchema.methods.getUploadedChunks = function (): number {
  return this.chunks.filter((chunk: { uploaded: boolean }) => chunk.uploaded).length;
};

uploadSchema.methods.getProgress = function (): number {
  const uploaded = this.getUploadedChunks();
  return Math.round((uploaded / this.totalChunks) * 100);
};

uploadSchema.methods.markChunkUploaded = async function (index: number, etag?: string): Promise<void> {
  const chunk = this.chunks.find((c: { index: number }) => c.index === index);
  if (chunk) {
    chunk.uploaded = true;
    if (etag) chunk.etag = etag;
    this.status = 'uploading';
    await this.save();
  }
};

// Statics
uploadSchema.statics.findByUploadId = function (uploadId: string) {
  return this.findOne({ uploadId });
};

uploadSchema.statics.findPendingByUser = function (userId: string) {
  return this.find({
    userId,
    status: { $in: ['pending', 'uploading'] },
  }).sort({ createdAt: -1 });
};

uploadSchema.statics.cleanupExpired = async function () {
  const expired = await this.find({
    status: { $in: ['pending', 'uploading'] },
    expiresAt: { $lt: new Date() },
  });
  return expired;
};

export const UploadModel = mongoose.model<UploadDocument>('Upload', uploadSchema);
