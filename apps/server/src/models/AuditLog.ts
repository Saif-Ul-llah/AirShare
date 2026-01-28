import mongoose, { Schema, Document } from 'mongoose';
import type { AuditLog, AuditAction, AuditCategory } from '@airshare/shared';

export interface AuditLogDocument extends Omit<AuditLog, 'id'>, Document {}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['room', 'item', 'user', 'security', 'admin'] as AuditCategory[],
      required: true,
      index: true,
    },
    actor: {
      type: {
        type: String,
        enum: ['user', 'admin', 'system', 'anonymous'],
        required: true,
      },
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      ip: { type: String },
      userAgent: { type: String },
    },
    details: {
      type: Schema.Types.Mixed,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
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
auditLogSchema.index({ roomId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// TTL index - keep logs for 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Statics
auditLogSchema.statics.log = async function (data: Partial<AuditLog>) {
  return this.create({
    ...data,
    timestamp: new Date(),
  });
};

auditLogSchema.statics.findByRoom = function (roomId: string, options: { limit?: number; skip?: number } = {}) {
  return this.find({ roomId })
    .sort({ timestamp: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 50);
};

auditLogSchema.statics.findByUser = function (userId: string, options: { limit?: number; skip?: number } = {}) {
  return this.find({ $or: [{ userId }, { 'actor.userId': userId }] })
    .sort({ timestamp: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 50);
};

auditLogSchema.statics.findSecurityEvents = function (options: { limit?: number; since?: Date } = {}) {
  const query: Record<string, unknown> = { category: 'security' };
  if (options.since) {
    query.timestamp = { $gte: options.since };
  }
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100);
};

auditLogSchema.statics.countByAction = function (action: AuditAction, since: Date) {
  return this.countDocuments({
    action,
    timestamp: { $gte: since },
  });
};

export const AuditLogModel = mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);
