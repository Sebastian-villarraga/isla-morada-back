import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export class AvailableDaysQueryDto {
  @ApiPropertyOptional({ example: '2026-10-03', description: 'Fecha inicial inclusiva; por defecto hoy en America/Bogota' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fecha final inclusiva' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}