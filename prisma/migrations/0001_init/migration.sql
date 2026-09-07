-- CreateEnum
CREATE TYPE "DailySetStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ProductOrigin" AS ENUM ('AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "SignalLevel" AS ENUM ('VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "RunTrigger" AS ENUM ('SCHEDULER', 'MANUAL', 'HTTP_CRON');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('ACCEPTED', 'REJECTED_NO_PRODUCT', 'REJECTED_DUPLICATE', 'REJECTED_SIMILAR', 'REJECTED_LOW_SCORE', 'REJECTED_SATURATED', 'REJECTED_DATA_QUALITY', 'REJECTED_OTHER');

-- CreateEnum
CREATE TYPE "ViewKind" AS ENUM ('CARD', 'DETAIL');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_product_sets" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" "DailySetStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generationRunId" TEXT,

    CONSTRAINT "daily_product_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_product_items" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "reused" BOOLEAN NOT NULL DEFAULT false,
    "reusedFromDate" TEXT,

    CONSTRAINT "daily_product_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trendTitle" TEXT NOT NULL,
    "trendDescription" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "aeTitle" TEXT NOT NULL,
    "aeDescription" TEXT,
    "aeUrl" TEXT NOT NULL,
    "aeProductId" TEXT,
    "aeStoreName" TEXT,
    "aeImages" JSONB NOT NULL,
    "aeRating" DOUBLE PRECISION,
    "aeOrders" INTEGER,
    "aeVariants" JSONB,
    "priceOriginal" DOUBLE PRECISION,
    "currencyOriginal" TEXT,
    "priceShipping" DOUBLE PRECISION,
    "shippingVerified" BOOLEAN NOT NULL DEFAULT false,
    "priceIls" DOUBLE PRECISION,
    "priceIlsTotal" DOUBLE PRECISION,
    "fxRateUsed" DOUBLE PRECISION,
    "fxAsOf" TIMESTAMP(3),
    "dataConfidence" JSONB NOT NULL,
    "viralPotentialScore" INTEGER NOT NULL,
    "affiliatePotentialScore" INTEGER NOT NULL,
    "noveltyScore" INTEGER NOT NULL,
    "trendMomentumScore" INTEGER NOT NULL,
    "saturationScore" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "explanationHe" TEXT NOT NULL,
    "generationRunId" TEXT,
    "origin" "ProductOrigin" NOT NULL DEFAULT 'AI',

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_trend_reports" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tiktokLevel" "SignalLevel" NOT NULL DEFAULT 'UNKNOWN',
    "tiktokReasoning" TEXT,
    "instagramLevel" "SignalLevel" NOT NULL DEFAULT 'UNKNOWN',
    "instagramReasoning" TEXT,
    "youtubeLevel" "SignalLevel" NOT NULL DEFAULT 'UNKNOWN',
    "youtubeReasoning" TEXT,
    "googleTrendsLevel" "SignalLevel" NOT NULL DEFAULT 'UNKNOWN',
    "googleTrendsReasoning" TEXT,
    "verifiedMetrics" JSONB,
    "overallReasoningHe" TEXT NOT NULL,

    CONSTRAINT "product_trend_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_sources" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "runId" TEXT,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "sourceType" TEXT NOT NULL,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relevance" TEXT,
    "supports" TEXT,

    CONSTRAINT "trend_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_runs" (
    "id" TEXT NOT NULL,
    "targetDate" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" "RunTrigger" NOT NULL,
    "mode" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "durationMs" INTEGER,
    "searchedTopics" JSONB,
    "errorLog" JSONB,
    "summary" TEXT,
    "stats" JSONB,

    CONSTRAINT "generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_candidates" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "trendTitle" TEXT NOT NULL,
    "trendDescription" TEXT NOT NULL,
    "category" TEXT,
    "aeUrl" TEXT,
    "aeProductId" TEXT,
    "aeTitle" TEXT,
    "aeImages" JSONB,
    "aeRating" DOUBLE PRECISION,
    "aeOrders" INTEGER,
    "priceOriginal" DOUBLE PRECISION,
    "currencyOriginal" TEXT,
    "scores" JSONB,
    "socialSignals" JSONB,
    "rawResearch" JSONB,
    "status" "CandidateStatus" NOT NULL,
    "rejectionReason" TEXT,
    "productId" TEXT,

    CONSTRAINT "generation_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_views" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" "ViewKind" NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_clicks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "linkMode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_logs" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "durationMs" INTEGER,
    "meta" JSONB,
    "errorText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "daily_product_sets_date_key" ON "daily_product_sets"("date");

-- CreateIndex
CREATE INDEX "daily_product_sets_date_idx" ON "daily_product_sets"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_product_items_setId_position_key" ON "daily_product_items"("setId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "daily_product_items_setId_productId_key" ON "daily_product_items"("setId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_overallScore_idx" ON "products"("overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "product_trend_reports_productId_key" ON "product_trend_reports"("productId");

-- CreateIndex
CREATE INDEX "trend_sources_productId_idx" ON "trend_sources"("productId");

-- CreateIndex
CREATE INDEX "trend_sources_runId_idx" ON "trend_sources"("runId");

-- CreateIndex
CREATE INDEX "generation_runs_targetDate_idx" ON "generation_runs"("targetDate");

-- CreateIndex
CREATE INDEX "generation_candidates_runId_idx" ON "generation_candidates"("runId");

-- CreateIndex
CREATE INDEX "product_views_productId_date_idx" ON "product_views"("productId", "date");

-- CreateIndex
CREATE INDEX "product_views_date_idx" ON "product_views"("date");

-- CreateIndex
CREATE INDEX "product_clicks_productId_date_idx" ON "product_clicks"("productId", "date");

-- CreateIndex
CREATE INDEX "product_clicks_date_idx" ON "product_clicks"("date");

-- CreateIndex
CREATE INDEX "api_logs_runId_idx" ON "api_logs"("runId");

-- CreateIndex
CREATE INDEX "api_logs_provider_createdAt_idx" ON "api_logs"("provider", "createdAt");

-- AddForeignKey
ALTER TABLE "daily_product_sets" ADD CONSTRAINT "daily_product_sets_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "generation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_product_items" ADD CONSTRAINT "daily_product_items_setId_fkey" FOREIGN KEY ("setId") REFERENCES "daily_product_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_product_items" ADD CONSTRAINT "daily_product_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "generation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_trend_reports" ADD CONSTRAINT "product_trend_reports_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trend_sources" ADD CONSTRAINT "trend_sources_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trend_sources" ADD CONSTRAINT "trend_sources_runId_fkey" FOREIGN KEY ("runId") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_candidates" ADD CONSTRAINT "generation_candidates_runId_fkey" FOREIGN KEY ("runId") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_clicks" ADD CONSTRAINT "product_clicks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "generation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

