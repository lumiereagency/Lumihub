-- CreateTable
CREATE TABLE "media_public_schedule_links" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_public_schedule_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_public_schedule_links_organizationId_key" ON "media_public_schedule_links"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "media_public_schedule_links_token_key" ON "media_public_schedule_links"("token");

-- AddForeignKey
ALTER TABLE "media_public_schedule_links" ADD CONSTRAINT "media_public_schedule_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
