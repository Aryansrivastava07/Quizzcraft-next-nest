import { apiClient } from "./client";
import { API_ROUTES } from "./routes";
import { NotificationItem } from "./types";

export const notificationService = {
  /**
   * Fetch current user's alerts & unread counter
   */
  async getNotifications() {
    return apiClient<{ notifications: NotificationItem[]; unreadCount: number }>(
      API_ROUTES.notifications.list,
      {
        method: "GET",
      }
    );
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string) {
    return apiClient<{ notificationId: string }>(
      API_ROUTES.notifications.read(notificationId),
      {
        method: "PATCH",
      }
    );
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    return apiClient<{ success: boolean }>(API_ROUTES.notifications.readAll, {
      method: "PATCH",
    });
  },
};
