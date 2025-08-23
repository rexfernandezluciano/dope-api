/*
  Warnings:

  - The values [credit_card,debit_card,paypal,bank_transfer,crypto] on the enum `PaymentType` will be removed. If these variants are still used in the database, this will fail.
  - The `provider` column on the `PaymentMethod` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[paypalPaymentMethodId]` on the table `PaymentMethod` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `paypalPaymentMethodId` to the `PaymentMethod` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('paypal');

-- CreateEnum
CREATE TYPE "public"."AdTargetType" AS ENUM ('post', 'profile', 'hashtag', 'general');

-- CreateEnum
CREATE TYPE "public"."AdType" AS ENUM ('promotion', 'sponsored', 'banner', 'video');

-- CreateEnum
CREATE TYPE "public"."AdStatus" AS ENUM ('pending', 'active', 'paused', 'completed', 'rejected');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."PaymentType_new" AS ENUM ('paypal_card', 'paypal_wallet');
ALTER TABLE "public"."PaymentMethod" ALTER COLUMN "type" TYPE "public"."PaymentType_new" USING ("type"::text::"public"."PaymentType_new");
ALTER TYPE "public"."PaymentType" RENAME TO "PaymentType_old";
ALTER TYPE "public"."PaymentType_new" RENAME TO "PaymentType";
DROP TYPE "public"."PaymentType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."PostType" ADD VALUE 'poll';

-- AlterTable
ALTER TABLE "public"."PaymentMethod" ADD COLUMN     "paypalEmail" TEXT,
ADD COLUMN     "paypalPaymentMethodId" TEXT NOT NULL,
ADD COLUMN     "phoneNumber" TEXT,
DROP COLUMN "provider",
ADD COLUMN     "provider" "public"."PaymentProvider" NOT NULL DEFAULT 'paypal';

-- CreateTable
CREATE TABLE "public"."AdCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetType" "public"."AdTargetType" NOT NULL,
    "targetId" TEXT,
    "budget" INTEGER NOT NULL,
    "spent" INTEGER NOT NULL DEFAULT 0,
    "earnings" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL,
    "targetAudience" JSONB,
    "adType" "public"."AdType" NOT NULL DEFAULT 'promotion',
    "status" "public"."AdStatus" NOT NULL DEFAULT 'pending',
    "advertiserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdAnalytics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserKeys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FederatedFollow" (
    "id" TEXT NOT NULL,
    "actorUrl" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederatedFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FederatedLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "actorUrl" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederatedLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FederatedPost" (
    "id" TEXT NOT NULL,
    "actorUrl" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "published" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederatedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Poll" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT,
    "actorUrl" TEXT,
    "activityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdAnalytics_campaignId_key" ON "public"."AdAnalytics"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "UserKeys_userId_key" ON "public"."UserKeys"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FederatedFollow_actorUrl_activityId_key" ON "public"."FederatedFollow"("actorUrl", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "FederatedLike_postId_actorUrl_key" ON "public"."FederatedLike"("postId", "actorUrl");

-- CreateIndex
CREATE UNIQUE INDEX "FederatedPost_activityId_key" ON "public"."FederatedPost"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Poll_postId_key" ON "public"."Poll"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PollOption_pollId_position_key" ON "public"."PollOption"("pollId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_userId_key" ON "public"."PollVote"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_actorUrl_key" ON "public"."PollVote"("pollId", "actorUrl");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_paypalPaymentMethodId_key" ON "public"."PaymentMethod"("paypalPaymentMethodId");

-- AddForeignKey
ALTER TABLE "public"."AdCampaign" ADD CONSTRAINT "AdCampaign_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdAnalytics" ADD CONSTRAINT "AdAnalytics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."AdCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserKeys" ADD CONSTRAINT "UserKeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FederatedFollow" ADD CONSTRAINT "FederatedFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FederatedLike" ADD CONSTRAINT "FederatedLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Poll" ADD CONSTRAINT "Poll_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "public"."PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
