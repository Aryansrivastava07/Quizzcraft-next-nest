import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AttemptsDocument = HydratedDocument<Attempts>;

@Schema({ timestamps: true })
export class Attempts {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  quizId!: string;

  @Prop({ required: true })
  isActive!: boolean;

  @Prop({ required: true, unique: true })
  sessionId!: string;

  @Prop({ required: true })
  lastUpdateAt!: string;

  @Prop({ type: String, default: null })
  startedAt?: string;

  @Prop({ type: Number, default: 0 })
  totalTimeSpentSeconds?: number;

  @Prop({ type: Number, default: null })
  accuracy?: number;

  @Prop({
    type: [
      {
        questionId: { type: String, required: true },
        chosenOption: { type: [String], required: true },
        timeSpentSeconds: { type: Number, default: 0 },
      },
    ],
    default: [],
  })
  Responses!: { questionId: string; chosenOption: string[]; timeSpentSeconds?: number }[];

  @Prop({ type: Number, default: 0 })
  score!: number;

  @Prop({ type: Number, default: 0 })
  tabSwitchesCount?: number;

  @Prop({ type: Number, default: 0 })
  copyAttemptsCount?: number;

  @Prop({ type: Number, default: 0 })
  fullscreenExitsCount?: number;

  @Prop({
    type: [
      {
        eventType: { type: String, required: true },
        timestamp: { type: String, required: true },
        details: { type: String, default: '' },
      },
    ],
    default: [],
  })
  antiCheatLogs?: {
    eventType: string;
    timestamp: string;
    details?: string;
  }[];
}

export const AttemptsSchema = SchemaFactory.createForClass(Attempts);
