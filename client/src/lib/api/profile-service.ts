import { apiClient } from "./client";
import { API_ROUTES } from "./routes";
import {
  UserProfile,
  UpdateProfileDto,
  UserSettings,
  CreateTicketDto,
  CheckUsernameResponse,
  Quiz,
  AttemptSession,
} from "./types";

export const profileService = {
  /**
   * Check if a username is available and valid
   */
  async checkUsername(username: string) {
    return apiClient<CheckUsernameResponse>(API_ROUTES.profile.checkUsername(username), {
      method: "GET",
    });
  },
  /**
   * Get user profile details by email query
   * @param email User email
   */
  async getProfile(email: string) {
    return apiClient<UserProfile>(API_ROUTES.profile.get(email), {
      method: "GET",
    });
  },

  /**
   * Update profile information
   */
  async updateProfile(data: UpdateProfileDto) {
    return apiClient<{ updated: boolean; user?: Partial<UserProfile> }>(
      API_ROUTES.profile.update,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Update platform & notification settings
   */
  async updateSettings(settings: Partial<UserSettings>) {
    return apiClient<{ settings: UserSettings }>(API_ROUTES.profile.settings, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  /**
   * Submit a support ticket
   */
  async createTicket(data: CreateTicketDto) {
    return apiClient<{ ticketId: string }>(API_ROUTES.profile.ticket, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Get quizzes created by the authenticated user
   */
  async getQuizzes() {
    return apiClient<{ quizzes: Quiz[] }>(API_ROUTES.profile.quizzes, {
      method: "GET",
    });
  },

  /**
   * Get quiz attempt history for the authenticated user
   */
  async getHistory() {
    return apiClient<{
      history?: (AttemptSession & { title?: string; totalQuestions?: number })[];
      quizzes?: AttemptSession[];
    }>(API_ROUTES.profile.history, {
      method: "GET",
    });
  },

  /**
   * Link an additional / organization email address
   */
  async linkEmail(email: string) {
    return apiClient<{ email: string; emails: string[] }>(API_ROUTES.profile.linkEmail, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  /**
   * Unlink an email address
   */
  async unlinkEmail(email: string) {
    return apiClient<{ email: string; emails: string[] }>(API_ROUTES.profile.unlinkEmail, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
};
