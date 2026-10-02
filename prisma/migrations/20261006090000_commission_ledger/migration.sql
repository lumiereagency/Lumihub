-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('AGUARDANDO_CLIENTE', 'A_PAGAR', 'PAGA', 'CANCELADA');

-- AlterTable
ALTER TABLE "proposal_items" ADD COLUMN     "commissionSplit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "commissionSplit" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "sellerUserId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'INTEGRAL',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "breakdown" JSONB,
    "status" "CommissionStatus" NOT NULL DEFAULT 'AGUARDANDO_CLIENTE',
    "releasedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidByUserId" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commissions_organizationId_status_idx" ON "commissions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "commissions_sellerUserId_status_idx" ON "commissions"("sellerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_proposalId_stage_key" ON "commissions"("proposalId", "stage");

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

