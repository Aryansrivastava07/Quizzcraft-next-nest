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

export interface RegisterAuthDto {
  username: string;
  email: string;
  password: string; // Requires strong password (uppercase, lowercase, number, symbol, min 8)
  fullName?: string;
  phoneNumber?: string;
  institution?: string;
  orgId?: string;
  groupCode?: string;
}

export interface LoginAuthDto {
  email: string;
  password: string;
  orgId?: string;
  orgSlug?: string;
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
  fullName?: string;
  phoneNumber?: string;
  institution?: string;
  averageScore?: number;
  quizAttempted?: number;
  xp?: number;
  role?: "PUBLIC_USER" | "SUPER_ADMIN" | "ORG_ADMIN" | "ORG_PARTNER" | "ORG_STD" | "ORG_USER";
  orgId?: string;
  orgSlug?: string;
  isSuperAdmin?: boolean;
  groupIds?: string[];
  createdAt?: string;
}

export interface QuizQuestionReference {
  type?: "IMAGE" | "VIDEO_FRAME" | "PDF_PAGE" | "WEB_SOURCE" | "VERIFIED_CDN";
  mediaUrl?: string;
  caption?: string;
  timestamp?: string;
  pageNumber?: number;
  sourceName?: string;
}

export interface QuizQuestion {
  questionId: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  level?: "EASY" | "MEDIUM" | "HARD" | string;
  xp?: number;
  reference?: QuizQuestionReference;
}

export interface QuizStats {
  peopleAttempted?: number;
  averageScore?: number;
}

export interface Quiz {
  quizId: string;
  pin?: string;
  title: string;
  coverImage?: string;
  ownerId?: string;
  ownerEmail?: string;
  accessMode?: "PUBLIC" | "PRIVATE" | "ORGANIZATION";
  organizationDomain?: string;
  deploymentType?: "LIVE" | "SCHEDULED" | "ANYTIME";
  isDeployed?: boolean;
  status?: "DRAFT" | "SCHEDULED" | "LIVE" | "ANYTIME" | "ENDED";
  scheduledFor?: string;
  liveDurationMinutes?: number;
  liveUntil?: string;
  scheduledAlertSent?: boolean;
  waitingList?: string[];
  isPractice?: boolean;
  orgId?: string;
  groupId?: string;
  dueDate?: string;
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

export interface PublicQuizItem {
  quizId: string;
  title: string;
  coverImage?: string;
  pin?: string;
  isDeployed: boolean;
  deploymentType?: "LIVE" | "SCHEDULED" | "ANYTIME";
  status: "DRAFT" | "LIVE" | "SCHEDULED" | "ANYTIME" | "ENDED";
  scheduledFor?: string;
  liveDurationMinutes?: number;
  liveUntil?: string;
  questionsCount: number;
  attemptsCount: number;
  questime?: number;
  createdAt?: string;
  creator: {
    username: string;
    fullName: string;
    avatar: string;
  };
}

export interface PublicQuizzesResponse {
  quizzes: PublicQuizItem[];
  total: number;
  page: number;
  limit: number;
}

export interface LeaderboardEntry {
  sessionId: string;
  userId: string;
  username: string;
  fullName: string;
  avatar: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  isActive: boolean;
  lastUpdateAt: string;
}

export interface QuizReviewStats {
  totalAttempts: number;
  completedAttempts: number;
  activeAttempts: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
}

export interface QuizReviewData {
  quiz: {
    quizId: string;
    title: string;
    coverImage?: string;
    pin?: string;
    isDeployed?: boolean;
    status?: "DRAFT" | "LIVE" | "SCHEDULED" | "ANYTIME" | "ENDED";
    deploymentType?: "LIVE" | "SCHEDULED" | "ANYTIME";
    accessMode?: "PUBLIC" | "PRIVATE" | "ORGANIZATION";
    scheduledFor?: string;
    liveDurationMinutes?: number;
    liveUntil?: string;
    totalQuestions: number;
    questime?: number;
    createdAt?: string;
    antiCheat?: boolean;
  };
  owner: {
    username: string;
    fullName: string;
    avatar: string;
    isCurrentUser: boolean;
  };
  stats: QuizReviewStats;
  leaderboard: LeaderboardEntry[];
  isOwner: boolean;
  isPublic: boolean;
  canAttempt: boolean;
}

// ==================== ORGANIZATION TYPES ====================
export interface Organization {
  orgId: string;
  name: string;
  slug: string;
  ownerId: string;
  allowedEmailDomain?: string;
  logoUrl?: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  maxSeats: number;
  currentSeats: number;
  createdAt?: string;
}

export interface RegisterOrgDto {
  name: string;
  slug: string;
  allowedEmailDomain?: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName?: string;
}

export interface OrgMember {
  userId: string;
  email: string;
  username: string;
  fullName?: string;
  role: "SUPER_ADMIN" | "ORG_ADMIN" | "ORG_PARTNER" | "ORG_STD" | "ORG_USER";
  profilePicture?: string;
  joinedAt?: string;
  groupIds?: string[];
}

export interface SuperAdminStats {
  totalOrgs: number;
  totalUsers: number;
  totalPublicUsers: number;
  totalOrgUsers: number;
  totalQuizzes: number;
  totalAttempts: number;
}

// ==================== GROUP TYPES ====================
export interface Group {
  groupId: string;
  orgId?: string | null;
  accessMode?: "PUBLIC" | "ORGANIZATION";
  name: string;
  description?: string;
  code: string;
  creatorId: string;
  memberIds: string[];
  pendingMemberIds: string[];
  memberCount?: number;
  quizCount?: number;
  isLocked: boolean;
  requireApproval: boolean;
  isMember?: boolean;
  isCreator?: boolean;
  creator?: {
    username: string;
    fullName?: string;
    profilePicture?: string;
  };
  createdAt?: string;
}

export interface CreateGroupDto {
  name: string;
  description?: string;
  orgId?: string;
  accessMode?: "PUBLIC" | "ORGANIZATION";
  requireApproval?: boolean;
}

export interface GroupQuestionContext {
  quizId: string;
  quizTitle?: string;
  questionId: string;
  questionSnippet: string;
}

export interface GroupMessage {
  messageId: string;
  groupId: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  senderRole?: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  authorRole?: string;
  content: string;
  isPinned: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
  questionContext?: GroupQuestionContext;
  createdAt: string;
}

export interface SendGroupMessageDto {
  content: string;
  questionContext?: GroupQuestionContext;
}

export interface GradebookEntry {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  scores: Record<string, { score: number; percentage: number; completedAt: string } | null>;
  totalCompleted: number;
  averageScore: number;
}

export interface GroupGradebookResponse {
  quizzes: { quizId: string; title: string; totalQuestions: number; dueDate?: string }[];
  students: GradebookEntry[];
}

// ==================== NOTIFICATION TYPES ====================
export interface NotificationItem {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: "QUIZ_ASSIGNED" | "DISCUSSION_REPLY" | "GROUP_INVITE" | "ORG_UPDATE";
  link?: string;
  read: boolean;
  createdAt: string;
}

