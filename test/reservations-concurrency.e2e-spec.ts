import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OperatingDayStatus, PrismaClient, ReservationStatus, ScheduleStatus, UserRole, WaitlistStatus } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { OperatingDaysService } from '../src/operating-days/operating-days.service';
import { ReservationsService } from '../src/reservations/reservations.service';
import { CreateReservationDto } from '../src/reservations/dto/create-reservation.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { scheduledTimeAsUtc } from '../src/common/utils/date.util';
import { WaitlistService } from '../src/waitlist/waitlist.service';

describe('reservation concurrency (PostgreSQL)', () => {
  const prisma = new PrismaClient();
  const reservations = new ReservationsService(
    prisma as PrismaService,
    new NotificationsService(prisma as PrismaService, new ConfigService({})),
  );
  const notifications = new NotificationsService(prisma as PrismaService, new ConfigService({}));
  const waitlist = new WaitlistService(prisma as PrismaService, notifications);
  const operatingDays = new OperatingDaysService(prisma as PrismaService);
  const createdDayIds: string[] = [];
  let prefixIndex = 0;

  beforeAll(async () => prisma.$connect());
  afterEach(async () => {
    for (const dayId of createdDayIds.splice(0)) await cleanup(dayId);
  });
  afterAll(async () => prisma.$disconnect());

  it('never exceeds schedule capacity when concurrent requests race', async () => {
    const context = await createContext(200);
    const customer = await prisma.customer.create({
      data: { name: 'Existing guest', email: 'existing@example.test', phone: phoneFor(context.prefix, 0) },
    });
    await prisma.reservation.create({
      data: {
        code: `${context.prefix}1`,
        sequenceNumber: 1,
        customerId: customer.id,
        scheduleId: context.scheduleId,
        operatingDayId: context.dayId,
        codeOperatingDayId: context.dayId,
        pax: 195,
        status: ReservationStatus.CONFIRMED,
      },
    });
    await prisma.operatingDay.update({ where: { id: context.dayId }, data: { reservationSequence: 1 } });

    const results = await Promise.allSettled([
      reservations.create(request(context, 4, 1, context.scheduleId)),
      reservations.create(request(context, 3, 2, context.scheduleId)),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const aggregate = await prisma.reservation.aggregate({
      where: { scheduleId: context.scheduleId, status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.ARRIVED, ReservationStatus.ENTERED] } },
      _sum: { pax: true },
    });
    expect([198, 199]).toContain(aggregate._sum.pax);
  });

  it('assigns distinct consecutive codes to simultaneous reservations across one operating day', async () => {
    const context = await createContext(200);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => reservations.create(request(context, 1, index + 1))),
    );
    const codes = results.map((result) => result.code).sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));

    expect(codes).toEqual(Array.from({ length: 10 }, (_, index) => `${context.prefix}${index + 1}`));
    expect(new Set(codes).size).toBe(10);
  });

  it('lists future OPEN operating dates without exposing schedule details', async () => {
    const context = await createContext(200);
    const openDates = await operatingDays.publicDates();
    expect(openDates).toContain(context.date);

    const closedContext = await createContext(1);
    await prisma.schedule.updateMany({ where: { operatingDayId: closedContext.dayId }, data: { status: ScheduleStatus.CLOSED } });
    await prisma.operatingDay.update({ where: { id: closedContext.dayId }, data: { status: OperatingDayStatus.CLOSED } });
    const datesAfterClosing = await operatingDays.publicDates();
    expect(datesAfterClosing).not.toContain(closedContext.date);
    expect(datesAfterClosing.every((date) => date >= new Date().toISOString().slice(0, 10))).toBe(true);
  });

  it('authenticates seeded internal users and rejects an incorrect password', async () => {
    const auth = new AuthService(
      prisma as PrismaService,
      new JwtService({ secret: 'integration-test-secret-at-least-32-characters' }),
      new ConfigService({}),
    );
    const login = await auth.login('admin@islamorada.local', 'DevelopmentAdmin123!');
    expect(login.user.role).toBe(UserRole.ADMIN);
    expect(login.accessToken).toBeTruthy();
    await expect(auth.login('admin@islamorada.local', 'wrong-password')).rejects.toThrow();
  });

  it('records arrival and entry, and cancellation releases capacity', async () => {
    const context = await createContext(5);
    const host = await prisma.user.findUniqueOrThrow({ where: { email: 'host@islamorada.local' } });
    const cancelled = await reservations.create(request(context, 4, 1, context.scheduleIds[0]));
    const publicConfirmation = await reservations.getPublic(cancelled.id);
    expect(Object.keys(publicConfirmation).sort()).toEqual(['code', 'date', 'id', 'pax', 'startTime', 'status']);
    expect(publicConfirmation.id).toBe(cancelled.id);
    expect(publicConfirmation.code).toBe(cancelled.code);
    await reservations.cancel(cancelled.id, host.id);
    const afterCancellation = await prisma.reservation.aggregate({
      where: { scheduleId: context.scheduleIds[0], status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.ARRIVED, ReservationStatus.ENTERED] } },
      _sum: { pax: true },
    });
    expect(afterCancellation._sum.pax).toBeNull();

    const active = await reservations.create(request(context, 3, 2, context.scheduleIds[1]));
    expect((await reservations.arrival(active.id, host.id)).status).toBe(ReservationStatus.ARRIVED);
    expect((await reservations.entry(active.id, host.id)).status).toBe(ReservationStatus.ENTERED);
  });

  it('marks a late confirmed reservation LOST and releases its PAX', async () => {
    const context = await createContext(5);
    const host = await prisma.user.findUniqueOrThrow({ where: { email: 'host@islamorada.local' } });
    const created = await reservations.create(request(context, 4, 1, context.scheduleIds[0]));
    const lateArrival = new Date(scheduledTimeAsUtc(context.date, '12:00').getTime() + 26 * 60_000);
    const lost = await reservations.lost(created.id, {
      arrivalTime: lateArrival.toISOString(),
      phone: '3001234567',
      observations: 'Llegada posterior a la tolerancia',
    }, host.id);

    expect(lost.status).toBe(ReservationStatus.LOST);
    expect(lost.lostContactPhone).toBe('3001234567');
    const availability = await reservations.availability(context.date, 5);
    expect(availability.schedules.find((schedule) => schedule.id === context.scheduleIds[0])?.availablePax).toBe(5);
  });

  it('keeps a waitlist entry WAITING when email delivery fails', async () => {
    const host = await prisma.user.findUniqueOrThrow({ where: { email: 'host@islamorada.local' } });
    const entry = await waitlist.create({
      name: 'Waitlist test', email: 'waitlist-test@example.test', phone: '3001234567', pax: 2,
    }, host.id);
    try {
      const result = await waitlist.notify(entry.id, host.id);
      expect(result.entry.status).toBe(WaitlistStatus.WAITING);
      const notification = await prisma.notification.findFirstOrThrow({ where: { waitlistEntryId: entry.id } });
      expect(notification.status).toBe('FAILED');
    } finally {
      await prisma.notification.deleteMany({ where: { waitlistEntryId: entry.id } });
      await prisma.auditLog.deleteMany({ where: { entityId: entry.id } });
      await prisma.waitlistEntry.delete({ where: { id: entry.id } });
    }
  });

  async function createContext(capacity: number) {
    const alphabet = 'EFGHIJKLMNOPQRSTUVWXYZ';
    let prefix: string | undefined;
    for (let attempt = 0; attempt < alphabet.length; attempt += 1) {
      const candidate = alphabet[(prefixIndex + attempt) % alphabet.length];
      if (!(await prisma.operatingDay.findUnique({ where: { prefix: candidate } }))) {
        prefix = candidate;
        prefixIndex += attempt + 1;
        break;
      }
    }
    if (!prefix) throw new Error('No hay prefijos libres para la prueba');

    const dayDate = new Date(Date.UTC(2090, 0, 1 + prefixIndex));
    const day = await prisma.operatingDay.create({
      data: { date: dayDate, prefix, status: OperatingDayStatus.OPEN },
    });
    createdDayIds.push(day.id);
    const schedules = await Promise.all(['12:00', '12:30', '13:00', '13:30', '14:00'].map((startTime) =>
      prisma.schedule.create({ data: { operatingDayId: day.id, startTime, capacity, status: ScheduleStatus.OPEN } }),
    ));
    return {
      dayId: day.id,
      scheduleId: schedules[0].id,
      scheduleIds: schedules.map((schedule) => schedule.id),
      date: dayDate.toISOString().slice(0, 10),
      prefix,
    };
  }

  function request(
    context: { scheduleId: string; scheduleIds: string[]; date: string; prefix: string },
    pax: number,
    index: number,
    scheduleId = context.scheduleIds[(index - 1) % context.scheduleIds.length],
  ): CreateReservationDto {
    return {
      name: `Concurrent guest ${index}`,
      email: `guest-${context.prefix}-${index}@example.test`,
      phone: phoneFor(context.prefix, index),
      date: context.date,
      scheduleId,
      pax,
    };
  }

  function phoneFor(prefix: string, index: number): string {
    return `300${prefix.charCodeAt(0)}${String(index).padStart(6, '0')}`;
  }

  async function cleanup(dayId: string): Promise<void> {
    const entries = await prisma.reservation.findMany({ where: { operatingDayId: dayId }, select: { id: true, customerId: true } });
    const reservationIds = entries.map((entry) => entry.id);
    if (reservationIds.length) {
      await prisma.notification.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await prisma.reservationStatusHistory.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await prisma.arrival.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: reservationIds } } });
      await prisma.reservation.deleteMany({ where: { id: { in: reservationIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: entries.map((entry) => entry.customerId) } } });
    }
    await prisma.schedule.deleteMany({ where: { operatingDayId: dayId } });
    await prisma.operatingDay.delete({ where: { id: dayId } });
  }
});