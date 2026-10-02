-- CreateEnum
CREATE TYPE "ProposalResponse" AS ENUM ('ACEITA', 'AJUSTE', 'RECUSADA');

-- CreateEnum
CREATE TYPE "ServiceBilling" AS ENUM ('MENSAL', 'PONTUAL');

-- CreateEnum
CREATE TYPE "CardPriceMode" AS ENUM ('AUTO', 'FIXED', 'NONE');

-- AlterEnum
ALTER TYPE "IntegrationProviderKey" ADD VALUE 'AUTENTIQUE';

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "proposalId" TEXT,
ADD COLUMN     "signatureDocumentId" TEXT,
ADD COLUMN     "signatureLink" TEXT,
ADD COLUMN     "signatureProvider" TEXT,
ADD COLUMN     "signatureSentAt" TIMESTAMP(3),
ADD COLUMN     "signatureSigners" JSONB,
ADD COLUMN     "signatureStatus" TEXT,
ADD COLUMN     "signedFileUrl" TEXT;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "chosenPayment" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "intro" TEXT,
ADD COLUMN     "lastViewedAt" TIMESTAMP(3),
ADD COLUMN     "maxInstallments" INTEGER,
ADD COLUMN     "minMonths" INTEGER,
ADD COLUMN     "monthlyTotal" DECIMAL(14,2),
ADD COLUMN     "oneTimeTotal" DECIMAL(14,2),
ADD COLUMN     "pricingSnapshot" JSONB,
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "recipientName" TEXT,
ADD COLUMN     "recipientPhone" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "response" "ProposalResponse",
ADD COLUMN     "responseMessage" TEXT,
ADD COLUMN     "signerData" JSONB,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "viewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "badge" TEXT,
ADD COLUMN     "billing" "ServiceBilling" NOT NULL DEFAULT 'PONTUAL',
ADD COLUMN     "cardMode" "CardPriceMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "cardPrice" DECIMAL(14,2),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "guideKey" TEXT,
ADD COLUMN     "isAddon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxInstallments" INTEGER,
ADD COLUMN     "minMonths" INTEGER,
ADD COLUMN     "monthlyFee" DECIMAL(14,2),
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priceIsFrom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "terms" TEXT;

-- CreateTable
CREATE TABLE "proposal_items" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "billing" "ServiceBilling" NOT NULL DEFAULT 'PONTUAL',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "monthlyFee" DECIMAL(14,2),
    "priceIsFrom" BOOLEAN NOT NULL DEFAULT false,
    "cardMode" "CardPriceMode" NOT NULL DEFAULT 'AUTO',
    "cardPrice" DECIMAL(14,2),
    "maxInstallments" INTEGER,
    "minMonths" INTEGER,
    "terms" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "proposal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "debitFee" DECIMAL(6,3) NOT NULL DEFAULT 0.94,
    "installmentFees" JSONB NOT NULL,
    "creditMargin" DECIMAL(6,3) NOT NULL DEFAULT 5,
    "maxInstallments" INTEGER NOT NULL DEFAULT 12,
    "validityDays" INTEGER NOT NULL DEFAULT 7,
    "pixKey" TEXT,
    "whatsappTemplate" TEXT,
    "contractTemplateMsg" TEXT,
    "companyLegalName" TEXT,
    "companyDocument" TEXT,
    "companyAddress" TEXT,
    "companyCity" TEXT,
    "representativeName" TEXT,
    "representativeEmail" TEXT,
    "representativeDoc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposal_items_proposalId_idx" ON "proposal_items"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_settings_organizationId_key" ON "pricing_settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_proposalId_key" ON "contracts"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_signatureDocumentId_key" ON "contracts"("signatureDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_publicToken_key" ON "proposals"("publicToken");

-- CreateIndex
CREATE INDEX "proposals_organizationId_status_idx" ON "proposals"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "services_organizationId_guideKey_key" ON "services"("organizationId", "guideKey");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_settings" ADD CONSTRAINT "pricing_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

