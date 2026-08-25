-- AlterEnum
ALTER TYPE "CalendarEventType" ADD VALUE 'MIDIA';

-- CreateEnum
CREATE TYPE "MediaEventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaRecurrenceFrequency" AS ENUM ('WEEKLY');

-- CreateEnum
CREATE TYPE "MediaScheduleStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaAssignmentStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'CONFIRMED', 'SWAP_PENDING', 'COMPLETED', 'ABSENT');

-- CreateEnum
CREATE TYPE "MediaSwapStatus" AS ENUM ('PENDING_TARGET', 'TARGET_ACCEPTED', 'TARGET_REJECTED', 'PENDING_LEADER', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MediaConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MediaCheckinStatus" AS ENUM ('PENDING', 'CHECKED_IN', 'NO_SHOW');

-- CreateTable
CREATE TABLE "media_event_recurrences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "MediaRecurrenceFrequency" NOT NULL DEFAULT 'WEEKLY',
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "location" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Culto',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_event_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Culto',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "description" TEXT,
    "administrativeNotes" TEXT,
    "status" "MediaEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "recurrenceId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_event_requirements" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "requiredQuantity" INTEGER NOT NULL DEFAULT 1,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_event_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_event_default_requirements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "requiredQuantity" INTEGER NOT NULL DEFAULT 1,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_event_default_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_schedules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "MediaScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_schedule_assignments" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL DEFAULT 0,
    "memberId" TEXT,
    "status" "MediaAssignmentStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_swap_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "requestedByMemberId" TEXT NOT NULL,
    "targetMemberId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "MediaSwapStatus" NOT NULL DEFAULT 'PENDING_TARGET',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetRespondedAt" TIMESTAMP(3),
    "leaderRespondedAt" TIMESTAMP(3),
    "leaderUserId" TEXT,
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_attendances" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "confirmationStatus" "MediaConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "checkinStatus" "MediaCheckinStatus" NOT NULL DEFAULT 'PENDING',
    "checkedInAt" TIMESTAMP(3),
    "markedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_operations_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "confirmationLeadHours" INTEGER NOT NULL DEFAULT 72,
    "reminderLeadHours" INTEGER NOT NULL DEFAULT 24,
    "leaderAlertLeadHours" INTEGER NOT NULL DEFAULT 48,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_operations_settings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN "mediaEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_mediaEventId_key" ON "calendar_events"("mediaEventId");

-- CreateIndex
CREATE INDEX "media_event_recurrences_organizationId_active_idx" ON "media_event_recurrences"("organizationId", "active");

-- CreateIndex
CREATE INDEX "media_events_organizationId_startAt_idx" ON "media_events"("organizationId", "startAt");

-- CreateIndex
CREATE INDEX "media_events_recurrenceId_idx" ON "media_events"("recurrenceId");

-- CreateIndex
CREATE UNIQUE INDEX "media_event_requirements_eventId_functionId_key" ON "media_event_requirements"("eventId", "functionId");

-- CreateIndex
CREATE UNIQUE INDEX "media_event_default_requirements_organizationId_functionId_key" ON "media_event_default_requirements"("organizationId", "functionId");

-- CreateIndex
CREATE UNIQUE INDEX "media_schedules_organizationId_month_year_key" ON "media_schedules"("organizationId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "media_schedule_assignments_scheduleId_eventId_functionId_s_key" ON "media_schedule_assignments"("scheduleId", "eventId", "functionId", "slotIndex");

-- CreateIndex
CREATE INDEX "media_schedule_assignments_memberId_idx" ON "media_schedule_assignments"("memberId");

-- CreateIndex
CREATE INDEX "media_schedule_assignments_eventId_idx" ON "media_schedule_assignments"("eventId");

-- CreateIndex
CREATE INDEX "media_schedule_assignments_status_idx" ON "media_schedule_assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "media_attendances_assignmentId_key" ON "media_attendances"("assignmentId");

-- CreateIndex
CREATE INDEX "media_attendances_memberId_idx" ON "media_attendances"("memberId");

-- CreateIndex
CREATE INDEX "media_swap_requests_assignmentId_idx" ON "media_swap_requests"("assignmentId");

-- CreateIndex
CREATE INDEX "media_swap_requests_organizationId_status_idx" ON "media_swap_requests"("organizationId", "status");

-- CreateIndex
CREATE INDEX "media_swap_requests_targetMemberId_idx" ON "media_swap_requests"("targetMemberId");

-- CreateIndex
CREATE INDEX "media_swap_requests_requestedByMemberId_idx" ON "media_swap_requests"("requestedByMemberId");

-- Apenas uma troca "ativa" por atribuição por vez (§48/§92) — índice único
-- parcial, já que múltiplas trocas recusadas/canceladas/expiradas para a
-- mesma atribuição são permitidas (histórico), só não simultaneamente ativas.
CREATE UNIQUE INDEX "media_swap_requests_one_active_per_assignment" ON "media_swap_requests"("assignmentId")
    WHERE "status" IN ('PENDING_TARGET', 'TARGET_ACCEPTED', 'PENDING_LEADER');

-- CreateIndex
CREATE UNIQUE INDEX "media_operations_settings_organizationId_key" ON "media_operations_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_mediaEventId_fkey" FOREIGN KEY ("mediaEventId") REFERENCES "media_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_event_recurrences" ADD CONSTRAINT "media_event_recurrences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_events" ADD CONSTRAINT "media_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_events" ADD CONSTRAINT "media_events_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "media_event_recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "media_events" ADD CONSTRAINT "media_events_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_event_requirements" ADD CONSTRAINT "media_event_requirements_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "media_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_event_requirements" ADD CONSTRAINT "media_event_requirements_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "media_functions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_event_default_requirements" ADD CONSTRAINT "media_event_default_requirements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_event_default_requirements" ADD CONSTRAINT "media_event_default_requirements_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "media_functions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_schedules" ADD CONSTRAINT "media_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_schedules" ADD CONSTRAINT "media_schedules_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "media_schedules" ADD CONSTRAINT "media_schedules_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_schedule_assignments" ADD CONSTRAINT "media_schedule_assignments_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "media_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_schedule_assignments" ADD CONSTRAINT "media_schedule_assignments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "media_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_schedule_assignments" ADD CONSTRAINT "media_schedule_assignments_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "media_functions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_schedule_assignments" ADD CONSTRAINT "media_schedule_assignments_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "media_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "media_schedule_assignments" ADD CONSTRAINT "media_schedule_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_swap_requests" ADD CONSTRAINT "media_swap_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_swap_requests" ADD CONSTRAINT "media_swap_requests_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "media_schedule_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_swap_requests" ADD CONSTRAINT "media_swap_requests_requestedByMemberId_fkey" FOREIGN KEY ("requestedByMemberId") REFERENCES "media_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_swap_requests" ADD CONSTRAINT "media_swap_requests_targetMemberId_fkey" FOREIGN KEY ("targetMemberId") REFERENCES "media_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_swap_requests" ADD CONSTRAINT "media_swap_requests_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_attendances" ADD CONSTRAINT "media_attendances_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "media_schedule_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_attendances" ADD CONSTRAINT "media_attendances_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "media_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_attendances" ADD CONSTRAINT "media_attendances_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_operations_settings" ADD CONSTRAINT "media_operations_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
