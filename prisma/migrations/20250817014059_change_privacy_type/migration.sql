/*
  Warnings:

  - The `privacy` column on the `Post` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."Privacy" AS ENUM ('public', 'private', 'followers');

-- AlterTable
ALTER TABLE "public"."Post" DROP COLUMN "privacy",
ADD COLUMN     "privacy" "public"."Privacy" NOT NULL DEFAULT 'public';
