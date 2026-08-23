-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "movementId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "investments_movementId_key" ON "investments"("movementId");

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "financial_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

