import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { Notification } from '../schemas/notification.schema';
import { ServiceResponse } from '../common/interfaces/service-response.interface';

@Injectable()
export class NotificationService {
  constructor(
    @Inject('NOTIFICATION_MODEL')
    private readonly notificationModel: Model<Notification>,
  ) {}

  async getUserNotifications(userPayload: any): Promise<ServiceResponse<any>> {
    const notifications = await this.notificationModel
      .find({ userId: userPayload.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await this.notificationModel.countDocuments({
      userId: userPayload.userId,
      read: false,
    });

    return {
      message: 'Notifications retrieved',
      data: {
        notifications,
        unreadCount,
      },
    };
  }

  async markAsRead(notificationId: string, userPayload: any): Promise<ServiceResponse<any>> {
    await this.notificationModel.updateOne(
      { notificationId, userId: userPayload.userId },
      { $set: { read: true } },
    );

    return {
      message: 'Notification marked as read',
      data: { notificationId },
    };
  }

  async markAllAsRead(userPayload: any): Promise<ServiceResponse<any>> {
    await this.notificationModel.updateMany(
      { userId: userPayload.userId, read: false },
      { $set: { read: true } },
    );

    return {
      message: 'All notifications marked as read',
      data: { success: true },
    };
  }
}
