import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class getProfileDto {
  @IsEmail()
  @IsOptional()
  email?: string;
}

export class updateProfileDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9]+$/, {
    message: 'Username must contain only lowercase letters and numbers with no special characters',
  })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username cannot exceed 30 characters' })
  userName?: string;

  @IsNumber()
  @IsOptional()
  xp?: number;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  profilePicture?: string;

  @IsNumber()
  @IsOptional()
  mobileNo?: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsOptional()
  dateOfBirth?: Date;
}

export class updateSettingsDto {
  @IsBoolean()
  @IsOptional()
  starfieldMotion?: boolean;

  @IsBoolean()
  @IsOptional()
  highContrast?: boolean;

  @IsBoolean()
  @IsOptional()
  kioskAutoLock?: boolean;

  @IsBoolean()
  @IsOptional()
  liveArenaInvites?: boolean;

  @IsBoolean()
  @IsOptional()
  leaderboardSurgeAlerts?: boolean;

  @IsBoolean()
  @IsOptional()
  weeklyDigest?: boolean;
}

export class createSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  urgency!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}
