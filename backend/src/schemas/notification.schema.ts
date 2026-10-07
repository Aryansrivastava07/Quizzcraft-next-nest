import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, unique: true, index: true })
  notificationId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({
    type: String,
    enum: ['QUIZ_ASSIGNED', 'DISCUSSION_REPLY', 'GROUP_INVITE', 'ORG_UPDATE'],
    default: 'QUIZ_ASSIGNED',
  })
  type!: 'QUIZ_ASSIGNED' | 'DISCUSSION_REPLY' | 'GROUP_INVITE' | 'ORG_UPDATE';

  @Prop({ default: '' })
  link!: string;

  @Prop({ type: Boolean, default: false })
  read!: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
