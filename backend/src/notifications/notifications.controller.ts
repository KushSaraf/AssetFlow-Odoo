import { Controller, Get, Patch, Param, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

interface RequestWithUser {
  user: {
    id: string;
    role: string;
    department_id: string;
  };
}

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('dashboard')
  getDashboard(@Req() req: RequestWithUser) {
    return this.notificationsService.getDashboard(req.user);
  }

  @Get('notifications')
  getNotifications(@Req() req: RequestWithUser) {
    return this.notificationsService.getNotifications(req.user);
  }

  @Patch('notifications/read-all')
  markAllAsRead(@Req() req: RequestWithUser) {
    return this.notificationsService.markAllAsRead(req.user);
  }

  @Patch('notifications/:id/read')
  markAsRead(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.notificationsService.markAsRead(id, req.user);
  }
}
