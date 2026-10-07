export interface IQuestion {
  questionId: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  level?: string;
  xp?: number;
  reference?: {
    type?: 'IMAGE' | 'VIDEO_FRAME' | 'PDF_PAGE' | 'WEB_SOURCE' | 'VERIFIED_CDN';
    mediaUrl?: string;
    caption?: string;
    timestamp?: string;
    pageNumber?: number;
    sourceName?: string;
  };
}

export interface IQuiz {
  quizId: string;
  pin?: string;
  title: string;
  coverImage?: string;
  ownerId?: string;
  ownerEmail?: string;
  accessMode?: 'PUBLIC' | 'PRIVATE' | 'ORGANIZATION';
  organizationDomain?: string;
  deploymentType?: 'LIVE' | 'SCHEDULED' | 'ANYTIME';
  isDeployed?: boolean;
  status?: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ANYTIME' | 'ENDED';
  scheduledFor?: Date | string;
  liveDurationMinutes?: number;
  liveUntil?: Date | string;
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
  questions: IQuestion[];
}
