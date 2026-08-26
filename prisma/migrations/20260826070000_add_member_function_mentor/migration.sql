-- AlterTable
ALTER TABLE "media_member_functions" ADD COLUMN "mentorMemberId" TEXT;

-- AddForeignKey
ALTER TABLE "media_member_functions" ADD CONSTRAINT "media_member_functions_mentorMemberId_fkey" FOREIGN KEY ("mentorMemberId") REFERENCES "media_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
