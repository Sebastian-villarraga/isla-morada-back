import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationStatus, UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

type UserRequest = Request & { user: { userId: string } };

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.RESERVAS)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query('status') status?: NotificationStatus) {
    return this.prisma.notification.findMany({
      where: status ? { status } : {},
      select: { id: true, type: true, channel: true, recipient: true, status: true, errorMessage: true, sentAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post(':id/retry')
  retry(@Param('id', ParseUUIDPipe) id: string, @Req() request: UserRequest) {
    return this.notifications.retry(id, request.user.userId);
  }
}