-- CreateEnum
CREATE TYPE "GoalScenario" AS ENUM ('CONSERVADOR', 'REALISTA', 'AGRESSIVO');

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "scenario" "GoalScenario" NOT NULL DEFAULT 'REALISTA';

-- CreateIndex
CREATE UNIQUE INDEX "goals_organizationId_type_periodStart_periodEnd_scenario_key" ON "goals"("organizationId", "type", "periodStart", "periodEnd", "scenario");
