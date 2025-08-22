
-- CreateEnum for PaymentProvider
CREATE TYPE "PaymentProvider" AS ENUM ('stripe', 'paymongo', 'razorpay', 'xendit', 'paypal');

-- Add new payment types
ALTER TYPE "PaymentType" ADD VALUE 'gcash';
ALTER TYPE "PaymentType" ADD VALUE 'grabpay'; 
ALTER TYPE "PaymentType" ADD VALUE 'maya';

-- Add PayMongo customer ID to User table
ALTER TABLE "User" ADD COLUMN "paymongoCustomerId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_paymongoCustomerId_key" UNIQUE ("paymongoCustomerId");

-- Add new fields to PaymentMethod table
ALTER TABLE "PaymentMethod" ADD COLUMN "provider" "PaymentProvider" NOT NULL DEFAULT 'paymongo';
ALTER TABLE "PaymentMethod" ADD COLUMN "paymongoPaymentMethodId" TEXT;
ALTER TABLE "PaymentMethod" ADD COLUMN "razorpayPaymentMethodId" TEXT;
ALTER TABLE "PaymentMethod" ADD COLUMN "xenditPaymentMethodId" TEXT;
ALTER TABLE "PaymentMethod" ADD COLUMN "phoneNumber" TEXT;

-- Add unique constraints
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_paymongoPaymentMethodId_key" UNIQUE ("paymongoPaymentMethodId");

-- Update existing records to use paymongo as default provider
UPDATE "PaymentMethod" SET "provider" = 'paymongo' WHERE "provider" IS NULL;
