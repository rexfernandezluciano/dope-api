-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRestricted" BOOLEAN NOT NULL DEFAULT false;
