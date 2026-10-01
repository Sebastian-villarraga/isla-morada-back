import { Type } from 'class-transformer';
import { IsDateString, IsInt, Matches, Min } from 'class-validator';

export class AvailabilityQueryDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  pax!: number;
}