import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar horarios disponibles por fecha y PAX' })
  get(@Query() query: AvailabilityQueryDto) {
    return this.reservations.availability(query.date, query.pax);
  }
}