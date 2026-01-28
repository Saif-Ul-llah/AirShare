import mongoose, { Schema, Document } from 'mongoose';
import type { User, UserPreferences } from '@airshare/shared';

export interface UserDocument extends Omit<User, 'id'>, Document {
  comparePassword(password: string): Promise<boolean>;
}

const userPreferencesSchema = new Schema<UserPreferences>(
  {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    defaultRoomMode: {
      type: String,
      enum: ['local', 'internet'],
      default: 'internet',
    },
    defaultRoomAccess: {
      type: String,
      enum: ['public', 'private', 'password'],
      default: 'public',
    },
    notifications: { type: Boolean, default: true },
  },
  { _id: false }
);

const suspensionSchema = new Schema(
  {
    active: { type: Boolean, default: false },
    reason: { type: String },
    until: { type: Date },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date },
  },
  { _id: false }
);

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      maxlength: 100,
    },
    avatar: { type: String },
    storage: {
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 1024 * 1024 * 1024 }, // 1GB default
    },
    preferences: {
      type: userPreferencesSchema,
      default: () => ({}),
    },
    lastLoginAt: { type: Date },
    emailVerified: { type: Boolean, default: false },
    suspension: {
      type: suspensionSchema,
      default: () => ({}),
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
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
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'suspension.active': 1 });

// Methods
userSchema.methods.isSuspended = function (): boolean {
  if (!this.suspension?.active) return false;
  if (this.suspension.until && this.suspension.until < new Date()) {
    return false;
  }
  return true;
};

userSchema.methods.canUpload = function (fileSize: number): boolean {
  return this.storage.used + fileSize <= this.storage.limit;
};

userSchema.methods.addStorageUsage = async function (bytes: number): Promise<void> {
  this.storage.used += bytes;
  await this.save();
};

userSchema.methods.removeStorageUsage = async function (bytes: number): Promise<void> {
  this.storage.used = Math.max(0, this.storage.used - bytes);
  await this.save();
};

// Statics
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
