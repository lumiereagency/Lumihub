-- AlterTable
ALTER TABLE "proposal_items" ADD COLUMN     "commissionFixed" DECIMAL(14,2),
ADD COLUMN     "commissionPercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "commissionFixed" DECIMAL(14,2),
ADD COLUMN     "commissionPercent" DECIMAL(5,2);

