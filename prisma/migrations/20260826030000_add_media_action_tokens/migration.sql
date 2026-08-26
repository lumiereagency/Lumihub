-- CreateTable
CREATE TABLE "media_action_tokens" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_action_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_action_tokens_tokenHash_key" ON "media_action_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "media_action_tokens_organizationId_memberId_idx" ON "media_action_tokens"("organizationId", "memberId");

-- AddForeignKey
ALTER TABLE "media_action_tokens" ADD CONSTRAINT "media_action_tokens_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_action_tokens" ADD CONSTRAINT "media_action_tokens_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "media_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_action_tokens" ADD CONSTRAINT "media_action_tokens_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "media_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
