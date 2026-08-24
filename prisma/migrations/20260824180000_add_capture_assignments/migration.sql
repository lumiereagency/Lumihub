-- CreateEnum
CREATE TYPE "CaptureAssignmentStatus" AS ENUM ('PENDENTE', 'ACEITO', 'RECUSADO');

-- CreateTable
CREATE TABLE "capture_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "captureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "CaptureAssignmentStatus" NOT NULL DEFAULT 'PENDENTE',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capture_assignments_userId_status_idx" ON "capture_assignments"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "capture_assignments_captureId_userId_role_key" ON "capture_assignments"("captureId", "userId", "role");

-- AddForeignKey
ALTER TABLE "capture_assignments" ADD CONSTRAINT "capture_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_assignments" ADD CONSTRAINT "capture_assignments_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "captures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_assignments" ADD CONSTRAINT "capture_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
