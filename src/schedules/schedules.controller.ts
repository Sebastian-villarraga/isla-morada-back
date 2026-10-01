import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ScheduleStatus, UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

type UserRequest = Request & { user: { userId: string } };

@ApiTags('schedules')
@ApiBearerAuth()
@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.RESERVAS)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  list(@Query('operatingDayId') dayId?: string, @Query('status') status?: ScheduleStatus) {
    return this.schedules.list(dayId, status);
  }

  @Post()
  create(@Body() dto: CreateScheduleDto, @Req() request: UserRequest) {
    return this.schedules.create(dto, request.user.userId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.schedules.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto, @Req() request: UserRequest) {
    return this.schedules.update(id, dto, request.user.userId);
  }

  @Patch(':id/open')
  open(@Param('id') id: string, @Req() request: UserRequest) {
    return this.schedules.setStatus(id, ScheduleStatus.OPEN, request.user.userId);
  }

  @Patch(':id/close')
  close(@Param('id') id: string, @Req() request: UserRequest) {
    return this.schedules.setStatus(id, ScheduleStatus.CLOSED, request.user.userId);
  }
}