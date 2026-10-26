import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PublicRateLimitMiddleware } from './common/public-rate-limit.middleware';
import { OperatingDaysModule } from './operating-days/operating-days.module';
import { SchedulesModule } from './schedules/schedules.module';
import { SettingsModule } from './settings/settings.module';
import { ReservationsModule } from './reservations/reservations.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CustomersModule } from './customers/customers.module';
import { MenuModule } from './menu/menu.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    MenuModule,
    EventsModule,
    OperatingDaysModule,
    SchedulesModule,
    SettingsModule,
    ReservationsModule,
    WaitlistModule,
    AuditModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PublicRateLimitMiddleware).forRoutes(
      { path: 'availability', method: RequestMethod.GET },
      { path: 'availability/dates', method: RequestMethod.GET },
      { path: 'reservations', method: RequestMethod.POST },
      { path: 'auth/login', method: RequestMethod.POST },
    );
  }
}
