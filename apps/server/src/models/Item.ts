import mongoose, { Schema, Document } from 'mongoose';
import type { Item, ItemType, ItemAccess, ItemContent } from '@airshare/shared';

export interface ItemDocument extends Omit<Item, 'id'>, Document {}

const itemAccessSchema = new Schema<ItemAccess>(
  {
    type: {
      type: String,
      enum: ['public', 'private', 'password'],
      default: 'public',
    },
    passwordHash: { type: String },
    expiresAt: { type: Date },
    maxDownloads: { type: Number },
    downloadCount: { type: Number, default: 0 },
    oneTimeAccess: { type: Boolean, default: false },
    accessedAt: { type: Date },
  },
  { _id: false }
);

const fileContentSchema = new Schema(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true },
    encrypted: { type: Boolean, default: false },
    encryptionIV: { type: String },
    checksum: { type: String, required: true },
  },
  { _id: false }
);

const folderContentSchema = new Schema(
  {
    name: { type: String, required: true },
    itemCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const textContentSchema = new Schema(
  {
    content: { type: String, required: true },
    encrypted: { type: Boolean, default: false },
    encryptionIV: { type: String },
  },
  { _id: false }
);

const linkContentSchema = new Schema(
  {
    url: { type: String, required: true },
    title: { type: String },
    description: { type: String },
    image: { type: String },
    favicon: { type: String },
  },
  { _id: false }
);

const imageContentSchema = new Schema(
  {
    ...fileContentSchema.obj,
    width: { type: Number },
    height: { type: Number },
    thumbnailKey: { type: String },
  },
  { _id: false }
);

const codeContentSchema = new Schema(
  {
    content: { type: String, required: true },
    language: { type: String, required: true },
    filename: { type: String },
    encrypted: { type: Boolean, default: false },
    encryptionIV: { type: String },
  },
  { _id: false }
);

const noteContentSchema = new Schema(
  {
    title: { type: String, required: true },
    content: { type: String, default: '' },
    encrypted: { type: Boolean, default: false },
    encryptionIV: { type: String },
  },
  { _id: false }
);

const itemSchema = new Schema<ItemDocument>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
    },
    type: {
      type: String,
      enum: ['file', 'folder', 'text', 'link', 'image', 'code', 'note'] as ItemType[],
      required: true,
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
    access: {
      type: itemAccessSchema,
      default: () => ({}),
    },
    shareUrl: {
      type: String,
      unique: true,
      sparse: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    version: {
      type: Number,
      default: 1,
    },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.access?.passwordHash) {
          delete ret.access.passwordHash;
        }
        return ret;
      },
    },
  }
);

// Indexes
itemSchema.index({ roomId: 1, type: 1 });
itemSchema.index({ roomId: 1, parentId: 1 });
itemSchema.index({ roomId: 1, createdAt: -1 });
itemSchema.index({ shareUrl: 1 }, { unique: true, sparse: true });
itemSchema.index({ 'access.expiresAt': 1 }, { expireAfterSeconds: 0 });
itemSchema.index({ deletedAt: 1 });

// Text search index for content
itemSchema.index(
  {
    'content.filename': 'text',
    'content.title': 'text',
    'content.content': 'text',
    'content.name': 'text',
  },
  {
    weights: {
      'content.filename': 10,
      'content.title': 10,
      'content.name': 5,
      'content.content': 1,
    },
  }
);

// Methods
itemSchema.methods.isExpired = function (): boolean {
  return this.access?.expiresAt && this.access.expiresAt < new Date();
};

itemSchema.methods.isDownloadLimitReached = function (): boolean {
  if (!this.access?.maxDownloads) return false;
  return this.access.downloadCount >= this.access.maxDownloads;
};

itemSchema.methods.incrementDownloadCount = async function (): Promise<void> {
  this.access.downloadCount += 1;
  this.access.accessedAt = new Date();
  await this.save();
};

// Statics
itemSchema.statics.findByRoom = function (roomId: string, type?: ItemType) {
  const query: Record<string, unknown> = { roomId, deletedAt: null };
  if (type) query.type = type;
  return this.find(query).sort({ createdAt: -1 });
};

itemSchema.statics.findByShareUrl = function (shareUrl: string) {
  return this.findOne({ shareUrl, deletedAt: null });
};

itemSchema.statics.search = function (roomId: string, query: string, limit = 20) {
  return this.find({
    roomId,
    deletedAt: null,
    $text: { $search: query },
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit);
};

export const ItemModel = mongoose.model<ItemDocument>('Item', itemSchema);
