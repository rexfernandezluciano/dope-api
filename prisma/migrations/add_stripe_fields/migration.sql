
-- Add Stripe fields to User table
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT;

-- Add unique constraints
ALTER TABLE "User" ADD CONSTRAINT "User_stripeCustomerId_key" UNIQUE ("stripeCustomerId");
ALTER TABLE "User" ADD CONSTRAINT "User_stripeSubscriptionId_key" UNIQUE ("stripeSubscriptionId");

-- Add Stripe fields to PaymentMethod table
ALTER TABLE "PaymentMethod" ADD COLUMN "stripePaymentMethodId" TEXT;
ALTER TABLE "PaymentMethod" ADD COLUMN "paypalEmail" TEXT;

-- Add unique constraint for Stripe payment method ID
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_stripePaymentMethodId_key" UNIQUE ("stripePaymentMethodId");
