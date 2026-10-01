import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OperatingDayStatus, ScheduleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  list(operatingDayId?: string, status?: ScheduleStatus) {
    return this.prisma.schedule.findMany({
      where: { ...(operatingDayId ? { operatingDayId } : {}), ...(status ? { status } : {}) },
      include: { operatingDay: true },
      orderBy: [{ operatingDay: { date: 'asc' } }, { startTime: 'asc' }],
    });
  }

  async get(id: string) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id }, include: { operatingDay: true } });
    if (!schedule) throw new NotFoundException({ code: 'SCHEDULE_NOT_FOUND', message: 'Horario no encontrado' });
    return schedule;
  }

  async create(dto: CreateScheduleDto, actorId: string) {
    const [day, settings] = await Promise.all([
      this.prisma.operatingDay.findUnique({ where: { id: dto.operatingDayId } }),
      this.prisma.restaurantSettings.findUnique({ where: { id: 'default' } }),
    ]);
    if (!day) throw new NotFoundException({ code: 'OPERATING_DAY_NOT_FOUND', message: 'Día operativo no encontrado' });
    if (day.status !== OperatingDayStatus.OPEN) {
      throw new ConflictException({ code: 'OPERATING_DAY_CLOSED', message: 'El día operativo está cerrado' });
    }
    try {
      const schedule = await this.prisma.schedule.create({
        data: {
          operatingDayId: dto.operatingDayId,
          startTime: dto.startTime,
          capacity: dto.capacity ?? settings?.defaultScheduleCapacity ?? 200,
          status: dto.status ?? ScheduleStatus.OPEN,
        },
      });
      await this.prisma.auditLog.create({
        data: { userId: actorId, action: 'CREATE_SCHEDULE', entity: 'Schedule', entityId: schedule.id },
      });
      return schedule;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Ya existe ese horario para el día');
      throw error;
    }
  }

  async update(id: string, dto: UpdateScheduleDto, actorId: string) {
    const existing = await this.get(id);
    if (dto.operatingDayId && dto.operatingDayId !== existing.operatingDayId) {
      throw new ConflictException('El horario no se puede mover a otro día operativo');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "OperatingDay" WHERE "id" = ${existing.operatingDayId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "Schedule" WHERE "id" = ${id}::uuid FOR UPDATE`;
        if (dto.capacity !== undefined) {
          const aggregate = await tx.reservation.aggregate({
            where: { scheduleId: id, status: { in: ['CONFIRMED', 'ARRIVED', 'ENTERED'] } },
            _sum: { pax: true },
          });
          if (dto.capacity < (aggregate._sum.pax ?? 0)) {
            throw new ConflictException({
              code: 'SCHEDULE_CAPACITY_BELOW_RESERVED',
              message: 'La capacidad no puede ser inferior a los PAX reservados',
            });
          }
        }
        const schedule = await tx.schedule.update({
          where: { id },
          data: {
            ...(dto.startTime === undefined ? {} : { startTime: dto.startTime }),
            ...(dto.capacity === undefined ? {} : { capacity: dto.capacity }),
            ...(dto.status === undefined ? {} : { status: dto.status }),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: dto.capacity === undefined ? 'UPDATE_SCHEDULE' : 'UPDATE_CAPACITY',
            entity: 'Schedule',
            entityId: id,
            metadata: { startTime: dto.startTime ?? null, capacity: dto.capacity ?? null, status: dto.status ?? null },
          },
        });
        return schedule;
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Ya existe ese horario para el día');
      throw error;
    }
  }

  async setStatus(id: string, status: ScheduleStatus, actorId: string) {
    const schedule = await this.get(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OperatingDay" WHERE "id" = ${schedule.operatingDayId}::uuid FOR UPDATE`;
      if (status === ScheduleStatus.OPEN) {
        const day = await tx.operatingDay.findUnique({ where: { id: schedule.operatingDayId } });
        if (day?.status !== OperatingDayStatus.OPEN) {
          throw new ConflictException({ code: 'OPERATING_DAY_CLOSED', message: 'No se puede abrir un horario de un día cerrado' });
        }
      }
      const updated = await tx.schedule.update({ where: { id }, data: { status } });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: status === ScheduleStatus.OPEN ? 'OPEN_SCHEDULE' : 'CLOSE_SCHEDULE',
          entity: 'Schedule',
          entityId: id,
        },
      });
      return updated;
    });
  }

  private async activePax(scheduleId: string): Promise<number> {
    const result = await this.prisma.reservation.aggregate({
      where: { scheduleId, status: { in: ['CONFIRMED', 'ARRIVED', 'ENTERED'] } },
      _sum: { pax: true },
    });
    return result._sum.pax ?? 0;
  }

  private isUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}