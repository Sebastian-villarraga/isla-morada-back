import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationStatus } from '@prisma/client';
import { createTransport } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import {
  availabilityEmail,
  reservationCancelledEmail,
  reservationConfirmationEmail,
  reservationUpdatedEmail,
  waitlistEmail,
} from './templates/email-templates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async sendReservationConfirmation(input: {
    notificationId: string; recipient: string; name: string; code: string; date: string; time: string; pax: number;
  }): Promise<NotificationStatus> {
    const settings = await this.prisma.restaurantSettings.findUnique({ where: { id: 'default' } });
    return this.deliver(input.notificationId, input.recipient, 'Confirmación de reserva · Isla Morada', reservationConfirmationEmail({
      ...input,
      restaurantName: settings?.restaurantName ?? 'Isla Morada',
    }));
  }

  sendReservationUpdate(notificationId: string, recipient: string, name: string, code: string) {
    return this.deliver(notificationId, recipient, 'Actualización de reserva · Isla Morada', reservationUpdatedEmail(name, code));
  }

  sendReservationCancellation(notificationId: string, recipient: string, name: string, code: string) {
    return this.deliver(notificationId, recipient, 'Cancelación de reserva · Isla Morada', reservationCancelledEmail(name, code));
  }

  sendAvailability(notificationId: string, recipient: string, name: string, code: string) {
    return this.deliver(notificationId, recipient, 'Disponibilidad · Isla Morada', availabilityEmail(name, code));
  }

  sendWaitlist(notificationId: string, recipient: string, name: string) {
    return this.deliver(notificationId, recipient, 'Disponibilidad · Isla Morada', waitlistEmail(name));
  }

  async retry(notificationId: string, actorId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { reservation: { include: { customer: true, schedule: true, operatingDay: true } }, waitlistEntry: true },
    });
    if (!notification) return;
    let delivery = notification.status;
    if (delivery !== NotificationStatus.SENT && notification.reservation) {
      const { reservation } = notification;
      const day = reservation.operatingDay.date.toISOString().slice(0, 10);
      if (notification.type === 'RESERVATION_CONFIRMATION') {
        delivery = await this.sendReservationConfirmation({
          notificationId, recipient: notification.recipient, name: reservation.customer.name,
          code: reservation.code, date: day, time: reservation.schedule.startTime, pax: reservation.pax,
        });
      } else if (notification.type === 'RESERVATION_CANCELLED') {
        delivery = await this.sendReservationCancellation(notificationId, notification.recipient, reservation.customer.name, reservation.code);
      } else if (notification.type === 'AVAILABILITY_NOTIFICATION') {
        delivery = await this.sendAvailability(notificationId, notification.recipient, reservation.customer.name, reservation.code);
      } else {
        delivery = await this.sendReservationUpdate(notificationId, notification.recipient, reservation.customer.name, reservation.code);
      }
    } else if (delivery !== NotificationStatus.SENT && notification.waitlistEntry) {
      delivery = await this.sendWaitlist(notificationId, notification.recipient, notification.waitlistEntry.name);
    } else if (!notification.waitlistEntry && !notification.reservation) {
      return;
    }
    if (delivery === NotificationStatus.SENT && notification.waitlistEntry) {
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.waitlistEntry.updateMany({
          where: { id: notification.waitlistEntry!.id, status: 'WAITING' },
          data: { status: 'NOTIFIED' },
        });
        if (changed.count) {
          await tx.auditLog.create({
            data: {
              userId: actorId,
              action: 'NOTIFY_WAITLIST',
              entity: 'WaitlistEntry',
              entityId: notification.waitlistEntry!.id,
              metadata: { notificationId, retry: true },
            },
          });
        }
      });
    }
    if (delivery === NotificationStatus.SENT && notification.reservation && notification.type === 'AVAILABILITY_NOTIFICATION') {
      await this.prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: notification.reservation!.id },
          data: { availabilitySentAt: notification.sentAt ?? new Date() },
        });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'NOTIFY_AVAILABILITY',
            entity: 'Reservation',
            entityId: notification.reservation!.id,
            metadata: { notificationId, retry: true },
          },
        });
      });
    }
  }

  private async deliver(notificationId: string, recipient: string, subject: string, html: string): Promise<NotificationStatus> {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASSWORD');
    if (!host || !user || !password) {
      await this.setStatus(notificationId, NotificationStatus.FAILED, 'SMTP no está configurado');
      return NotificationStatus.FAILED;
    }
    try {
      const transport = createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT', '587')),
        secure: Number(this.config.get<string>('SMTP_PORT', '587')) === 465,
        auth: { user, pass: password },
      });
      await transport.sendMail({ from: this.config.get<string>('SMTP_FROM'), to: recipient, subject, html });
      await this.setStatus(notificationId, NotificationStatus.SENT);
      return NotificationStatus.SENT;
    } catch (error) {
      this.logger.warn(`No se pudo enviar notificación ${notificationId}`);
      await this.setStatus(notificationId, NotificationStatus.FAILED, error instanceof Error ? error.message : 'Error SMTP desconocido');
      return NotificationStatus.FAILED;
    }
  }

  private setStatus(id: string, status: NotificationStatus, errorMessage?: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { status, errorMessage: errorMessage ?? null, sentAt: status === NotificationStatus.SENT ? new Date() : null },
    });
  }
}