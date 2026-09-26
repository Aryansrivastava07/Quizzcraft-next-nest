"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authService } from "@/lib/api/auth-service";
import { UserMe, LoginAuthDto, RegisterAuthDto } from "@/lib/api/types";
import { formatApiError } from "@/lib/api/client";

interface AuthContextType {
  user: UserMe | null;
  isLoading: boolean;
  error: string | null;
  login: (dto: LoginAuthDto) => Promise<void>;
  register: (dto: RegisterAuthDto) => Promise<{ message: string }>;
  verifyRegisterOTP: (dto: { email: string; OTP: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authService.getMe();
      if (response?.data?.user) {
        setUser(response.data.user);
        setError(null);
      } else {
        setUser(null);
      }
    } catch (err: any) {
      setUser(null);
      // Only set persistent error if it's a 500 / server down error, not normal 401 unauthenticated
      if (err.statusCode === 500) {
        setError(formatApiError(err));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial check on mount + listen to token refresh / expiry events
  useEffect(() => {
    refreshUser();

    const handleSessionExpired = () => {
      setUser(null);
    };

    const handleTokenRefreshed = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.user) {
        setUser(customEvent.detail.user);
      } else {
        // Silently reload user profile with new access token
        authService.getMe().then((res) => {
          if (res?.data?.user) {
            setUser(res.data.user);
          }
        }).catch(() => {});
      }
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    window.addEventListener("auth:token-refreshed", handleTokenRefreshed);

    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
      window.removeEventListener("auth:token-refreshed", handleTokenRefreshed);
    };
  }, [refreshUser]);

  const login = async (dto: LoginAuthDto) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login(dto);
      if (response?.data?.user) {
        setUser(response.data.user);
      }
    } catch (err: any) {
      const formatted = formatApiError(err);
      setError(formatted);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (dto: RegisterAuthDto) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.register(dto);
      return { message: response.message || "Registration initiated. Verification OTP sent." };
    } catch (err: any) {
      const formatted = formatApiError(err);
      setError(formatted);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyRegisterOTP = async (dto: { email: string; OTP: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.verifyRegisterOTP(dto);
      if (response?.data?.user) {
        setUser(response.data.user);
      } else {
        await refreshUser();
      }
    } catch (err: any) {
      const formatted = formatApiError(err);
      setError(formatted);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } catch (err: any) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        register,
        verifyRegisterOTP,
        logout,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
