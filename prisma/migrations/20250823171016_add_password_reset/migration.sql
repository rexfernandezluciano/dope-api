/*
  Warnings:

  - You are about to drop the `Email` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."Email";

-- CreateTable
CREATE TABLE "public"."emails" (
    "verificationId" VARCHAR(50) NOT NULL,
    "email" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "expireAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("verificationId")
);

-- CreateTable
CREATE TABLE "public"."password_resets" (
    "resetId" VARCHAR(50) NOT NULL,
    "email" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("resetId")
);
