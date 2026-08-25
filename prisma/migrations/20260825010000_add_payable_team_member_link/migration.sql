-- AlterTable
ALTER TABLE "accounts_payable" ADD COLUMN     "teamMemberId" TEXT;

-- CreateIndex
CREATE INDEX "accounts_payable_teamMemberId_idx" ON "accounts_payable"("teamMemberId");

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
