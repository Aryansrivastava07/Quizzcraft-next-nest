/**
 * Backend Data Transfer Objects & Schema Types
 * Synced with D:\Aryan\coding\projects\quizz-craft\backend
 */

// Standard Response Interceptor Envelope from Backend
export interface BackendResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

export interface BackendErrorResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
  method: string;
}

// ==================== AUTH TYPES ====================
export interface RegisterAuthDto {
  username: string;
  email: string;
  password: string; // Requires strong password (uppercase, lowercase, number, symbol, min 8)
}

export interface LoginAuthDto {
  email: string;
  password: string;
}

export interface VerifyOTPAuthDto {
  email: string;
  OTP: string;
}

export interface ResendOTPDto {
  email: string;
}

export interface SendPasswordResetMailDto {
  email: string;
}

export interface ResetPasswordAuthDto {
  email: string;
  password: string;
}

export interface UserMe {
  userId: string;
  email: string;
  emails?: string[];
  username: string;
  verified: boolean;
  profilePicture?: string;
  averageScore?: number;
  quizAttempted?: number;
  xp?: number;
  createdAt?: string;
}

// ==================== QUIZ TYPES ====================
export interface QuizQuestion {
  questionId: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  level?: "EASY" | "MEDIUM" | "HARD" | string;
  xp?: number;
}

export interface QuizStats {
  peopleAttempted?: number;
  averageScore?: number;
}

export interface Quiz {
  quizId: string;
  pin?: string;
  title: string;
  ownerId?: string;
  ownerEmail?: string;
  accessMode?: "PUBLIC" | "PRIVATE" | "ORGANIZATION";
  organizationDomain?: string;
  deploymentType?: "LIVE" | "SCHEDULED" | "ANYTIME";
  status?: "DRAFT" | "SCHEDULED" | "LIVE" | "ANYTIME" | "ENDED";
  scheduledFor?: string;
  liveDurationMinutes?: number;
  liveUntil?: string;
  scheduledAlertSent?: boolean;
  waitingList?: string[];
  isPractice?: boolean;
  antiCheat?: boolean;
  fullScreenLock?: boolean;
  shuffleChoices?: boolean;
  allowRetries?: boolean;
  immediateResult?: boolean;
  questime?: number;
  dynamicShuffle?: boolean;
  temporalLimit?: boolean;
  questions: QuizQuestion[];
  stats?: QuizStats;
  createdAt?: string;
}

export interface GenerateQuizParams {
  prompt: string;
  questionCount?: number;
  difficulty?: string;
  quizType?: string;
  sourceUrl?: string;
  images?: File[];
  videos?: File[];
  pdfs?: File[];
}

export interface AttemptSession {
  sessionId: string;
  quizId: string;
  userId: string;
  isActive: boolean;
  lastUpdateAt: string;
  Responses: {
    questionId: string;
    chosenOption: string[];
  }[];
  score?: number | null;
}

export interface AnswerQuizDto {
  questionId: string;
  option: string;
}

// ==================== PROFILE & SETTINGS TYPES ====================
export interface UserSettings {
  starfieldMotion: boolean;
  highContrast: boolean;
  kioskAutoLock: boolean;
  liveArenaInvites: boolean;
  leaderboardSurgeAlerts: boolean;
  weeklyDigest: boolean;
}

export interface UserProfile {
  _id?: string;
  userId?: string;
  username: string;
  fullName?: string;
  email?: string;
  emails: string[];
  verified: boolean;
  profilePicture?: string;
  institution?: string;
  bio?: string;
  mobileNo?: number | null;
  address?: string;
  dateOfBirth?: string | null;
  averageScore?: number;
  quizAttempted?: number;
  xp?: number;
  settings?: UserSettings;
  createdAt?: string;
}

export interface UpdateProfileDto {
  email: string;
  userName?: string;
  fullName?: string;
  institution?: string;
  bio?: string;
  profilePicture?: string;
  mobileNo?: number | null;
  address?: string;
  dateOfBirth?: string | null;
  xp?: number;
}

export interface CreateTicketDto {
  category: string;
  urgency: string;
  subject: string;
  message: string;
}

export interface CheckUsernameResponse {
  available: boolean;
  valid: boolean;
  message: string;
  isCurrent?: boolean;
}
