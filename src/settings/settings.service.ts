import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.restaurantSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });
  }

  async update(dto: UpdateSettingsDto, actorId: string) {
    const settings = await this.prisma.restaurantSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'UPDATE_SETTINGS',
        entity: 'RestaurantSettings',
        entityId: 'default',
        metadata: {
          restaurantName: dto.restaurantName ?? null,
          restaurantEmail: dto.restaurantEmail ?? null,
          restaurantPhone: dto.restaurantPhone ?? null,
          reservationToleranceMinutes: dto.reservationToleranceMinutes ?? null,
          defaultScheduleCapacity: dto.defaultScheduleCapacity ?? null,
        },
      },
    });
    return settings;
  }
}