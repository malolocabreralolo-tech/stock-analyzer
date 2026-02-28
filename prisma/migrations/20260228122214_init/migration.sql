-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "marketCap" DOUBLE PRECISION,
    "exchange" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Financial" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodDate" TIMESTAMP(3),
    "revenue" DOUBLE PRECISION,
    "netIncome" DOUBLE PRECISION,
    "freeCashFlow" DOUBLE PRECISION,
    "totalDebt" DOUBLE PRECISION,
    "totalEquity" DOUBLE PRECISION,
    "totalAssets" DOUBLE PRECISION,
    "pe" DOUBLE PRECISION,
    "evEbitda" DOUBLE PRECISION,
    "pb" DOUBLE PRECISION,
    "ps" DOUBLE PRECISION,
    "roe" DOUBLE PRECISION,
    "roic" DOUBLE PRECISION,
    "debtToEquity" DOUBLE PRECISION,
    "currentRatio" DOUBLE PRECISION,
    "grossMargin" DOUBLE PRECISION,
    "operatingMargin" DOUBLE PRECISION,
    "netMargin" DOUBLE PRECISION,
    "revenueGrowth" DOUBLE PRECISION,
    "epsGrowth" DOUBLE PRECISION,
    "dividendYield" DOUBLE PRECISION,
    "ebitda" DOUBLE PRECISION,
    "eps" DOUBLE PRECISION,
    "bookValuePerShare" DOUBLE PRECISION,
    "operatingCashFlow" DOUBLE PRECISION,
    "capitalExpenditure" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Financial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "dcfValue" DOUBLE PRECISION,
    "multiplesValue" DOUBLE PRECISION,
    "compositeValue" DOUBLE PRECISION NOT NULL,
    "upsidePercent" DOUBLE PRECISION NOT NULL,
    "rating" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiSummary" TEXT,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_ticker_key" ON "Company"("ticker");

-- CreateIndex
CREATE INDEX "Company_sector_idx" ON "Company"("sector");

-- CreateIndex
CREATE INDEX "Company_exchange_idx" ON "Company"("exchange");

-- CreateIndex
CREATE INDEX "Financial_companyId_idx" ON "Financial"("companyId");

-- CreateIndex
CREATE INDEX "Financial_period_idx" ON "Financial"("period");

-- CreateIndex
CREATE UNIQUE INDEX "Financial_companyId_period_key" ON "Financial"("companyId", "period");

-- CreateIndex
CREATE INDEX "Valuation_companyId_idx" ON "Valuation"("companyId");

-- CreateIndex
CREATE INDEX "Valuation_rating_idx" ON "Valuation"("rating");

-- CreateIndex
CREATE INDEX "Valuation_upsidePercent_idx" ON "Valuation"("upsidePercent");

-- CreateIndex
CREATE INDEX "Position_portfolioId_idx" ON "Position"("portfolioId");

-- AddForeignKey
ALTER TABLE "Financial" ADD CONSTRAINT "Financial_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
