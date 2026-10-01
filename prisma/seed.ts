import { hash } from 'bcrypt';
import { OperatingDayStatus, PrismaClient, ScheduleStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de desarrollo está deshabilitado en producción.');
  }

  const users = [
    { name: 'Administrador de desarrollo', email: 'admin@islamorada.local', password: 'DevelopmentAdmin123!', role: UserRole.ADMIN },
    { name: 'Reservas de desarrollo', email: 'reservas@islamorada.local', password: 'DevelopmentReservas123!', role: UserRole.RESERVAS },
    { name: 'Host de desarrollo', email: 'host@islamorada.local', password: 'DevelopmentHost123!', role: UserRole.HOST },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        name: user.name,
        email: user.email,
        passwordHash: await hash(user.password, 12),
        role: user.role,
      },
      update: {
        name: user.name,
        passwordHash: await hash(user.password, 12),
        role: user.role,
        active: true,
      },
    });
  }

  await prisma.restaurantSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      restaurantName: 'Isla Morada',
      reservationToleranceMinutes: 25,
      defaultScheduleCapacity: 200,
      timezone: 'America/Bogota',
    },
    update: {},
  });

  const days = [
    { date: new Date('2026-10-03T00:00:00.000Z'), prefix: 'A' },
    { date: new Date('2026-10-04T00:00:00.000Z'), prefix: 'B' },
    { date: new Date('2026-10-10T00:00:00.000Z'), prefix: 'C' },
    { date: new Date('2026-10-11T00:00:00.000Z'), prefix: 'D' },
  ];
  const times = ['12:00', '12:30', '13:00', '13:30', '14:00'];

  for (const item of days) {
    const operatingDay = await prisma.operatingDay.upsert({
      where: { date: item.date },
      create: { date: item.date, prefix: item.prefix, status: OperatingDayStatus.OPEN },
      update: { prefix: item.prefix, status: OperatingDayStatus.OPEN },
    });
    for (const startTime of times) {
      await prisma.schedule.upsert({
        where: { operatingDayId_startTime: { operatingDayId: operatingDay.id, startTime } },
        create: { operatingDayId: operatingDay.id, startTime, capacity: 200, status: ScheduleStatus.OPEN },
        update: { capacity: 200, status: ScheduleStatus.OPEN },
      });
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());