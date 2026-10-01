import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty()
  @IsUUID()
  operatingDayId!: string;

  @ApiProperty({ example: '12:30' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ enum: ScheduleStatus })
  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;
}