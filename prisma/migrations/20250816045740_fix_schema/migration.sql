-- CreateEnum
CREATE TYPE "public"."Subscription" AS ENUM ('free', 'premium', 'pro');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "hasBlueCheck" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasVerifiedEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoURL" TEXT,
ADD COLUMN     "privacy" JSONB,
ADD COLUMN     "subscription" "public"."Subscription" NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "public"."Credential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Email" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Credential_userId_provider_key" ON "public"."Credential"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Email_verificationId_key" ON "public"."Email"("verificationId");

-- AddForeignKey
ALTER TABLE "public"."Credential" ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
