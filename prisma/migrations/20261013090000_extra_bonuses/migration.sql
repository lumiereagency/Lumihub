-- CreateTable
CREATE TABLE "extra_bonuses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL,
    "endCompetence" TEXT,
    "clientName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extra_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extra_bonus_entries" (
    "id" TEXT NOT NULL,
    "bonusId" TEXT NOT NULL,
    "competence" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extra_bonus_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extra_bonuses_organizationId_kind_idx" ON "extra_bonuses"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "extra_bonus_entries_payableId_idx" ON "extra_bonus_entries"("payableId");

-- CreateIndex
CREATE UNIQUE INDEX "extra_bonus_entries_bonusId_competence_key" ON "extra_bonus_entries"("bonusId", "competence");

-- AddForeignKey
ALTER TABLE "extra_bonuses" ADD CONSTRAINT "extra_bonuses_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_bonus_entries" ADD CONSTRAINT "extra_bonus_entries_bonusId_fkey" FOREIGN KEY ("bonusId") REFERENCES "extra_bonuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

