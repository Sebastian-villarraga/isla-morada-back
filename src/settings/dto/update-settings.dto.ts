import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restaurantName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  restaurantEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restaurantPhone?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 240 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  reservationToleranceMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  defaultScheduleCapacity?: number;
}