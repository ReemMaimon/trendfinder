-- Add cached affiliate link fields to products
ALTER TABLE "products" ADD COLUMN "affiliateUrl" TEXT;
ALTER TABLE "products" ADD COLUMN "affiliateUrlAt" TIMESTAMP(3);
