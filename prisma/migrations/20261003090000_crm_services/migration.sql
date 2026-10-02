-- AlterTable
ALTER TABLE "services" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "lead_service_interests" (
    "leadId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "lead_service_interests_pkey" PRIMARY KEY ("leadId","serviceId")
);

-- CreateTable
CREATE TABLE "client_services" (
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_services_pkey" PRIMARY KEY ("clientId","serviceId")
);

-- CreateIndex
CREATE INDEX "services_organizationId_idx" ON "services"("organizationId");

-- AddForeignKey
ALTER TABLE "lead_service_interests" ADD CONSTRAINT "lead_service_interests_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_service_interests" ADD CONSTRAINT "lead_service_interests_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
