-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RESERVAS', 'HOST');

-- CreateEnum
CREATE TYPE "OperatingDayStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'ARRIVED', 'ENTERED', 'LOST');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'NOTIFIED', 'ARRIVED', 'ENTERED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RESERVATION_CONFIRMATION', 'RESERVATION_UPDATED', 'RESERVATION_CANCELLED', 'AVAILABILITY_NOTIFICATION', 'WAITLIST_NOTIFICATION');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingDay" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "prefix" VARCHAR(1) NOT NULL,
    "reservationSequence" INTEGER NOT NULL DEFAULT 0,
    "status" "OperatingDayStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" UUID NOT NULL,
    "operatingDayId" UUID NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "customerId" UUID NOT NULL,
    "operatingDayId" UUID NOT NULL,
    "codeOperatingDayId" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "createdById" UUID,
    "pax" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "observations" VARCHAR(2000),
    "lostArrivalTime" TIMESTAMPTZ(3),
    "lostContactPhone" VARCHAR(30),
    "lostReason" VARCHAR(1000),
    "lostAt" TIMESTAMPTZ(3),
    "lostById" UUID,
    "availabilitySentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationStatusHistory" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "previousStatus" "ReservationStatus",
    "newStatus" "ReservationStatus" NOT NULL,
    "changedById" UUID,
    "reason" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arrival" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "arrivalTime" TIMESTAMPTZ(3) NOT NULL,
    "entryTime" TIMESTAMPTZ(3),
    "registeredById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Arrival_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "pax" INTEGER NOT NULL,
    "arrivalTime" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "observations" VARCHAR(2000),
    "sourceReservationId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "reservationId" UUID,
    "waitlistEntryId" UUID,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "recipient" VARCHAR(254) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" VARCHAR(2000),
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(80),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "restaurantName" VARCHAR(120) NOT NULL DEFAULT 'Isla Morada',
    "restaurantEmail" VARCHAR(254) NOT NULL DEFAULT '',
    "restaurantPhone" VARCHAR(30) NOT NULL DEFAULT '',
    "reservationToleranceMinutes" INTEGER NOT NULL DEFAULT 25,
    "defaultScheduleCapacity" INTEGER NOT NULL DEFAULT 200,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingDay_date_key" ON "OperatingDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingDay_prefix_key" ON "OperatingDay"("prefix");

-- CreateIndex
CREATE INDEX "Schedule_operatingDayId_status_idx" ON "Schedule"("operatingDayId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_operatingDayId_startTime_key" ON "Schedule"("operatingDayId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_code_key" ON "Reservation"("code");

-- CreateIndex
CREATE INDEX "Reservation_scheduleId_status_idx" ON "Reservation"("scheduleId", "status");

-- CreateIndex
CREATE INDEX "Reservation_operatingDayId_status_idx" ON "Reservation"("operatingDayId", "status");

-- CreateIndex
CREATE INDEX "Reservation_customerId_idx" ON "Reservation"("customerId");

-- CreateIndex
CREATE INDEX "Reservation_createdAt_idx" ON "Reservation"("createdAt");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_codeOperatingDayId_sequenceNumber_key" ON "Reservation"("codeOperatingDayId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "ReservationStatusHistory_reservationId_createdAt_idx" ON "ReservationStatusHistory"("reservationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Arrival_reservationId_key" ON "Arrival"("reservationId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_arrivalTime_idx" ON "WaitlistEntry"("status", "arrivalTime");

-- CreateIndex
CREATE INDEX "WaitlistEntry_phone_idx" ON "WaitlistEntry"("phone");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_operatingDayId_fkey" FOREIGN KEY ("operatingDayId") REFERENCES "OperatingDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_operatingDayId_fkey" FOREIGN KEY ("operatingDayId") REFERENCES "OperatingDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_codeOperatingDayId_fkey" FOREIGN KEY ("codeOperatingDayId") REFERENCES "OperatingDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_lostById_fkey" FOREIGN KEY ("lostById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationStatusHistory" ADD CONSTRAINT "ReservationStatusHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationStatusHistory" ADD CONSTRAINT "ReservationStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrival" ADD CONSTRAINT "Arrival_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrival" ADD CONSTRAINT "Arrival_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_sourceReservationId_fkey" FOREIGN KEY ("sourceReservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
