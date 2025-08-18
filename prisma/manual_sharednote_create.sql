-- Manual creation of SharedNote table (baseline workaround)
CREATE TABLE IF NOT EXISTS "SharedNote" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "ops" TEXT NOT NULL DEFAULT '',
  "comm" TEXT NOT NULL DEFAULT '',
  "stoveDate" VARCHAR(32),
  "stoveNumber" VARCHAR(32),
  "opsFont" VARCHAR(64),
  "commFont" VARCHAR(64),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
