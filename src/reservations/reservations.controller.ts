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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Crear una reserva pública con capacidad verificada transaccionalmente' })
  @ApiResponse({
    status: 201,
    description: 'Reserva confirmada. El código lo genera el backend.',
    schema: {
      type: 'object',
      required: ['id', 'code', 'status', 'pax', 'date', 'startTime'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        code: { type: 'string', example: 'A27' },
        status: { type: 'string', enum: ['CONFIRMED'] },
        pax: { type: 'integer', example: 4 },
        date: { type: 'string', format: 'date', example: '2026-10-03' },
        startTime: { type: 'string', example: '12:30' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'El body o sus campos no son válidos.' })
  @ApiResponse({ status: 404, description: 'La fecha no es operativa o el horario no pertenece a ella.' })
  @ApiResponse({ status: 409, description: 'Día/horario cerrado o capacidad agotada. `SCHEDULE_CAPACITY_EXCEEDED`.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
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
  @ApiOperation({ summary: 'Consultar una confirmación con campos públicos mínimos' })
  @ApiResponse({
    status: 200,
    description: 'No incluye teléfono, email, nombre, observaciones, datos internos ni historial.',
    schema: {
      type: 'object',
      required: ['id', 'code', 'status', 'pax', 'date', 'startTime'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        code: { type: 'string', example: 'A27' },
        status: { type: 'string', example: 'CONFIRMED' },
        pax: { type: 'integer', example: 4 },
        date: { type: 'string', format: 'date', example: '2026-10-03' },
        startTime: { type: 'string', example: '12:30' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'El ID no es un UUID válido.' })
  @ApiResponse({ status: 404, description: 'Reserva no encontrada.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
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