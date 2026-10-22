import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OperatingDaysService } from '../operating-days/operating-days.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AvailableDaysQueryDto } from '../operating-days/dto/available-days-query.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly operatingDays: OperatingDaysService,
  ) {}

  @Get('dates')
  @ApiOperation({ summary: 'Listar fechas OPEN desde hoy en America/Bogota' })
  @ApiResponse({
    status: 200,
    description: 'Fechas operativas abiertas desde hoy, ordenadas ascendentemente.',
    schema: { type: 'array', items: { type: 'string', format: 'date', example: '2026-10-03' } },
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  dates(@Query() query: AvailableDaysQueryDto): Promise<string[]> {
    return this.operatingDays.publicDates(query.from, query.to);
  }

  @Get()
  @ApiOperation({ summary: 'Consultar horarios disponibles por fecha y PAX' })
  @ApiResponse({
    status: 200,
    description: 'Horarios abiertos con capacidad suficiente; no contiene datos de clientes.',
    schema: {
      type: 'object',
      properties: {
        date: { type: 'string', format: 'date', example: '2026-10-03' },
        schedules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              startTime: { type: 'string', example: '12:30' },
              capacity: { type: 'integer', example: 200 },
              reservedPax: { type: 'integer', example: 150 },
              availablePax: { type: 'integer', example: 50 },
              status: { type: 'string', enum: ['OPEN'] },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Fecha o cantidad de personas inválida.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  get(@Query() query: AvailabilityQueryDto) {
    return this.reservations.availability(query.date, query.pax);
  }
}
