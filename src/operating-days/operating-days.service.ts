import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OperatingDayStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { bogotaToday, localDateToUtcDate } from '../common/utils/date.util';
import { CreateOperatingDayDto } from './dto/create-operating-day.dto';
import { UpdateOperatingDayDto } from './dto/update-operating-day.dto';
import { defaultScheduleTemplate } from '../schedules/schedule-templates';

@Injectable()
export class OperatingDaysService {
  constructor(private readonly prisma: PrismaService) {}

  list(from?: string, to?: string, status?: OperatingDayStatus) {
    return this.prisma.operatingDay.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: localDateToUtcDate(from) } : {}),
                ...(to ? { lte: localDateToUtcDate(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  async publicDates(from?: string, to?: string): Promise<string[]> {
    const days = await this.prisma.operatingDay.findMany({
      where: {
        status: OperatingDayStatus.OPEN,
        date: { gte: localDateToUtcDate(from ?? bogotaToday()), ...(to ? { lte: localDateToUtcDate(to) } : {}) },
      },
      select: { date: true },
      orderBy: { date: 'asc' },
    });
    return days.map((day) => day.date.toISOString().slice(0, 10));
  }

  /** Lazily provision a weekend selected in the public calendar. */
  async ensureWeekend(dateValue: string) {
    const date = localDateToUtcDate(dateValue);
    const weekday = date.getUTCDay();
    let existing = await this.prisma.operatingDay.findUnique({ where: { date } });
    if (existing || (weekday !== 0 && weekday !== 6)) return existing;

    const prefixes = await this.prisma.operatingDay.findMany({ select: { prefix: true } });
    const used = new Set(prefixes.map((day) => day.prefix));
    let index = 0;
    let prefix = this.alphabeticalPrefix(index);
    while (used.has(prefix)) prefix = this.alphabeticalPrefix(++index);
    try {
      existing = await this.prisma.operatingDay.create({ data: { date, prefix } });
      const settings = await this.prisma.restaurantSettings.findUnique({ where: { id: 'default' } });
      await this.prisma.schedule.createMany({
        data: defaultScheduleTemplate(date).map((startTime) => ({
          operatingDayId: existing!.id, startTime, capacity: settings?.defaultScheduleCapacity ?? 200,
        })),
      });
      return existing;
    } catch (error) {
      if (!this.isUniqueError(error)) throw error;
      return this.prisma.operatingDay.findUnique({ where: { date } });
    }
  }

  async get(id: string) {
    const day = await this.prisma.operatingDay.findUnique({
      where: { id },
      include: { schedules: { orderBy: { startTime: 'asc' } } },
    });
    if (!day) throw new NotFoundException({ code: 'OPERATING_DAY_NOT_FOUND', message: 'Día operativo no encontrado' });
    return day;
  }

  async create(dto: CreateOperatingDayDto, actorId: string) {
    try {
      const day = await this.prisma.operatingDay.create({
        data: { date: localDateToUtcDate(dto.date), prefix: dto.prefix, status: dto.status },
      });
      const slots = defaultScheduleTemplate(day.date);
      if (slots.length) {
        const settings = await this.prisma.restaurantSettings.findUnique({ where: { id: 'default' } });
        await this.prisma.schedule.createMany({
          data: slots.map((startTime) => ({
            operatingDayId: day.id,
            startTime,
            capacity: settings?.defaultScheduleCapacity ?? 200,
          })),
        });
      }
      await this.prisma.auditLog.create({
        data: { userId: actorId, action: 'CREATE_OPERATING_DAY', entity: 'OperatingDay', entityId: day.id },
      });
      return day;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('La fecha o el prefijo ya está asignado');
      throw error;
    }
  }

  async update(id: string, dto: UpdateOperatingDayDto, actorId: string) {
    await this.get(id);
    if (dto.prefix !== undefined || dto.date !== undefined) {
      const reservationCount = await this.prisma.reservation.count({ where: { operatingDayId: id } });
      if (reservationCount > 0) throw new ConflictException('No se puede cambiar fecha o prefijo después de crear reservas');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "OperatingDay" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const day = await tx.operatingDay.update({
          where: { id },
          data: {
            ...(dto.date === undefined ? {} : { date: localDateToUtcDate(dto.date) }),
            ...(dto.prefix === undefined ? {} : { prefix: dto.prefix }),
            ...(dto.status === undefined ? {} : { status: dto.status }),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: dto.status === OperatingDayStatus.CLOSED ? 'CLOSE_OPERATING_DAY' : 'UPDATE_OPERATING_DAY',
            entity: 'OperatingDay',
            entityId: id,
            metadata: { date: dto.date ?? null, prefix: dto.prefix ?? null, status: dto.status ?? null },
          },
        });
        return day;
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('La fecha o el prefijo ya está asignado');
      throw error;
    }
  }

  private isUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private alphabeticalPrefix(index: number): string {
    let value = index + 1;
    let result = '';
    while (value > 0) {
      value -= 1;
      result = String.fromCharCode(65 + (value % 26)) + result;
      value = Math.floor(value / 26);
    }
    return result;
  }
}
