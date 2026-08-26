-- AlterTable
ALTER TABLE "media_swap_requests" ADD COLUMN "autoSuggested" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "media_swap_requests_status_autoSuggested_requestedAt_idx" ON "media_swap_requests"("status", "autoSuggested", "requestedAt");
