-- CreateEnum
CREATE TYPE "MediaActionTokenType" AS ENUM ('AVAILABILITY_REQUEST', 'SCHEDULE_CONFIRMATION', 'SWAP_ACCEPT');

-- AlterTable: eventId vira opcional (agora só AVAILABILITY_REQUEST usa),
-- e ganha type + scheduleId + swapRequestId. Linhas existentes são todas
-- AVAILABILITY_REQUEST (única variante que já existia).
ALTER TABLE "media_action_tokens"
  ADD COLUMN "type" "MediaActionTokenType" NOT NULL DEFAULT 'AVAILABILITY_REQUEST',
  ADD COLUMN "scheduleId" TEXT,
  ADD COLUMN "swapRequestId" TEXT,
  ALTER COLUMN "eventId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "media_action_tokens_scheduleId_memberId_idx" ON "media_action_tokens"("scheduleId", "memberId");

-- AddForeignKey
ALTER TABLE "media_action_tokens" ADD CONSTRAINT "media_action_tokens_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "media_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_action_tokens" ADD CONSTRAINT "media_action_tokens_swapRequestId_fkey" FOREIGN KEY ("swapRequestId") REFERENCES "media_swap_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
