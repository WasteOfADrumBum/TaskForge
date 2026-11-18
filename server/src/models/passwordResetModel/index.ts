import { Schema, model, type Types } from 'mongoose';

// Only a SHA-256 hash of the reset token is stored; the raw token exists only in the link.
const passwordResetSchema = new Schema(
  {
    // One outstanding link per account: issuing a new one replaces the old one atomically.
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    tokenHash: { type: String, required: true, unique: true },
    // MongoDB's TTL monitor deletes the document once this time passes (checked about once a minute),
    // so lookups also compare expiresAt and never rely on the TTL sweep alone.
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export interface PasswordResetDocument {
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
}

export const PasswordReset = model('PasswordReset', passwordResetSchema);
