import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { IsBoolean } from 'class-validator';

type UserRequest = Request & { user: { userId: string } };

class UserStatusDto {
  @IsBoolean()
  active!: boolean;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() { return this.users.list(); }

  @Post()
  create(@Body() dto: CreateUserDto, @Req() request: UserRequest) {
    return this.users.create(dto, request.user.userId);
  }

  @Get(':id')
  get(@Param('id') id: string) { return this.users.get(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() request: UserRequest) {
    return this.users.update(id, dto, request.user.userId);
  }

  @Patch(':id/status')
  setActive(@Param('id') id: string, @Body() dto: UserStatusDto, @Req() request: UserRequest) {
    return this.users.setActive(id, dto.active, request.user.userId);
  }
}