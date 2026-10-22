import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class MenuItemDto {
  @IsString() @MaxLength(160) name!: string;
  @IsString() @MaxLength(100) category!: string;
  @Type(() => Number) @IsInt() @Min(0) price!: number;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUrl() @MaxLength(2048) imageUrl?: string;
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}
