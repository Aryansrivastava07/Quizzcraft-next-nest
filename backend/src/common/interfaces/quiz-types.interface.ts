export interface IQuestion {
  questionId: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  level?: string;
  xp?: number;
}

export interface IQuiz {
  quizId: string;
  pin?: string;
  title: string;
  ownerId?: string;
  ownerEmail?: string;
  accessMode?: 'PUBLIC' | 'PRIVATE' | 'ORGANIZATION';
  organizationDomain?: string;
  deploymentType?: 'LIVE' | 'SCHEDULED' | 'ANYTIME';
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
