import { PartialType } from '@nestjs/swagger';
import { CreateOperatingDayDto } from './create-operating-day.dto';

export class UpdateOperatingDayDto extends PartialType(CreateOperatingDayDto) {}