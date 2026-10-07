export interface IAiGeneratedQuizQuestion {
  question: string;
  options: string[];
  answer: number | string;
  explanation: string;
  level?: string;
  xp?: number;
  reference?: {
    type?: 'IMAGE' | 'VIDEO_FRAME' | 'PDF_PAGE' | 'WEB_SOURCE' | 'VERIFIED_CDN';
    sourceIndex?: number;
    timestamp?: string;
    pageNumber?: number;
    caption?: string;
    searchKeyword?: string;
    mediaUrl?: string;
  };
}

// This interface represents the structure of the response from the AI provider
export interface IAiGeneratedQuizResponse {
  quiz: {
    title: string;
    questions: IAiGeneratedQuizQuestion[];
  };
}
