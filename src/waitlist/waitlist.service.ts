import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, WaitlistStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { UpdateWaitlistDto } from './dto/update-waitlist.dto';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  list(filters: { date?: string; status?: WaitlistStatus; name?: string; phone?: string; pax?: number }) {
    const start = filters.date ? new Date(`${filters.date}T05:00:00.000Z`) : undefined;
    const end = start ? new Date(start.getTime() + 86_400_000) : undefined;
    return this.prisma.waitlistEntry.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.name ? { name: { contains: filters.name, mode: 'insensitive' } } : {}),
        ...(filters.phone ? { phone: { contains: filters.phone } } : {}),
        ...(filters.pax ? { pax: filters.pax } : {}),
        ...(start && end ? { arrivalTime: { gte: start, lt: end } } : {}),
      },
      orderBy: { arrivalTime: 'asc' },
    });
  }

  async get(id: string) {
    const entry = await this.prisma.waitlistEntry.findUnique({ where: { id } });
    if (!entry) throw this.notFound();
    return entry;
  }

  async create(dto: CreateWaitlistDto, actorId: string) {
    if (dto.sourceReservationId) {
      const reservation = await this.prisma.reservation.findUnique({ where: { id: dto.sourceReservationId } });
      if (!reservation) throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reserva de origen no encontrada' });
    }
    const entry = await this.prisma.waitlistEntry.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone.trim(),
        pax: dto.pax,
        observations: dto.observations?.trim() || null,
        sourceReservationId: dto.sourceReservationId,
      },
    });
    await this.prisma.auditLog.create({
      data: { userId: actorId, action: 'CREATE_WAITLIST', entity: 'WaitlistEntry', entityId: entry.id },
    });
    return entry;
  }

  async update(id: string, dto: UpdateWaitlistDto, actorId: string) {
    const existing = await this.get(id);
    if (dto.status && !this.allowedTransition(existing.status, dto.status)) {
      throw new ConflictException({ code: 'INVALID_STATE_TRANSITION', message: `Transición ${existing.status} a ${dto.status} no permitida` });
    }
    const entry = await this.prisma.waitlistEntry.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
        ...(dto.email === undefined ? {} : { email: dto.email.trim().toLowerCase() }),
        ...(dto.phone === undefined ? {} : { phone: dto.phone.trim() }),
        ...(dto.pax === undefined ? {} : { pax: dto.pax }),
        ...(dto.observations === undefined ? {} : { observations: dto.observations }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'UPDATE_WAITLIST',
        entity: 'WaitlistEntry',
        entityId: id,
        metadata: {
          name: dto.name ?? null,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          pax: dto.pax ?? null,
          observations: dto.observations ?? null,
          status: dto.status ?? null,
        },
      },
    });
    return entry;
  }

  async cancel(id: string, actorId: string) {
    return this.update(id, { status: WaitlistStatus.CANCELLED }, actorId);
  }

  async notify(id: string, actorId: string) {
    const pending = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "WaitlistEntry" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const entry = await tx.waitlistEntry.findUnique({ where: { id } });
      if (!entry) throw this.notFound();
      if (entry.status !== WaitlistStatus.WAITING) {
        throw new ConflictException({ code: 'INVALID_STATE_TRANSITION', message: 'Solo una entrada WAITING puede notificarse' });
      }
      const existingPending = await tx.notification.findFirst({
        where: { waitlistEntryId: id, type: NotificationType.WAITLIST_NOTIFICATION, status: 'PENDING' },
      });
      if (existingPending) throw new ConflictException('Ya hay una notificación en curso para esta entrada');
      const notification = await tx.notification.create({
        data: { waitlistEntryId: id, type: NotificationType.WAITLIST_NOTIFICATION, recipient: entry.email },
      });
      return { entry, notification };
    });
    const delivery = await this.notifications.sendWaitlist(pending.notification.id, pending.entry.email, pending.entry.name);
    if (delivery === 'SENT') {
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.waitlistEntry.updateMany({
          where: { id, status: WaitlistStatus.WAITING },
          data: { status: WaitlistStatus.NOTIFIED },
        });
        if (changed.count) {
          await tx.auditLog.create({
            data: {
              userId: actorId,
              action: 'NOTIFY_WAITLIST',
              entity: 'WaitlistEntry',
              entityId: id,
              metadata: { notificationId: pending.notification.id },
            },
          });
        }
      });
    }
    return { entry: await this.get(id), notificationId: pending.notification.id };
  }

  private allowedTransition(from: WaitlistStatus, to: WaitlistStatus): boolean {
    const allowed: Record<WaitlistStatus, WaitlistStatus[]> = {
      WAITING: [WaitlistStatus.NOTIFIED, WaitlistStatus.ARRIVED, WaitlistStatus.NO_SHOW, WaitlistStatus.CANCELLED],
      NOTIFIED: [WaitlistStatus.ARRIVED, WaitlistStatus.NO_SHOW, WaitlistStatus.CANCELLED],
      ARRIVED: [WaitlistStatus.ENTERED, WaitlistStatus.NO_SHOW, WaitlistStatus.CANCELLED],
      ENTERED: [],
      NO_SHOW: [],
      CANCELLED: [],
    };
    return from === to || allowed[from].includes(to);
  }

  private notFound() {
    return new NotFoundException({ code: 'WAITLIST_ENTRY_NOT_FOUND', message: 'Entrada de lista de espera no encontrada' });
  }
}