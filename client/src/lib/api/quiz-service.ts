import { apiClient } from "./client";
import { API_ROUTES } from "./routes";
import {
  Quiz,
  GenerateQuizParams,
  AttemptSession,
  AnswerQuizDto,
  PublicQuizzesResponse,
  QuizReviewData,
} from "./types";

export const quizService = {
  /**
   * Generate a new AI quiz via Gemini backend provider
   * Supports multipart/form-data upload for PDFs, images, and videos
   */
  async generateQuiz(params: GenerateQuizParams) {
    const formData = new FormData();
    formData.append("prompt", params.prompt);

    if (params.questionCount !== undefined) {
      formData.append("questionCount", String(params.questionCount));
    }
    if (params.difficulty) {
      formData.append("difficulty", params.difficulty);
    }
    if (params.quizType) {
      formData.append("quizType", params.quizType);
    }
    if (params.sourceUrl) {
      formData.append("sourceUrl", params.sourceUrl);
    }

    if (params.images && params.images.length > 0) {
      params.images.slice(0, 5).forEach((file) => {
        formData.append("images", file);
      });
    }

    if (params.videos && params.videos.length > 0) {
      params.videos.slice(0, 1).forEach((file) => {
        formData.append("videos", file);
      });
    }

    if (params.pdfs && params.pdfs.length > 0) {
      params.pdfs.slice(0, 2).forEach((file) => {
        formData.append("pdfs", file);
      });
    }

    return apiClient<{ quiz: Quiz }>(API_ROUTES.quiz.generate, {
      method: "POST",
      body: formData,
    });
  },

  /**
   * Fetch quiz details and full question set by quizId
   * @param quizId The unique UUID of the quiz
   */
  async getQuiz(quizId: string) {
    return apiClient<{ quiz: Quiz; stats?: { peopleAttempted: number; averageScore: number } }>(
      API_ROUTES.quiz.get(quizId),
      {
        method: "GET",
      }
    );
  },

  /**
   * Fetch quiz details and questions by 6-digit room PIN
   * @param pin The 6-digit PIN of the quiz
   */
  async getQuizByPin(pin: string, email?: string) {
    const cleanPin = pin.replace(/\D/g, "");
    const baseRoute = API_ROUTES.quiz.getByPin(cleanPin || pin);
    const url = email ? `${baseRoute}?email=${encodeURIComponent(email)}` : baseRoute;
    return apiClient<any>(url, {
      method: "GET",
    });
  },

  /**
   * Update quiz details or questions
   * @param quizId The unique UUID of the quiz
   * @param data Title, immediateResult setting, and questions to update
   */
  async updateQuiz(
    quizId: string,
    data: {
      title?: string;
      coverImage?: string;
      questions?: any[];
      immediateResult?: boolean;
      questime?: number;
      dynamicShuffle?: boolean;
      temporalLimit?: boolean;
    }
  ) {
    return apiClient<{ updated: boolean }>(API_ROUTES.quiz.update(quizId), {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Edit a single question in the quiz
   * Persists level, xp, answer, options, question statement, and explanation directly to backend
   */
  async editQuestion(
    quizId: string,
    questionId: string,
    data: {
      question?: string;
      options?: string[];
      answer?: string;
      explanation?: string;
      level?: string;
    }
  ) {
    return apiClient<{ question: any; updated: boolean }>(
      API_ROUTES.quiz.editQuestion(quizId, questionId),
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Add a new question to the quiz
   */
  async addQuestion(
    quizId: string,
    data: {
      question: string;
      options: string[];
      answer: string;
      explanation?: string;
      level?: string;
    }
  ) {
    return apiClient<{ question: any; created: boolean }>(
      API_ROUTES.quiz.addQuestion(quizId),
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Delete a question from the quiz
   */
  async deleteQuestion(quizId: string, questionId: string) {
    return apiClient<{ deleted: boolean }>(
      API_ROUTES.quiz.deleteQuestion(quizId, questionId),
      {
        method: "DELETE",
      }
    );
  },

  /**
   * Start or resume an active quiz attempt session
   * @param quizId The unique UUID of the quiz
   */
  async createAttempt(quizId: string) {
    return apiClient<{ createSession?: AttemptSession; session?: AttemptSession }>(
      API_ROUTES.quiz.attempt(quizId),
      {
        method: "GET",
      }
    );
  },

  /**
   * Save a single answer response during an active quiz attempt
   * @param sessionId Active session UUID
   * @param answer Question ID and selected option
   */
  async updateAnswer(sessionId: string, answer: AnswerQuizDto) {
    return apiClient<boolean>(API_ROUTES.quiz.updateAnswer(sessionId), {
      method: "POST",
      body: JSON.stringify(answer),
    });
  },

  /**
   * Finalize and submit all responses for a quiz session
   * Closes session and records attempt
   */
  async submitAttempt(sessionId: string, finalAnswer: AnswerQuizDto) {
    return apiClient<boolean>(API_ROUTES.quiz.submitAttempt(sessionId), {
      method: "POST",
      body: JSON.stringify(finalAnswer),
    });
  },

  /**
   * Calculate and fetch final evaluated score for a completed session
   * @param sessionId Finished session UUID
   */
  async getScore(sessionId: string) {
    return apiClient<number>(API_ROUTES.quiz.getScore(sessionId), {
      method: "GET",
    });
  },

  /**
   * Deploy a quiz with protocol (LIVE, SCHEDULED, ANYTIME) and access controls
   */
  async deployQuiz(
    quizId: string,
    payload: {
      deploymentType: "LIVE" | "SCHEDULED" | "ANYTIME";
      accessMode?: "PUBLIC" | "PRIVATE" | "ORGANIZATION";
      organizationDomain?: string;
      scheduledFor?: string;
      liveDurationMinutes?: number;
      antiCheat?: boolean;
      fullScreenLock?: boolean;
      shuffleChoices?: boolean;
      allowRetries?: boolean;
      isPractice?: boolean;
    }
  ) {
    return apiClient<{
      quiz: Quiz;
      deploymentType: string;
      status: string;
      accessMode: string;
      adminUrl: string;
      joinUrl: string;
      pin?: string;
    }>(API_ROUTES.quiz.deploy(quizId), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Fetch live admin telemetry, attendees, average score, and leaderboard
   */
  async getQuizAdminData(quizId: string) {
    return apiClient<{
      quiz: Quiz;
      attendeesCount: number;
      activeAttendeesCount: number;
      averageScore: number;
      waitingCadetsCount: number;
      waitingList: string[];
      leaderboard: Array<{
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
      }>;
      isOwner: boolean;
    }>(API_ROUTES.quiz.admin(quizId), {
      method: "GET",
    });
  },

  /**
   * Join waitlist for scheduled quiz
   */
  async joinWaitlist(quizId: string, email: string) {
    return apiClient<{ quizId: string; waitingCadetsCount: number; joined: boolean }>(
      API_ROUTES.quiz.waitlist(quizId),
      {
        method: "POST",
        body: JSON.stringify({ email }),
      }
    );
  },

  /**
   * Conclude and close a live quiz arena session
   */
  async closeQuiz(quizId: string) {
    return apiClient<{ quizId: string; status: string; closed: boolean }>(
      API_ROUTES.quiz.close(quizId),
      {
        method: "POST",
      }
    );
  },

  /**
   * Fetch all deployed public quizzes for discovery
   * Never shows undeployed / draft quizzes
   */
  async getPublicQuizzes(params?: { search?: string; status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));

    const qs = query.toString();
    return apiClient<PublicQuizzesResponse>(API_ROUTES.quiz.public(qs ? qs : undefined), {
      method: "GET",
    });
  },

  /**
   * Fetch quiz review analytics & leaderboard
   * Accessible to quiz creators or to everyone if quiz is public
   * Never contains question statements or answers
   */
  async getQuizReview(quizId: string) {
    return apiClient<QuizReviewData>(API_ROUTES.quiz.review(quizId), {
      method: "GET",
    });
  },
};
