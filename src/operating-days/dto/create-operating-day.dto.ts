import { ApiProperty } from '@nestjs/swagger';
import { OperatingDayStatus } from '@prisma/client';
import { IsDateString, IsEnum, Matches } from 'class-validator';

export class CreateOperatingDayDto {
  @ApiProperty({ example: '2026-10-03' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({ example: 'A' })
  @Matches(/^[A-Z]{1,4}$/)
  prefix!: string;

  @ApiProperty({ enum: OperatingDayStatus, default: OperatingDayStatus.OPEN })
  @IsEnum(OperatingDayStatus)
  status: OperatingDayStatus = OperatingDayStatus.OPEN;
}