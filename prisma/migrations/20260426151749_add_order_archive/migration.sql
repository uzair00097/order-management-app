-- CreateTable
CREATE TABLE "OrderArchive" (
    "id" TEXT NOT NULL,
    "salesmanId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "items" JSONB NOT NULL,
    "orderCreatedAt" TIMESTAMP(3) NOT NULL,
    "orderUpdatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderArchive_distributorId_idx" ON "OrderArchive"("distributorId");

-- CreateIndex
CREATE INDEX "OrderArchive_salesmanId_idx" ON "OrderArchive"("salesmanId");
