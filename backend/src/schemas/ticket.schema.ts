import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TicketDocument = HydratedDocument<Ticket>;

@Schema({ timestamps: true })
export class Ticket {
  @Prop({ required: true, unique: true })
  ticketId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  email!: string;

  @Prop({ default: '' })
  name!: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true, default: 'Normal' })
  urgency!: string;

  @Prop({ required: true })
  subject!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ default: 'OPEN' })
  status!: string;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
