import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrganizationDocument = HydratedDocument<Organization>;

@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true, unique: true, index: true })
  orgId!: string;

  @Prop({ required: true, unique: true, index: true })
  slug!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  logoUrl?: string;

  @Prop({ default: null })
  allowedEmailDomain?: string;

  @Prop({ required: true })
  ownerId!: string;

  @Prop({ type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' })
  status!: 'ACTIVE' | 'SUSPENDED';

  @Prop({ default: 100 })
  maxSeats!: number;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
