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
  @IsString()
  orgId?: string;

  @IsOptional()
  isPractice?: boolean | string;

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
  @IsOptional()
  option?: string;

  @IsOptional()
  timeSpentSeconds?: number;

  @IsOptional()
  totalTimeSpentSeconds?: number;

  @IsOptional()
  tabSwitchesCount?: number;

  @IsOptional()
  copyAttemptsCount?: number;

  @IsOptional()
  fullscreenExitsCount?: number;

  @IsOptional()
  antiCheatLogs?: Array<{
    eventType: string;
    timestamp: string;
    details?: string;
  }>;
}

export class logAntiCheatDto {
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
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

export class copyQuizDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsNotEmpty()
  @IsString()
  targetWorkspace!: 'PUBLIC' | 'ORGANIZATION' | 'PRIVATE';

  @IsOptional()
  @IsString()
  orgId?: string;
}