-- AlterEnum
ALTER TYPE "AlertCategory" ADD VALUE 'MIDIA_ADESF';

-- AlterTable
ALTER TABLE "media_schedule_assignments" ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "media_operations_settings"
  ADD COLUMN "aiWeightWorkload" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "aiWeightRecency" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "aiWeightPreference" INTEGER NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "media_ai_generation_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "suggestionsCount" INTEGER NOT NULL DEFAULT 0,
    "filledCount" INTEGER NOT NULL DEFAULT 0,
    "weightsSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_ai_generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_ai_suggestions" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "assignmentId" TEXT,
    "suggestedMemberId" TEXT,
    "score" DOUBLE PRECISION,
    "justification" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_ai_generation_runs_organizationId_scheduleId_idx" ON "media_ai_generation_runs"("organizationId", "scheduleId");

-- CreateIndex
CREATE INDEX "media_ai_suggestions_runId_idx" ON "media_ai_suggestions"("runId");

-- AddForeignKey
ALTER TABLE "media_ai_generation_runs" ADD CONSTRAINT "media_ai_generation_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_ai_generation_runs" ADD CONSTRAINT "media_ai_generation_runs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "media_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_ai_generation_runs" ADD CONSTRAINT "media_ai_generation_runs_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_ai_suggestions" ADD CONSTRAINT "media_ai_suggestions_runId_fkey" FOREIGN KEY ("runId") REFERENCES "media_ai_generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_ai_suggestions" ADD CONSTRAINT "media_ai_suggestions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "media_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_ai_suggestions" ADD CONSTRAINT "media_ai_suggestions_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "media_functions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_ai_suggestions" ADD CONSTRAINT "media_ai_suggestions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "media_schedule_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "media_ai_suggestions" ADD CONSTRAINT "media_ai_suggestions_suggestedMemberId_fkey" FOREIGN KEY ("suggestedMemberId") REFERENCES "media_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
