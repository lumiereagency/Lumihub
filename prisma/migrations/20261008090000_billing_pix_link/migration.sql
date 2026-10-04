
-- AlterTable
ALTER TABLE "accounts_receivable" ADD COLUMN     "proofSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "thanksSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pricing_settings" ADD COLUMN     "billingPixSeparate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "billingThanks" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_receivable_publicToken_key" ON "accounts_receivable"("publicToken");

