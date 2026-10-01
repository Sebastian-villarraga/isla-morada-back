import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OperatingDayStatus, UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateOperatingDayDto } from './dto/create-operating-day.dto';
import { UpdateOperatingDayDto } from './dto/update-operating-day.dto';
import { OperatingDaysService } from './operating-days.service';

type UserRequest = Request & { user: { userId: string } };

@ApiTags('operating-days')
@ApiBearerAuth()
@Controller('operating-days')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.RESERVAS)
export class OperatingDaysController {
  constructor(private readonly days: OperatingDaysService) {}

  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string, @Query('status') status?: OperatingDayStatus) {
    return this.days.list(from, to, status);
  }

  @Post()
  create(@Body() dto: CreateOperatingDayDto, @Req() request: UserRequest) {
    return this.days.create(dto, request.user.userId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.days.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOperatingDayDto, @Req() request: UserRequest) {
    return this.days.update(id, dto, request.user.userId);
  }
}