import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type QuizDocument = HydratedDocument<Quiz>;

@Schema({ timestamps: true })
export class Quiz {
  @Prop({ required: true, index: true })
  quizId!: string;

  @Prop({ unique: true, sparse: true, index: true })
  pin?: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: String, default: null })
  ownerId?: string;

  @Prop({ type: String, default: null })
  ownerEmail?: string;

  @Prop({ type: String, enum: ['PUBLIC', 'PRIVATE', 'ORGANIZATION'], default: 'PUBLIC' })
  accessMode?: 'PUBLIC' | 'PRIVATE' | 'ORGANIZATION';

  @Prop({ type: String, default: null })
  organizationDomain?: string;

  @Prop({ type: String, enum: ['LIVE', 'SCHEDULED', 'ANYTIME'], default: 'LIVE' })
  deploymentType?: 'LIVE' | 'SCHEDULED' | 'ANYTIME';

  @Prop({ type: String, enum: ['DRAFT', 'SCHEDULED', 'LIVE', 'ANYTIME', 'ENDED'], default: 'DRAFT' })
  status?: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ANYTIME' | 'ENDED';

  @Prop({ type: Date, default: null })
  scheduledFor?: Date;

  @Prop({ type: Number, default: 60 })
  liveDurationMinutes?: number;

  @Prop({ type: Date, default: null })
  liveUntil?: Date;

  @Prop({ type: Boolean, default: false })
  scheduledAlertSent?: boolean;

  @Prop({ type: [String], default: [] })
  waitingList?: string[];

  @Prop({ type: Boolean, default: false })
  isPractice?: boolean;

  @Prop({ type: Boolean, default: true })
  antiCheat?: boolean;

  @Prop({ type: Boolean, default: true })
  fullScreenLock?: boolean;

  @Prop({ type: Boolean, default: true })
  shuffleChoices?: boolean;

  @Prop({ type: Boolean, default: false })
  allowRetries?: boolean;

  @Prop({ type: Boolean, default: true })
  immediateResult?: boolean;

  @Prop({ type: Number, default: 60 })
  questime?: number;

  @Prop({ type: Boolean, default: true })
  dynamicShuffle?: boolean;

  @Prop({ type: Boolean, default: true })
  temporalLimit?: boolean;

  @Prop({
    type: [
      {
        questionId: { type: String, required: true },
        question: { type: String, required: true },
        options: { type: [String], required: true },
        answer: { type: String, required: true },
        explanation: { type: String, default: '' },
        level: { type: String, default: 'MEDIUM' },
        xp: { type: Number, default: 200 },
      },
    ],
    required: true,
  })
  questions!: {
    questionId: string;
    question: string;
    options: string[];
    answer: string;
    explanation: string;
    level?: string;
    xp?: number;
  }[];
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);
