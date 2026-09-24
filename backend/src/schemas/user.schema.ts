import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export class UserSettings {
  @Prop({ default: true })
  starfieldMotion!: boolean;

  @Prop({ default: false })
  highContrast!: boolean;

  @Prop({ default: true })
  kioskAutoLock!: boolean;

  @Prop({ default: true })
  liveArenaInvites!: boolean;

  @Prop({ default: true })
  leaderboardSurgeAlerts!: boolean;

  @Prop({ default: true })
  weeklyDigest!: boolean;
}

@Schema()
export class User {
  // @Prop()
  // _id?: string;

  @Prop({ unique: true, required: true })
  username!: string;

  @Prop({ default: '' })
  fullName!: string;

  @Prop({ unique: true, required: true })
  email!: string;

  @Prop({ type: [String], default: [] })
  emails!: string[];

  @Prop()
  password!: string;

  @Prop({ default: false })
  verified!: boolean;

  @Prop({ default: '' })
  profilePicture!: string;

  @Prop({ default: '' })
  institution!: string;

  @Prop({ default: '' })
  bio!: string;

  @Prop({ default: null })
  mobileNo!: Number;

  @Prop({ default: '' })
  address!: string;

  @Prop({ default: null })
  dateOfBirth!: Date;

  @Prop({ default: 0 })
  averageScore!: number;

  @Prop({ default: 0 })
  quizAttempted!: number;

  @Prop({ default: 0 })
  xp!: number;

  @Prop({ default: null })
  verificationId!: string;

  @Prop({ default: null })
  verificationIdExpiry!: Date;

  @Prop({ default: '' })
  refreshToken!: string;

  @Prop({
    type: {
      starfieldMotion: { type: Boolean, default: true },
      highContrast: { type: Boolean, default: false },
      kioskAutoLock: { type: Boolean, default: true },
      liveArenaInvites: { type: Boolean, default: true },
      leaderboardSurgeAlerts: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
    },
    default: {
      starfieldMotion: true,
      highContrast: false,
      kioskAutoLock: true,
      liveArenaInvites: true,
      leaderboardSurgeAlerts: true,
      weeklyDigest: true,
    },
    _id: false,
  })
  settings!: UserSettings;
}

export const UserSchema = SchemaFactory.createForClass(User);