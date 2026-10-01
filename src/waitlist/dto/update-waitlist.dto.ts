import { ApiPropertyOptional } from '@nestjs/swagger';
import { WaitlistStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdateWaitlistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  phone?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;

  @ApiPropertyOptional({ enum: WaitlistStatus })
  @IsOptional()
  @IsEnum(WaitlistStatus)
  status?: WaitlistStatus;
}