
-- AlterTable
ALTER TABLE "task_attachments" ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "coverAttachmentId" TEXT;

