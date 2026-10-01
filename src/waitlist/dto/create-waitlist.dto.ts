import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class CreateWaitlistDto {
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

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  pax!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceReservationId?: string;
}