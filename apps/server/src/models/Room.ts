import mongoose, { Schema, Document } from 'mongoose';
import type { Room, RoomSettings, RoomMode, RoomAccess, RoomLifespan } from '@airshare/shared';

export interface RoomDocument extends Omit<Room, 'id'>, Document {}

const roomSettingsSchema = new Schema<RoomSettings>(
  {
    maxItems: { type: Number, default: 100 },
    maxFileSize: { type: Number, default: 100 * 1024 * 1024 },
    allowedFileTypes: { type: [String], default: null },
    requirePassword: { type: Boolean, default: false },
    autoExpireItems: { type: Boolean, default: false },
    itemExpireDays: { type: Number, default: 7 },
  },
  { _id: false }
);

const roomSchema = new Schema<RoomDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      minlength: 8,
      maxlength: 8,
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
    },
    mode: {
      type: String,
      enum: ['local', 'internet'] as RoomMode[],
      required: true,
    },
    access: {
      type: String,
      enum: ['public', 'private', 'password'] as RoomAccess[],
      default: 'public',
    },
    lifespan: {
      type: String,
      enum: ['temporary', 'persistent'] as RoomLifespan[],
      default: 'temporary',
    },
    passwordHash: { type: String },
    encryptionSalt: { type: String },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
    settings: { type: roomSettingsSchema, default: () => ({}) },
    expiresAt: { type: Date },
    lastActivityAt: { type: Date, default: Date.now },
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
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Indexes
roomSchema.index({ code: 1 }, { unique: true });
roomSchema.index({ mode: 1 });
roomSchema.index({ ownerId: 1 });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
roomSchema.index({ lastActivityAt: -1 });
roomSchema.index({ deletedAt: 1 });

// Methods
roomSchema.methods.isExpired = function (): boolean {
  return this.expiresAt && this.expiresAt < new Date();
};

roomSchema.methods.isAccessible = function (): boolean {
  return !this.deletedAt && !this.isExpired();
};

// Statics
roomSchema.statics.findByCode = function (code: string) {
  return this.findOne({ code: code.toUpperCase(), deletedAt: null });
};

roomSchema.statics.findActiveRooms = function (filter = {}) {
  return this.find({
    ...filter,
    deletedAt: null,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
};

export const RoomModel = mongoose.model<RoomDocument>('Room', roomSchema);
