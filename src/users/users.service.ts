import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' });
    return user;
  }

  async create(dto: CreateUserDto, actorId: string) {
    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          passwordHash: await hash(dto.password, 12),
          role: dto.role,
        },
        select: { id: true, name: true, email: true, role: true, active: true },
      });
      await this.audit(actorId, 'CREATE_USER', user.id);
      return user;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('El correo ya está registrado');
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    await this.get(id);
    const data = {
      ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
      ...(dto.email === undefined ? {} : { email: dto.email.trim().toLowerCase() }),
      ...(dto.role === undefined ? {} : { role: dto.role }),
      ...(dto.password === undefined ? {} : { passwordHash: await hash(dto.password, 12) }),
    };
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    await this.audit(actorId, 'UPDATE_USER', id);
    return user;
  }

  async setActive(id: string, active: boolean, actorId: string) {
    await this.get(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { active },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    await this.audit(actorId, 'UPDATE_USER', id, { active });
    return user;
  }

  private audit(userId: string, action: string, entityId: string, metadata = {}) {
    return this.prisma.auditLog.create({
      data: { userId, action, entity: 'User', entityId, metadata },
    });
  }

  private isUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}