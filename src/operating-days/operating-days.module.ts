import { Module } from '@nestjs/common';
import { OperatingDaysController } from './operating-days.controller';
import { OperatingDaysService } from './operating-days.service';

@Module({ controllers: [OperatingDaysController], providers: [OperatingDaysService], exports: [OperatingDaysService] })
export class OperatingDaysModule {}
