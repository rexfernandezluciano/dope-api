
-- Add PayPal to payment provider enum
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'paypal';

-- Add new PayPal payment types
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'paypal_card';
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'paypal_wallet';

-- Add PayPal payment method ID field
ALTER TABLE "PaymentMethod" ADD COLUMN IF NOT EXISTS "paypalPaymentMethodId" TEXT;

-- Add PayPal email field for wallet payments
ALTER TABLE "PaymentMethod" ADD COLUMN IF NOT EXISTS "paypalEmail" TEXT;

-- Add unique constraint for PayPal payment method ID
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_paypalPaymentMethodId_key" UNIQUE ("paypalPaymentMethodId");

-- Add PayPal customer ID to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paypalCustomerId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_paypalCustomerId_key" UNIQUE ("paypalCustomerId");
