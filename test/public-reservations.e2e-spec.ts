import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common/interfaces';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { OperatingDayStatus } from '@prisma/client';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { createCorsOptions } from '../src/common/cors-options';
import { bogotaToday } from '../src/common/utils/date.util';
import { PrismaService } from '../src/prisma/prisma.service';

describe('public reservation API (HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let createdReservationId: string | undefined;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'public-api-test-secret-at-least-32-characters';
    process.env.JWT_EXPIRES_IN ??= '8h';
    process.env.FRONTEND_URL = [
      'http://localhost:3000',
      'https://isla-morada-front.vercel.app',
      'https://approved-preview.vercel.app',
    ].join(',');

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.enableCors(createCorsOptions(process.env.FRONTEND_URL, process.env.NODE_ENV));
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new ApiExceptionFilter());
    prisma = app.get(PrismaService);
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (!createdReservationId) return;
    const reservation = await prisma.reservation.findUnique({
      where: { id: createdReservationId },
      select: { customerId: true },
    });
    if (reservation) {
      await prisma.notification.deleteMany({ where: { reservationId: createdReservationId } });
      await prisma.reservationStatusHistory.deleteMany({ where: { reservationId: createdReservationId } });
      await prisma.auditLog.deleteMany({ where: { entity: 'Reservation', entityId: createdReservationId } });
      await prisma.reservation.delete({ where: { id: createdReservationId } });
      await prisma.customer.deleteMany({ where: { id: reservation.customerId } });
    }
    createdReservationId = undefined;
  });

  afterAll(async () => app?.close());

  it('serves Bogotá OPEN dates and availability without JWT using public response shapes', async () => {
    const datesResponse = await fetch(`${baseUrl}/api/availability/dates`);
    expect(datesResponse.status).toBe(200);
    const dates = await datesResponse.json() as string[];
    expect(Array.isArray(dates)).toBe(true);
    expect(dates).toContain('2026-10-03');
    expect(dates).toEqual([...dates].sort());
    expect(dates.every((date) => date >= bogotaToday())).toBe(true);
    expect(dates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))).toBe(true);

    const availabilityResponse = await fetch(`${baseUrl}/api/availability?date=2026-10-03&pax=1`);
    expect(availabilityResponse.status).toBe(200);
    const availability = await availabilityResponse.json() as {
      date: string;
      schedules: Array<Record<string, unknown>>;
    };
    expect(availability.date).toBe('2026-10-03');
    expect(availability.schedules.length).toBeGreaterThan(0);
    expect(Object.keys(availability.schedules[0]).sort()).toEqual([
      'availablePax', 'capacity', 'id', 'reservedPax', 'startTime', 'status',
    ]);
  });

  it('allows exact local and Vercel origins, but not unapproved preview origins', async () => {
    for (const origin of ['http://localhost:3000', 'https://isla-morada-front.vercel.app']) {
      const response = await fetch(`${baseUrl}/api/availability/dates`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
      });
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    }

    const rejected = await fetch(`${baseUrl}/api/availability/dates`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://unapproved.vercel.app', 'Access-Control-Request-Method': 'GET' },
    });
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('excludes past and CLOSED operating days from the public calendar', async () => {
    const pastDay = await prisma.operatingDay.create({
      data: { date: new Date('2000-01-01T00:00:00.000Z'), prefix: 'TST1', status: OperatingDayStatus.OPEN },
    });
    const currentOpenDay = await prisma.operatingDay.findUnique({
      where: { date: new Date('2026-10-04T00:00:00.000Z') },
    });

    try {
      if (currentOpenDay) {
        await prisma.operatingDay.update({ where: { id: currentOpenDay.id }, data: { status: OperatingDayStatus.CLOSED } });
      }
      const response = await fetch(`${baseUrl}/api/availability/dates`);
      const dates = await response.json() as string[];
      expect(response.status).toBe(200);
      expect(dates).not.toContain('2000-01-01');
      expect(dates).not.toContain('2026-10-04');
    } finally {
      if (currentOpenDay) {
        await prisma.operatingDay.update({ where: { id: currentOpenDay.id }, data: { status: currentOpenDay.status } });
      }
      await prisma.operatingDay.delete({ where: { id: pastDay.id } });
    }
  });

  it('returns an empty array when no operating days are OPEN', async () => {
    const openDays = await prisma.operatingDay.findMany({
      where: { status: OperatingDayStatus.OPEN },
      select: { id: true },
    });
    await prisma.operatingDay.updateMany({
      where: { id: { in: openDays.map((day) => day.id) } },
      data: { status: OperatingDayStatus.CLOSED },
    });

    try {
      const response = await fetch(`${baseUrl}/api/availability/dates`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    } finally {
      await prisma.operatingDay.updateMany({
        where: { id: { in: openDays.map((day) => day.id) } },
        data: { status: OperatingDayStatus.OPEN },
      });
    }
  });

  it('keeps operating-day and internal reservation reads protected', async () => {
    const operatingDays = await fetch(`${baseUrl}/api/operating-days`);
    const internalReservation = await fetch(`${baseUrl}/api/reservations/00000000-0000-4000-8000-000000000001/internal`);
    expect(operatingDays.status).toBe(401);
    expect(internalReservation.status).toBe(401);
  });

  it('creates and retrieves a public confirmation without PII', async () => {
    const availability = await fetch(`${baseUrl}/api/availability?date=2026-10-03&pax=1`).then((response) => response.json()) as {
      schedules: Array<{ id: string }>;
    };
    const scheduleId = availability.schedules[0].id;
    const email = `public-api-${Date.now()}@example.test`;
    const createResponse = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Public API Test',
        email,
        phone: '3001234567',
        date: '2026-10-03',
        scheduleId,
        pax: 1,
        observations: '',
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as {
      id: string; code: string; status: string; pax: number; date: string; startTime: string;
    };
    createdReservationId = created.id;
    expect(created).toEqual(expect.objectContaining({
      id: expect.any(String),
      code: expect.stringMatching(/^[A-Z]{1,4}\d+$/),
      status: 'CONFIRMED',
      pax: 1,
      date: '2026-10-03',
      startTime: expect.any(String),
    }));
    expect(created).not.toHaveProperty('email');
    expect(created).not.toHaveProperty('name');

    const getResponse = await fetch(`${baseUrl}/api/reservations/${created.id}`);
    expect(getResponse.status).toBe(200);
    const confirmation = await getResponse.json() as Record<string, unknown>;
    expect(Object.keys(confirmation).sort()).toEqual(['code', 'date', 'id', 'pax', 'startTime', 'status']);
    expect(confirmation).not.toHaveProperty('email');
    expect(confirmation).not.toHaveProperty('phone');
    expect(confirmation).not.toHaveProperty('observations');
    expect(confirmation).not.toHaveProperty('statusHistory');

    const missing = await fetch(`${baseUrl}/api/reservations/00000000-0000-4000-8000-000000000001`);
    expect(missing.status).toBe(404);
  });

  it('returns HTTP 400 for invalid public input and 409 when capacity is exhausted', async () => {
    const invalidResponse = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'invalid', phone: '', date: 'not-a-date', scheduleId: 'bad-id', pax: 0 }),
    });
    expect(invalidResponse.status).toBe(400);

    const availability = await fetch(`${baseUrl}/api/availability?date=2026-10-03&pax=1`).then((response) => response.json()) as {
      schedules: Array<{ id: string }>;
    };
    const scheduleId = availability.schedules[0].id;
    const closedDayResponse = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Closed day',
        email: `closed-${Date.now()}@example.test`,
        phone: '3009876543',
        date: '2026-10-05',
        scheduleId,
        pax: 1,
      }),
    });
    expect(closedDayResponse.status).toBe(404);

    const schedule = await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } });
    const activePax = await prisma.reservation.aggregate({
      where: { scheduleId, status: { in: ['CONFIRMED', 'ARRIVED', 'ENTERED'] } },
      _sum: { pax: true },
    });
    try {
      await prisma.schedule.update({ where: { id: scheduleId }, data: { capacity: activePax._sum.pax ?? 0 } });
      const conflictResponse = await fetch(`${baseUrl}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Capacity Conflict',
          email: `capacity-${Date.now()}@example.test`,
          phone: '3009876543',
          date: '2026-10-03',
          scheduleId,
          pax: 1,
        }),
      });
      expect(conflictResponse.status).toBe(409);
      expect(await conflictResponse.json()).toEqual(expect.objectContaining({ code: 'SCHEDULE_CAPACITY_EXCEEDED' }));
    } finally {
      await prisma.schedule.update({ where: { id: scheduleId }, data: { capacity: schedule.capacity } });
    }
  });

  it('rate limits the public dates endpoint after 60 requests per minute', async () => {
    let lastResponse: Response | undefined;
    for (let requestNumber = 0; requestNumber < 61; requestNumber += 1) {
      lastResponse = await fetch(`${baseUrl}/api/availability/dates`);
    }
    expect(lastResponse?.status).toBe(429);
    expect(await lastResponse?.json()).toEqual(expect.objectContaining({ code: 'RATE_LIMITED' }));
  });
});