import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  description?: string;

  @IsBoolean()
  @IsOptional()
  requireApproval?: boolean;

  @IsString()
  @IsOptional()
  accessMode?: 'PUBLIC' | 'ORGANIZATION';
}

export class JoinGroupDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class UpdateGroupSettingsDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isLocked?: boolean;

  @IsBoolean()
  @IsOptional()
  requireApproval?: boolean;
}

export class PostGroupMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  questionContext?: {
    questionId: string;
    quizId: string;
    questionText: string;
  };
}
