-- AlterTable
ALTER TABLE "pricing_settings" ADD COLUMN     "quoteFollowUp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "quoteFollowUpSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "followUpPaused" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "proposal_follow_ups" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "sentAt" TIMESTAMP(3),
    "messageBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposal_follow_ups_proposalId_step_key" ON "proposal_follow_ups"("proposalId", "step");

-- AddForeignKey
ALTER TABLE "proposal_follow_ups" ADD CONSTRAINT "proposal_follow_ups_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

