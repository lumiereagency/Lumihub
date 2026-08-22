-- AlterTable
ALTER TABLE "payment_reminders" ADD COLUMN     "messageTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_messageTemplateId_fkey" FOREIGN KEY ("messageTemplateId") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
