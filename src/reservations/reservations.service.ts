import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  OperatingDayStatus,
  Prisma,
  ReservationStatus,
  ScheduleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { bogotaToday, localDateToUtcDate, scheduledTimeAsUtc } from '../common/utils/date.util';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { MarkLostDto } from './dto/mark-lost.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

const capacityStatuses: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.ARRIVED,
  ReservationStatus.ENTERED,
];

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  async create(dto: CreateReservationDto, actorId?: string) {
    const day = await this.prisma.operatingDay.findUnique({ where: { date: localDateToUtcDate(dto.date) } });
    if (!day) throw new NotFoundException({ code: 'OPERATING_DAY_NOT_FOUND', message: 'No hay operación configurada para esa fecha' });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "OperatingDay" WHERE "id" = ${day.id}::uuid FOR UPDATE`);
      const currentDay = await tx.operatingDay.findUnique({ where: { id: day.id } });
      if (!currentDay || currentDay.status !== OperatingDayStatus.OPEN) {
        throw new ConflictException({ code: 'OPERATING_DAY_CLOSED', message: 'El día operativo está cerrado' });
      }

      const schedule = await tx.schedule.findUnique({ where: { id: dto.scheduleId } });
      if (!schedule || schedule.operatingDayId !== currentDay.id) {
        throw new NotFoundException({ code: 'SCHEDULE_NOT_FOUND', message: 'Horario no encontrado para esa fecha' });
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Schedule" WHERE "id" = ${schedule.id}::uuid FOR UPDATE`);
      const currentSchedule = await tx.schedule.findUnique({ where: { id: schedule.id } });
      if (!currentSchedule || currentSchedule.status !== ScheduleStatus.OPEN) {
        throw new ConflictException({ code: 'SCHEDULE_CLOSED', message: 'El horario está cerrado' });
      }

      const sum = await tx.reservation.aggregate({
        where: { scheduleId: currentSchedule.id, status: { in: capacityStatuses } },
        _sum: { pax: true },
      });
      const reservedPax = sum._sum.pax ?? 0;
      if (currentSchedule.capacity - reservedPax < dto.pax) {
        throw new ConflictException({
          statusCode: 409,
          code: 'SCHEDULE_CAPACITY_EXCEEDED',
          message: 'El horario seleccionado acaba de quedarse sin disponibilidad.',
        });
      }

      const sequence = await tx.operatingDay.update({
        where: { id: currentDay.id },
        data: { reservationSequence: { increment: 1 } },
        select: { reservationSequence: true, prefix: true },
      });
      const customerData = {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone.trim(),
      };
      const existingCustomer = await tx.customer.findFirst({
        where: { OR: [{ phone: customerData.phone }, { email: customerData.email }] },
        orderBy: { createdAt: 'asc' },
      });
      const customer = existingCustomer
        ? await tx.customer.update({ where: { id: existingCustomer.id }, data: customerData })
        : await tx.customer.create({ data: customerData });
      const reservation = await tx.reservation.create({
        data: {
          code: `${sequence.prefix}${sequence.reservationSequence}`,
          sequenceNumber: sequence.reservationSequence,
          customerId: customer.id,
          operatingDayId: currentDay.id,
          codeOperatingDayId: currentDay.id,
          scheduleId: currentSchedule.id,
          createdById: actorId,
          pax: dto.pax,
          observations: dto.observations?.trim() || null,
          statusHistory: { create: { newStatus: ReservationStatus.CONFIRMED, changedById: actorId } },
        },
        include: { customer: true, schedule: true, operatingDay: true },
      });
      const notification = await tx.notification.create({
        data: {
          reservationId: reservation.id,
          type: NotificationType.RESERVATION_CONFIRMATION,
          recipient: customer.email,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'CREATE_RESERVATION',
          entity: 'Reservation',
          entityId: reservation.id,
          metadata: { code: reservation.code, pax: reservation.pax, scheduleId: reservation.scheduleId },
        },
      });
      return { reservation, notificationId: notification.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    await this.notifications.sendReservationConfirmation({
      notificationId: result.notificationId,
      recipient: result.reservation.customer.email,
      name: result.reservation.customer.name,
      code: result.reservation.code,
      date: result.reservation.operatingDay.date.toISOString().slice(0, 10),
      time: result.reservation.schedule.startTime,
      pax: result.reservation.pax,
    });
    return this.publicReservation(result.reservation);
  }

  async availability(date: string, pax: number) {
    const day = await this.prisma.operatingDay.findUnique({
      where: { date: localDateToUtcDate(date) },
      include: { schedules: { where: { status: ScheduleStatus.OPEN }, orderBy: { startTime: 'asc' } } },
    });
    if (!day || day.status !== OperatingDayStatus.OPEN) return { date, schedules: [] };
    const schedules = await Promise.all(day.schedules.map(async (schedule) => {
      const sum = await this.prisma.reservation.aggregate({
        where: { scheduleId: schedule.id, status: { in: capacityStatuses } },
        _sum: { pax: true },
      });
      const reservedPax = sum._sum.pax ?? 0;
      const availablePax = Math.max(0, schedule.capacity - reservedPax);
      return { id: schedule.id, startTime: schedule.startTime, capacity: schedule.capacity, reservedPax, availablePax, status: schedule.status };
    }));
    return { date, schedules: schedules.filter((schedule) => schedule.availablePax >= pax) };
  }

  async getPublic(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { customer: true, operatingDay: true, schedule: true },
    });
    if (!reservation) throw this.notFound();
    return this.publicReservation(reservation);
  }

  async list(filters: {
    date?: string; status?: ReservationStatus; code?: string; customerName?: string; search?: string;
    phone?: string; scheduleId?: string; page: number; limit: number;
  }) {
    const where: Prisma.ReservationWhereInput = {
      ...(filters.date ? { operatingDay: { date: localDateToUtcDate(filters.date) } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.code ? { code: { contains: filters.code, mode: 'insensitive' } } : {}),
      ...(filters.scheduleId ? { scheduleId: filters.scheduleId } : {}),
      ...(filters.search
        ? {
            OR: [
              { code: { contains: filters.search, mode: 'insensitive' } },
              { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
              { customer: { phone: { contains: filters.search } } },
            ],
          }
        : {}),
      ...(!filters.search && filters.customerName
        ? { customer: { name: { contains: filters.customerName, mode: 'insensitive' } } }
        : {}),
      ...(!filters.search && filters.phone ? { customer: { phone: { contains: filters.phone } } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: { customer: true, operatingDay: true, schedule: true },
        orderBy: [{ schedule: { startTime: 'asc' } }, { sequenceNumber: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return {
      data,
      meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  today(search?: string) {
    return this.list({ date: bogotaToday(), page: 1, limit: 100, ...(search ? { search } : {}) });
  }

  async getInternal(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { customer: true, operatingDay: true, schedule: true, arrival: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
    if (!reservation) throw this.notFound();
    const settings = await this.prisma.restaurantSettings.findUnique({ where: { id: 'default' } });
    const tolerance = settings?.reservationToleranceMinutes ?? 25;
    const scheduled = scheduledTimeAsUtc(reservation.operatingDay.date.toISOString().slice(0, 10), reservation.schedule.startTime);
    return { ...reservation, toleranceExceeded: Date.now() > scheduled.getTime() + tolerance * 60_000 };
  }

  async update(id: string, dto: UpdateReservationDto, actorId: string) {
    const existing = await this.prisma.reservation.findUnique({ where: { id }, include: { customer: true, schedule: true, operatingDay: true } });
    if (!existing) throw this.notFound();
    if (existing.status === ReservationStatus.CANCELLED || existing.status === ReservationStatus.LOST) {
      throw new ConflictException({ code: 'RESERVATION_INVALID_STATE', message: 'No se puede modificar una reserva cancelada o perdida' });
    }
    if (dto.date && dto.date !== existing.operatingDay.date.toISOString().slice(0, 10) && !dto.scheduleId) {
      throw new BadRequestException('Debe seleccionar scheduleId al cambiar la fecha');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const destinationId = dto.scheduleId ?? existing.scheduleId;
      const initialDestination = await tx.schedule.findUnique({ where: { id: destinationId } });
      if (!initialDestination) throw new NotFoundException({ code: 'SCHEDULE_NOT_FOUND', message: 'Horario no encontrado' });
      const dayIds = [...new Set([existing.operatingDayId, initialDestination.operatingDayId])].sort();
      for (const dayId of dayIds) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "OperatingDay" WHERE "id" = ${dayId}::uuid FOR UPDATE`);
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Reservation" WHERE "id" = ${id}::uuid FOR UPDATE`);
      const reservation = await tx.reservation.findUnique({ where: { id } });
      if (!reservation || reservation.operatingDayId !== existing.operatingDayId || !capacityStatuses.includes(reservation.status)) {
        throw new ConflictException({ code: 'RESERVATION_INVALID_STATE', message: 'La reserva ya no se puede modificar' });
      }
      const destination = await tx.schedule.findUnique({ where: { id: destinationId }, include: { operatingDay: true } });
      if (!destination) throw new NotFoundException({ code: 'SCHEDULE_NOT_FOUND', message: 'Horario no encontrado' });
      if (dto.date && destination.operatingDay.date.toISOString().slice(0, 10) !== dto.date) {
        throw new BadRequestException('El horario no corresponde a la fecha seleccionada');
      }
      if (destination.operatingDay.status !== OperatingDayStatus.OPEN || destination.status !== ScheduleStatus.OPEN) {
        throw new ConflictException({ code: 'SCHEDULE_CLOSED', message: 'El nuevo horario no está disponible' });
      }
      const pax = dto.pax ?? reservation.pax;
      const sum = await tx.reservation.aggregate({
        where: { scheduleId: destination.id, status: { in: capacityStatuses }, id: { not: reservation.id } },
        _sum: { pax: true },
      });
      if (destination.capacity - (sum._sum.pax ?? 0) < pax) {
        throw new ConflictException({ code: 'SCHEDULE_CAPACITY_EXCEEDED', message: 'No hay capacidad suficiente para este horario' });
      }
      const customer = await tx.customer.update({
        where: { id: reservation.customerId },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.email === undefined ? {} : { email: dto.email.trim().toLowerCase() }),
          ...(dto.phone === undefined ? {} : { phone: dto.phone.trim() }),
        },
      });
      const updated = await tx.reservation.update({
        where: { id },
        data: {
          scheduleId: destination.id,
          operatingDayId: destination.operatingDayId,
          pax,
          ...(dto.observations === undefined ? {} : { observations: dto.observations }),
        },
        include: { customer: true, schedule: true, operatingDay: true },
      });
      const notification = await tx.notification.create({
        data: { reservationId: id, type: NotificationType.RESERVATION_UPDATED, recipient: customer.email },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'UPDATE_RESERVATION',
          entity: 'Reservation',
          entityId: id,
          metadata: {
            name: dto.name ?? null,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            date: dto.date ?? null,
            scheduleId: dto.scheduleId ?? null,
            pax: dto.pax ?? null,
            observations: dto.observations ?? null,
          },
        },
      });
      return { updated, notificationId: notification.id };
    });
    await this.notifications.sendReservationUpdate(result.notificationId, result.updated.customer.email, result.updated.customer.name, result.updated.code);
    return this.publicReservation(result.updated);
  }

  async cancel(id: string, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.reservation.updateMany({
        where: { id, status: ReservationStatus.CONFIRMED },
        data: { status: ReservationStatus.CANCELLED },
      });
      if (!changed.count) {
        const exists = await tx.reservation.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw this.notFound();
        throw new ConflictException({ code: 'INVALID_STATE_TRANSITION', message: 'Solo una reserva CONFIRMED puede cancelarse' });
      }
      const reservation = await tx.reservation.findUniqueOrThrow({ where: { id }, include: { customer: true, schedule: true, operatingDay: true } });
      await tx.reservationStatusHistory.create({ data: { reservationId: id, previousStatus: ReservationStatus.CONFIRMED, newStatus: ReservationStatus.CANCELLED, changedById: actorId } });
      const notification = await tx.notification.create({
        data: { reservationId: id, type: NotificationType.RESERVATION_CANCELLED, recipient: reservation.customer.email },
      });
      await tx.auditLog.create({ data: { userId: actorId, action: 'CANCEL_RESERVATION', entity: 'Reservation', entityId: id } });
      return { reservation, notificationId: notification.id };
    });
    await this.notifications.sendReservationCancellation(result.notificationId, result.reservation.customer.email, result.reservation.customer.name, result.reservation.code);
    return this.publicReservation(result.reservation);
  }

  async arrival(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.reservation.updateMany({
        where: { id, status: ReservationStatus.CONFIRMED },
        data: { status: ReservationStatus.ARRIVED },
      });
      if (!changed.count) {
        const exists = await tx.reservation.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw this.notFound();
        throw new ConflictException({ code: 'INVALID_STATE_TRANSITION', message: 'Solo una reserva CONFIRMED puede registrar llegada' });
      }
      await tx.arrival.create({ data: { reservationId: id, arrivalTime: new Date(), registeredById: actorId } });
      await tx.reservationStatusHistory.create({ data: { reservationId: id, previousStatus: ReservationStatus.CONFIRMED, newStatus: ReservationStatus.ARRIVED, changedById: actorId } });
      await tx.auditLog.create({ data: { userId: actorId, action: 'MARK_ARRIVED', entity: 'Reservation', entityId: id } });
    });
    return this.getInternal(id);
  }

  async entry(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.reservation.updateMany({ where: { id, status: ReservationStatus.ARRIVED }, data: { status: ReservationStatus.ENTERED } });
      if (changed.count !== 1) throw new ConflictException({ code: 'INVALID_STATE_TRANSITION', message: 'Solo una reserva ARRIVED puede ingresar' });
      await tx.arrival.update({ where: { reservationId: id }, data: { entryTime: new Date() } });
      await tx.reservationStatusHistory.create({ data: { reservationId: id, previousStatus: ReservationStatus.ARRIVED, newStatus: ReservationStatus.ENTERED, changedById: actorId } });
      await tx.auditLog.create({ data: { userId: actorId, action: 'MARK_ENTERED', entity: 'Reservation', entityId: id } });
    });
    return this.getInternal(id);
  }

  async lost(id: string, dto: MarkLostDto, actorId: string) {
    const existing = await this.prisma.reservation.findUnique({ where: { id }, include: { customer: true, schedule: true, operatingDay: true } });
    if (!existing) throw this.notFound();
    const settings = await this.prisma.restaurantSettings.findUnique({ where: { id: 'default' } });
    const scheduled = scheduledTimeAsUtc(existing.operatingDay.date.toISOString().slice(0, 10), existing.schedule.startTime);
    const arrivalTime = new Date(dto.arrivalTime);
    if (arrivalTime.getTime() <= scheduled.getTime() + (settings?.reservationToleranceMinutes ?? 25) * 60_000) {
      throw new ConflictException({ code: 'TOLERANCE_NOT_EXCEEDED', message: 'La hora de llegada no supera la tolerancia configurada' });
    }
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.reservation.updateMany({
        where: { id, status: ReservationStatus.CONFIRMED },
        data: { status: ReservationStatus.LOST, lostArrivalTime: arrivalTime, lostContactPhone: dto.phone, lostReason: dto.observations ?? null, lostAt: new Date(), lostById: actorId },
      });
      if (changed.count !== 1) throw new ConflictException({ code: 'RESERVATION_INVALID_STATE', message: 'Solo una reserva CONFIRMED puede marcarse como LOST' });
      await tx.reservationStatusHistory.create({
        data: { reservationId: id, previousStatus: ReservationStatus.CONFIRMED, newStatus: ReservationStatus.LOST, changedById: actorId, reason: dto.observations ?? null },
      });
      await tx.auditLog.create({ data: { userId: actorId, action: 'MARK_LOST', entity: 'Reservation', entityId: id, metadata: { arrivalTime: arrivalTime.toISOString(), phone: dto.phone } } });
    });
    return this.getInternal(id);
  }

  async notifyAvailability(id: string, actorId: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id }, include: { customer: true } });
    if (!reservation) throw this.notFound();
    if (reservation.status !== ReservationStatus.LOST) {
      throw new ConflictException({ code: 'RESERVATION_INVALID_STATE', message: 'Solo una reserva LOST puede recibir aviso de disponibilidad' });
    }
    const notification = await this.prisma.notification.create({
      data: { reservationId: id, type: NotificationType.AVAILABILITY_NOTIFICATION, recipient: reservation.customer.email },
    });
    const delivery = await this.notifications.sendAvailability(notification.id, reservation.customer.email, reservation.customer.name, reservation.code);
    const updated = delivery === 'SENT'
      ? await this.prisma.reservation.update({ where: { id }, data: { availabilitySentAt: new Date() } })
      : reservation;
    await this.prisma.auditLog.create({ data: { userId: actorId, action: 'NOTIFY_AVAILABILITY', entity: 'Reservation', entityId: id, metadata: { notificationId: notification.id } } });
    return { id: updated.id, notificationId: notification.id };
  }

  private async transition(id: string, from: ReservationStatus, to: ReservationStatus, actorId: string, action: string) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.reservation.updateMany({ where: { id, status: from }, data: { status: to } });
      if (!changed.count) {
        const exists = await tx.reservation.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw this.notFound();
        throw new ConflictException({ code: 'INVALID_STATE_TRANSITION', message: `Transición ${from} a ${to} no permitida` });
      }
      await tx.reservationStatusHistory.create({ data: { reservationId: id, previousStatus: from, newStatus: to, changedById: actorId } });
      await tx.auditLog.create({ data: { userId: actorId, action, entity: 'Reservation', entityId: id } });
      return tx.reservation.findUniqueOrThrow({ where: { id }, include: { customer: true, schedule: true, operatingDay: true } });
    });
  }

  private publicReservation(reservation: {
    id: string; code: string; status: ReservationStatus; pax: number;
    operatingDay: { date: Date }; schedule: { startTime: string };
  }) {
    return {
      id: reservation.id,
      code: reservation.code,
      status: reservation.status,
      pax: reservation.pax,
      date: reservation.operatingDay.date.toISOString().slice(0, 10),
      startTime: reservation.schedule.startTime,
    };
  }

  private notFound() {
    return new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reserva no encontrada' });
  }
}