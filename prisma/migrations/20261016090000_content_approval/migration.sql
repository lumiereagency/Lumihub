-- CreateTable
CREATE TABLE "content_batches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_posts" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "network" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "media" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "version" INTEGER NOT NULL DEFAULT 1,
    "feedback" TEXT,
    "feedbackAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_post_events" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_post_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_batches_publicToken_key" ON "content_batches"("publicToken");

-- CreateIndex
CREATE INDEX "content_batches_organizationId_clientId_idx" ON "content_batches"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "content_posts_batchId_status_idx" ON "content_posts"("batchId", "status");

-- CreateIndex
CREATE INDEX "content_post_events_postId_idx" ON "content_post_events"("postId");

-- AddForeignKey
ALTER TABLE "content_batches" ADD CONSTRAINT "content_batches_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "content_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_post_events" ADD CONSTRAINT "content_post_events_postId_fkey" FOREIGN KEY ("postId") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

