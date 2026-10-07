import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Request } from 'express';

@Controller(['notifications', 'api/notifications'])
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getUserNotifications(@Req() req: Request) {
    const user = (req as any).user;
    return this.notificationService.getUserNotifications(user);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') notificationId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.notificationService.markAsRead(notificationId, user);
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: Request) {
    const user = (req as any).user;
    return this.notificationService.markAllAsRead(user);
  }
}
