-- CreateEnum
CREATE TYPE "public"."PostType" AS ENUM ('text', 'live_video');

-- AlterTable
ALTER TABLE "public"."Post" ADD COLUMN     "postType" "public"."PostType" NOT NULL DEFAULT 'text';
