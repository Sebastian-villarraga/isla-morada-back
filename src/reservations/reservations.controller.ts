import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { MarkLostDto } from './dto/mark-lost.dto';
import { ReservationFiltersDto } from './dto/reservation-filters.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsService } from './reservations.service';

type UserRequest = Request & { user: { userId: string } };

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservations.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RESERVAS, UserRole.HOST)
  list(@Query() filters: ReservationFiltersDto) {
    return this.reservations.list(filters);
  }

  @Get('today')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RESERVAS, UserRole.HOST)
  today(@Query('search') search?: string) {
    return this.reservations.today(search);
  }

  @Get(':id/internal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RESERVAS, UserRole.HOST)
  getInternal(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.getInternal(id);
  }

  @Get(':id')
  getPublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.getPublic(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RESERVAS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReservationDto, @Req() request: UserRequest) {
    return this.reservations.update(id, dto, request.user.userId);
  }

  @Patch(':id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RESERVAS)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() request: UserRequest) {
    return this.reservations.cancel(id, request.user.userId);
  }

  @Post(':id/arrival')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RESERVAS, UserRole.HOST)
  arrival(@Param('id', ParseUUIDPipe) id: string, @Req() request: UserRequest) {
    return this.reservations.arrival(id, request.user.userId);
  }

  @Post(':id/entry')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RESERVAS, UserRole.HOST)
  entry(@Param('id', ParseUUIDPipe) id: string, @Req() request: UserRequest) {
    return this.reservations.entry(id, request.user.userId);
  }

  @Post(':id/lost')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RESERVAS, UserRole.HOST)
  lost(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkLostDto, @Req() request: UserRequest) {
    return this.reservations.lost(id, dto, request.user.userId);
  }

  @Post(':id/notify-availability')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RESERVAS, UserRole.HOST)
  notifyAvailability(@Param('id', ParseUUIDPipe) id: string, @Req() request: UserRequest) {
    return this.reservations.notifyAvailability(id, request.user.userId);
  }
}