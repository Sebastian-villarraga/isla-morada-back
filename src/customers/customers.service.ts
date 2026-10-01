import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list(search?: string, page = 1, limit = 20) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : {};
    return this.prisma.customer.findMany({
      where,
      select: { id: true, name: true, email: true, phone: true, createdAt: true, _count: { select: { reservations: true } } },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        reservations: {
          select: {
            id: true,
            code: true,
            pax: true,
            status: true,
            operatingDay: { select: { date: true } },
            schedule: { select: { startTime: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!customer) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Cliente no encontrado' });
    return customer;
  }
}