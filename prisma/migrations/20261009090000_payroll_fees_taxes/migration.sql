
-- AlterTable
ALTER TABLE "accounts_payable" ADD COLUMN     "breakdown" JSONB,
ADD COLUMN     "competence" TEXT,
ADD COLUMN     "kind" TEXT;

-- AlterTable
ALTER TABLE "capture_assignments" ADD COLUMN     "fee" DECIMAL(14,2),
ADD COLUMN     "payableId" TEXT;

-- AlterTable
ALTER TABLE "commissions" ADD COLUMN     "payableId" TEXT;

-- AlterTable
ALTER TABLE "pricing_settings" ADD COLUMN     "captureFeeShared" DECIMAL(10,2) NOT NULL DEFAULT 50,
ADD COLUMN     "captureFeeSolo" DECIMAL(10,2) NOT NULL DEFAULT 100,
ADD COLUMN     "taxDueDay" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "taxRate" DECIMAL(6,3) NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "paymentDayMode" TEXT NOT NULL DEFAULT 'FIXED';

-- CreateIndex
CREATE INDEX "accounts_payable_organizationId_kind_competence_idx" ON "accounts_payable"("organizationId", "kind", "competence");

