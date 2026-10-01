import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OperatingDayStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { localDateToUtcDate } from '../common/utils/date.util';
import { CreateOperatingDayDto } from './dto/create-operating-day.dto';
import { UpdateOperatingDayDto } from './dto/update-operating-day.dto';

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
}