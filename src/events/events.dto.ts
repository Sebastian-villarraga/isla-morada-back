import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class CreateEventRequestDto { @IsString() @MaxLength(120) name!: string; @IsEmail() email!: string; @IsString() @MaxLength(30) phone!: string; @IsString() @MaxLength(100) eventType!: string; @IsOptional() @IsDateString() eventDate?: string; @Type(() => Number) @IsInt() @Min(1) guests!: number; @IsOptional() @Type(() => Number) @IsInt() @Min(0) budget?: number; @IsOptional() @IsString() @MaxLength(2000) notes?: string; }
