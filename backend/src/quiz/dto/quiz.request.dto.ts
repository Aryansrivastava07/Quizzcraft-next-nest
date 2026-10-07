import { IsNotEmpty, IsOptional, isString, IsString } from 'class-validator';

export class generateQuizDto {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  questionCount?: number | string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsString()
  quizType?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  images!: Express.Multer.File[];

  @IsOptional()
  videos!: Express.Multer.File[];

  @IsOptional()
  pdfs!: Express.Multer.File[];
}

export class attemptQuizDto {
  @IsString()
  @IsNotEmpty()
  quizId!: string;
}

export class answerQuizDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @IsString()
  @IsNotEmpty()
  option!: string;
}

export class editQuestionDto {
  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  options?: string[];

  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  level?: string;
}

export class deployQuizDto {
  @IsString()
  @IsNotEmpty()
  deploymentType!: 'LIVE' | 'SCHEDULED' | 'ANYTIME';

  @IsOptional()
  @IsString()
  accessMode?: 'PUBLIC' | 'PRIVATE' | 'ORGANIZATION';

  @IsOptional()
  @IsString()
  organizationDomain?: string;

  @IsOptional()
  scheduledFor?: string | Date;

  @IsOptional()
  liveDurationMinutes?: number;

  @IsOptional()
  antiCheat?: boolean;

  @IsOptional()
  fullScreenLock?: boolean;

  @IsOptional()
  shuffleChoices?: boolean;

  @IsOptional()
  allowRetries?: boolean;

  @IsOptional()
  isPractice?: boolean;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  dueDate?: string | Date;
}