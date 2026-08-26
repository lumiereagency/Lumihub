-- CreateTable
CREATE TABLE "media_event_recurrence_requirements" (
    "id" TEXT NOT NULL,
    "recurrenceId" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "requiredQuantity" INTEGER NOT NULL DEFAULT 1,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_event_recurrence_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_event_recurrence_requirements_recurrenceId_functionI_key" ON "media_event_recurrence_requirements"("recurrenceId", "functionId");

-- AddForeignKey
ALTER TABLE "media_event_recurrence_requirements" ADD CONSTRAINT "media_event_recurrence_requirements_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "media_event_recurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_event_recurrence_requirements" ADD CONSTRAINT "media_event_recurrence_requirements_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "media_functions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
