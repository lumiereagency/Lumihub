-- AlterTable
ALTER TABLE "users" ADD COLUMN     "extraRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "moduleAccess" JSONB;

