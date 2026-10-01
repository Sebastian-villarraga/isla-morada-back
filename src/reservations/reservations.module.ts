import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AvailabilityController } from './availability.controller';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ReservationsController, AvailabilityController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}