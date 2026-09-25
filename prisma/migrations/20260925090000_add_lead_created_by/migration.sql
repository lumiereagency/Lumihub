-- AlterTable
ALTER TABLE "leads" ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "leads_organizationId_createdByUserId_idx" ON "leads"("organizationId", "createdByUserId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: quem cadastrou cada lead já está registrado na trilha de auditoria.
UPDATE "leads" AS l
SET "createdByUserId" = a."userId"
FROM "audit_logs" AS a
WHERE a."entityType" = 'Lead'
  AND a."action" = 'LEAD_CREATED'
  AND a."entityId" = l."id"
  AND a."userId" IS NOT NULL
  AND l."createdByUserId" IS NULL;
