import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GroupDocument = HydratedDocument<Group>;

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true, unique: true, index: true })
  groupId!: string;

  @Prop({ type: String, default: null, index: true })
  orgId?: string | null;

  @Prop({ type: String, enum: ['PUBLIC', 'ORGANIZATION'], default: 'ORGANIZATION', index: true })
  accessMode!: 'PUBLIC' | 'ORGANIZATION';

  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ required: true, unique: true, index: true })
  code!: string; // 6-character unique join code e.g. "QC-8842"

  @Prop({ required: true, index: true })
  creatorId!: string;

  @Prop({ type: [String], default: [] })
  memberIds!: string[];

  @Prop({ type: [String], default: [] })
  pendingMemberIds!: string[]; // Users waiting for partner approval if requireApproval is true

  @Prop({ type: Boolean, default: false })
  isLocked!: boolean; // Prevents any new joins when true

  @Prop({ type: Boolean, default: false })
  requireApproval!: boolean; // Partner must approve before member is enrolled
}

export const GroupSchema = SchemaFactory.createForClass(Group);
