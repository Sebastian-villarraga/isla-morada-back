import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class MarkLostDto {
  @ApiProperty({ example: '2026-10-03T12:32:00-05:00' })
  @IsDateString()
  arrivalTime!: string;

  @ApiProperty()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;
}