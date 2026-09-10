-- Analytics dimensions: session id, referrer, traffic source, device type
ALTER TABLE "product_views" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "product_views" ADD COLUMN "referrer" TEXT;
ALTER TABLE "product_views" ADD COLUMN "source" TEXT;
ALTER TABLE "product_views" ADD COLUMN "deviceType" TEXT;

ALTER TABLE "product_clicks" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "product_clicks" ADD COLUMN "referrer" TEXT;
ALTER TABLE "product_clicks" ADD COLUMN "source" TEXT;
ALTER TABLE "product_clicks" ADD COLUMN "deviceType" TEXT;

CREATE INDEX "product_views_createdAt_idx" ON "product_views"("createdAt");
CREATE INDEX "product_views_source_idx" ON "product_views"("source");
CREATE INDEX "product_views_sessionId_idx" ON "product_views"("sessionId");
CREATE INDEX "product_clicks_createdAt_idx" ON "product_clicks"("createdAt");
CREATE INDEX "product_clicks_source_idx" ON "product_clicks"("source");
CREATE INDEX "product_clicks_sessionId_idx" ON "product_clicks"("sessionId");
