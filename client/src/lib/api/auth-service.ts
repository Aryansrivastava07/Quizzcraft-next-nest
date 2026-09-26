import { apiClient } from "./client";
import { API_ROUTES } from "./routes";
import {
  RegisterAuthDto,
  LoginAuthDto,
  VerifyOTPAuthDto,
  ResendOTPDto,
  SendPasswordResetMailDto,
  ResetPasswordAuthDto,
  UserMe,
} from "./types";

export const authService = {
  /**
   * Get current authenticated user profile session
   * Requires valid accessToken cookie
   */
  async getMe() {
    return apiClient<{ user: UserMe }>(API_ROUTES.auth.me, {
      method: "GET",
    });
  },

  /**
   * Register a new user account with strong password
   * Triggers verification OTP email
   */
  async register(data: RegisterAuthDto) {
    return apiClient<{ user?: Partial<UserMe>; email?: string }>(API_ROUTES.auth.register, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Login with email and password
   * Sets httpOnly accessToken and refreshToken cookies
   */
  async login(data: LoginAuthDto) {
    const res = await apiClient<{ user: UserMe; accessToken?: string; refreshToken?: string }>(API_ROUTES.auth.login, {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (typeof window !== "undefined" && res.data) {
      if (res.data.accessToken) {
        localStorage.setItem("quizzcraft_access_token", res.data.accessToken);
      }
      if (res.data.refreshToken) {
        localStorage.setItem("quizzcraft_refresh_token", res.data.refreshToken);
      }
    }

    return res;
  },

  /**
   * Logout user session and clear cookies
   */
  async logout() {
    const refreshToken =
      typeof window !== "undefined"
        ? localStorage.getItem("quizzcraft_refresh_token")
        : null;

    try {
      return await apiClient<boolean>(API_ROUTES.auth.logout, {
        method: "POST",
        headers: {
          ...(refreshToken ? { "x-refresh-token": refreshToken } : {}),
        },
        body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
      });
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("quizzcraft_access_token");
        localStorage.removeItem("quizzcraft_refresh_token");
        localStorage.removeItem("quizzcraft_reset_token");
      }
    }
  },

  /**
   * Refresh access and refresh tokens using cookie
   */
  async refresh() {
    const res = await apiClient<{ user: UserMe; accessToken?: string; refreshToken?: string }>(API_ROUTES.auth.refresh, {
      method: "POST",
    });

    if (typeof window !== "undefined" && res.data) {
      if (res.data.accessToken) {
        localStorage.setItem("quizzcraft_access_token", res.data.accessToken);
      }
      if (res.data.refreshToken) {
        localStorage.setItem("quizzcraft_refresh_token", res.data.refreshToken);
      }
    }

    return res;
  },

  /**
   * Resend verification OTP for registration
   */
  async resendRegisterOTP(data: ResendOTPDto) {
    return apiClient<boolean>(API_ROUTES.auth.resendRegisterOTP, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Verify email registration with OTP code
   * Sets access & refresh token cookies on success
   */
  async verifyRegisterOTP(data: VerifyOTPAuthDto) {
    const res = await apiClient<{ user: UserMe; accessToken?: string; refreshToken?: string }>(API_ROUTES.auth.verifyRegisterOTP, {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (typeof window !== "undefined" && res.data) {
      if (res.data.accessToken) {
        localStorage.setItem("quizzcraft_access_token", res.data.accessToken);
      }
      if (res.data.refreshToken) {
        localStorage.setItem("quizzcraft_refresh_token", res.data.refreshToken);
      }
    }

    return res;
  },

  /**
   * Send password reset OTP email
   */
  async sendPasswordResetMail(data: SendPasswordResetMailDto) {
    return apiClient<boolean>(API_ROUTES.auth.sendPasswordResetMail, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Resend password reset OTP email
   */
  async resendPasswordResetOTP(data: ResendOTPDto) {
    return apiClient<boolean>(API_ROUTES.auth.resendPasswordResetOTP, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Verify password reset OTP code
   * Sets short-lived RESET_PASS_TOKEN cookie
   */
  async verifyPasswordResetOTP(data: VerifyOTPAuthDto) {
    const res = await apiClient<{ verified: boolean; RESET_PASS_TOKEN?: string }>(API_ROUTES.auth.verifyPasswordResetOTP, {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (typeof window !== "undefined" && res.data?.RESET_PASS_TOKEN) {
      localStorage.setItem("quizzcraft_reset_token", res.data.RESET_PASS_TOKEN);
    }

    return res;
  },

  /**
   * Reset user password
   * Requires RESET_PASS_TOKEN cookie or header
   */
  async resetPassword(data: ResetPasswordAuthDto) {
    const resetToken =
      typeof window !== "undefined"
        ? localStorage.getItem("quizzcraft_reset_token")
        : null;

    try {
      return await apiClient<{ reset: boolean }>(API_ROUTES.auth.resetPassword, {
        method: "POST",
        headers: {
          ...(resetToken ? { "x-reset-pass-token": resetToken } : {}),
          ...(resetToken ? { Authorization: `Bearer ${resetToken}` } : {}),
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("quizzcraft_reset_token");
      }
    }
  },
};
