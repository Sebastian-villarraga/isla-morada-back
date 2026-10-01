import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    const valid = user?.active ? await compare(password, user.passwordHash) : false;

    await this.prisma.auditLog.create({
      data: {
        userId: valid && user ? user.id : null,
        action: valid ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
        entity: 'User',
        entityId: valid && user ? user.id : null,
        metadata: { email: normalizedEmail },
      },
    });

    if (!valid || !user) throw new UnauthorizedException('Credenciales inválidas');
    const payload = { sub: user.id, userId: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    if (!user?.active) throw new UnauthorizedException();
    return user;
  }
}