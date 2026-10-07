import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GroupMessageDocument = HydratedDocument<GroupMessage>;

@Schema({ timestamps: true })
export class GroupMessage {
  @Prop({ required: true, unique: true, index: true })
  messageId!: string;

  @Prop({ required: true, index: true })
  groupId!: string;

  @Prop({ required: true, index: true })
  authorId!: string;

  @Prop({ required: true })
  authorName!: string;

  @Prop({ default: '' })
  authorAvatar!: string;

  @Prop({
    type: String,
    enum: ['SUPER_ADMIN', 'ORG_ADMIN', 'ORG_PARTNER', 'ORG_STD', 'PUBLIC_USER'],
    default: 'ORG_STD',
  })
  authorRole!: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'ORG_PARTNER' | 'ORG_STD' | 'PUBLIC_USER';

  @Prop({ required: true })
  content!: string;

  @Prop({ type: Boolean, default: false })
  isPinned!: boolean; // Pinned announcements from instructors

  @Prop({
    type: {
      questionId: { type: String, default: null },
      quizId: { type: String, default: null },
      questionText: { type: String, default: null },
    },
    default: null,
    _id: false,
  })
  questionContext?: {
    questionId: string;
    quizId: string;
    questionText: string;
  };
}

export const GroupMessageSchema = SchemaFactory.createForClass(GroupMessage);
