-- CreateEnum
CREATE TYPE "MediaMemberRole" AS ENUM ('LIDER', 'MEMBRO');

-- CreateEnum
CREATE TYPE "MediaMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MediaFunctionAssignmentStatus" AS ENUM ('EM_TREINAMENTO', 'HABILITADO', 'AVANCADO');

-- CreateEnum
CREATE TYPE "MediaInvitationStatus" AS ENUM ('INVITED', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "media_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MediaMemberRole" NOT NULL DEFAULT 'MEMBRO',
    "status" "MediaMemberStatus" NOT NULL DEFAULT 'INVITED',
    "phone" TEXT,
    "administrativeNotes" TEXT,
    "invitedByUserId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_functions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_member_functions" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "MediaFunctionAssignmentStatus" NOT NULL DEFAULT 'HABILITADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_member_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_availability_recurring" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_availability_recurring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_availability_exceptions" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_brand_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environmentName" TEXT NOT NULL DEFAULT 'MÍDIA ADESF',
    "logoUrl" TEXT,
    "logoLightUrl" TEXT,
    "logoDarkUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#16A34A',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0F766E',
    "gradientStart" TEXT NOT NULL DEFAULT '#16A34A',
    "gradientEnd" TEXT NOT NULL DEFAULT '#22D3A8',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_brand_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MediaMemberRole" NOT NULL DEFAULT 'MEMBRO',
    "invitedByUserId" TEXT NOT NULL,
    "status" "MediaInvitationStatus" NOT NULL DEFAULT 'INVITED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_members_userId_key" ON "media_members"("userId");

-- CreateIndex
CREATE INDEX "media_members_organizationId_status_idx" ON "media_members"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_functions_organizationId_name_key" ON "media_functions"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "media_member_functions_memberId_functionId_key" ON "media_member_functions"("memberId", "functionId");

-- Apenas uma função principal por membro (índice único parcial).
CREATE UNIQUE INDEX "media_member_functions_one_primary_per_member" ON "media_member_functions"("memberId") WHERE "isPrimary" = true;

-- CreateIndex
CREATE INDEX "media_availability_recurring_memberId_idx" ON "media_availability_recurring"("memberId");

-- CreateIndex
CREATE INDEX "media_availability_exceptions_memberId_date_idx" ON "media_availability_exceptions"("memberId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "media_brand_settings_organizationId_key" ON "media_brand_settings"("organizationId");

-- CreateIndex
CREATE INDEX "media_invitations_organizationId_email_idx" ON "media_invitations"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "media_members" ADD CONSTRAINT "media_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_members" ADD CONSTRAINT "media_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_functions" ADD CONSTRAINT "media_functions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_member_functions" ADD CONSTRAINT "media_member_functions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "media_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_member_functions" ADD CONSTRAINT "media_member_functions_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "media_functions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_availability_recurring" ADD CONSTRAINT "media_availability_recurring_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "media_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_availability_exceptions" ADD CONSTRAINT "media_availability_exceptions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "media_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_brand_settings" ADD CONSTRAINT "media_brand_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_invitations" ADD CONSTRAINT "media_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_invitations" ADD CONSTRAINT "media_invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
