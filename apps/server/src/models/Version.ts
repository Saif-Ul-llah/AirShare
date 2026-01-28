import mongoose, { Schema, Document } from 'mongoose';
import type { Version, ItemContent } from '@airshare/shared';

export interface VersionDocument extends Omit<Version, 'id'>, Document {}

const versionSchema = new Schema<VersionDocument>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    size: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

// Indexes
versionSchema.index({ itemId: 1, version: -1 });
versionSchema.index({ roomId: 1 });
versionSchema.index({ createdAt: -1 });

// Compound unique index
versionSchema.index({ itemId: 1, version: 1 }, { unique: true });

// Statics
versionSchema.statics.findByItem = function (itemId: string, limit = 10) {
  return this.find({ itemId })
    .sort({ version: -1 })
    .limit(limit);
};

versionSchema.statics.findLatestVersion = function (itemId: string) {
  return this.findOne({ itemId }).sort({ version: -1 });
};

versionSchema.statics.createVersion = async function (
  itemId: string,
  roomId: string,
  content: ItemContent,
  createdBy?: string
) {
  const latest = await this.findLatestVersion(itemId);
  const version = latest ? latest.version + 1 : 1;

  // Calculate size based on content type
  let size = 0;
  if ('size' in content.data) {
    size = content.data.size;
  } else if ('content' in content.data) {
    size = Buffer.byteLength(content.data.content, 'utf8');
  }

  return this.create({
    itemId,
    roomId,
    version,
    content,
    createdBy,
    size,
  });
};

// Keep only N versions per item
versionSchema.statics.pruneVersions = async function (itemId: string, keepCount = 10) {
  const versions = await this.find({ itemId }).sort({ version: -1 }).skip(keepCount);
  if (versions.length > 0) {
    await this.deleteMany({
      _id: { $in: versions.map((v: VersionDocument) => v._id) },
    });
  }
  return versions.length;
};

export const VersionModel = mongoose.model<VersionDocument>('Version', versionSchema);
