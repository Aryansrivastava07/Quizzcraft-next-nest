import { Schema } from 'mongoose';

export const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

export interface GoogleSignInContext {
  redirect?: string;
  org?: string;
  group?: string;
}

export interface GoogleOAuthState extends GoogleSignInContext {
  _id: string;
  browserHash: string;
  expiresAt: Date;
}

export const GoogleOAuthStateSchema = new Schema<GoogleOAuthState>({
  _id: { type: String, required: true },
  browserHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  redirect: String,
  org: String,
  group: String,
});
