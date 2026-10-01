import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsInt, IsOptional, IsString, IsUUID, Matches, Min, MaxLength } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  phone!: string;

  @ApiProperty({ example: '2026-10-03' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty()
  @IsUUID()
  scheduleId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  pax!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;
}