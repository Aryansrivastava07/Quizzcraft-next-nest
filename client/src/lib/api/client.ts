import { BackendResponse, BackendErrorResponse } from "./types";
import { API_BASE_URL } from "./routes";

export class ApiError extends Error {
  statusCode: number;
  errorPayload?: BackendErrorResponse;

  constructor(message: string, statusCode: number, errorPayload?: BackendErrorResponse) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errorPayload = errorPayload;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshUrl = `${API_BASE_URL}/auth/refresh`;
      const response = await fetch(refreshUrl, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth:session-expired"));
        }
        return false;
      }

      const payload = await response.json();
      if (typeof window !== "undefined" && payload?.data) {
        window.dispatchEvent(new CustomEvent("auth:token-refreshed", { detail: payload.data }));
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions & { _isRetry?: boolean } = {}
): Promise<BackendResponse<T>> {
  const { params, headers, _isRetry, ...customConfig } = options;

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const isFormData = customConfig.body instanceof FormData;

  const config: RequestInit = {
    ...customConfig,
    credentials: "include", // Cookie-based authentication via Next.js proxy
    headers: {
      ...(!isFormData && { "Content-Type": "application/json" }),
      ...headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // Auto-refresh token if 401 Unauthorized occurs on protected routes
    if (response.status === 401 && !_isRetry) {
      const isAuthExempt =
        url.includes("/auth/refresh") ||
        url.includes("/auth/login") ||
        url.includes("/auth/register") ||
        url.includes("/auth/verify-register-otp") ||
        url.includes("/auth/send-password-reset-mail") ||
        url.includes("/auth/verify-password-reset-otp") ||
        url.includes("/auth/reset-password");

      if (!isAuthExempt) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          // Re-try the original request with the fresh token
          return apiClient<T>(endpoint, {
            ...options,
            _isRetry: true,
          });
        }
      }
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const errorMessage =
        (Array.isArray(payload?.message) ? payload?.message.join(", ") : payload?.message) ||
        `HTTP Error ${response.status}: ${response.statusText}`;
      throw new ApiError(errorMessage, response.status, payload);
    }

    return payload as BackendResponse<T>;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Explicit Internal Server Error when backend server is inactive or connection fails
    const message = error.message && error.message !== "Failed to fetch" && error.message !== "fetch failed"
      ? error.message
      : `Internal Server Error: Backend service is offline or unreachable at ${API_BASE_URL}`;

    throw new ApiError(message, 500);
  }
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return `[${error.statusCode}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Internal Server Error: An unknown error occurred communicating with the backend.";
}
