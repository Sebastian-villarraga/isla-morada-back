CREATE TABLE "MenuItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(2000),
  "category" VARCHAR(100) NOT NULL,
  "price" INTEGER NOT NULL,
  "imageUrl" VARCHAR(2048),
  "available" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MenuItem_available_category_sortOrder_idx" ON "MenuItem"("available", "category", "sortOrder");
