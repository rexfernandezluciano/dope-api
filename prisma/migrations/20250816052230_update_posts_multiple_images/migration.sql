/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Post" DROP COLUMN "imageUrl",
ADD COLUMN     "imageUrls" TEXT[],
ALTER COLUMN "content" DROP NOT NULL;
