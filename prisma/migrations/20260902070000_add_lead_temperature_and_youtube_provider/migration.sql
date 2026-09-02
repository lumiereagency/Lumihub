-- AlterEnum
ALTER TYPE "IntegrationProviderKey" ADD VALUE 'YOUTUBE_DATA_API';

-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('QUENTE', 'MORNO', 'FRIO');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "temperature" "LeadTemperature";
