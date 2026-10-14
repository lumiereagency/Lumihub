-- AlterEnum
ALTER TYPE "IntegrationCategory" ADD VALUE 'REDES_SOCIAIS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationProviderKey" ADD VALUE 'META_SOCIAL';
ALTER TYPE "IntegrationProviderKey" ADD VALUE 'YOUTUBE_PUBLISH';
ALTER TYPE "IntegrationProviderKey" ADD VALUE 'TIKTOK_SOCIAL';

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "statusMessage" TEXT,
    "tokenEnc" BYTEA NOT NULL,
    "tokenIv" BYTEA NOT NULL,
    "tokenTag" BYTEA NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "meta" JSONB,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_connect_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payloadEnc" BYTEA NOT NULL,
    "payloadIv" BYTEA NOT NULL,
    "payloadTag" BYTEA NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_connect_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_post_targets" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "caption" TEXT,
    "options" JSONB,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGENDADO',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_post_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_accounts_organizationId_clientId_idx" ON "social_accounts"("organizationId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_clientId_network_externalId_key" ON "social_accounts"("clientId", "network", "externalId");

-- CreateIndex
CREATE INDEX "social_connect_sessions_expiresAt_idx" ON "social_connect_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "content_post_targets_status_scheduledFor_idx" ON "content_post_targets"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "content_post_targets_postId_accountId_key" ON "content_post_targets"("postId", "accountId");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_post_targets" ADD CONSTRAINT "content_post_targets_postId_fkey" FOREIGN KEY ("postId") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_post_targets" ADD CONSTRAINT "content_post_targets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

