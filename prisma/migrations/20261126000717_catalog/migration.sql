-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'LOW', 'OUT');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditions" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "active_ingredient" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "pack" TEXT,
    "requires_rx" BOOLEAN NOT NULL DEFAULT true,
    "scarce_in_css" BOOLEAN NOT NULL DEFAULT false,
    "aliases" TEXT[],
    "search_text" TEXT NOT NULL,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_conditions" (
    "medication_id" INTEGER NOT NULL,
    "condition_id" INTEGER NOT NULL,

    CONSTRAINT "medication_conditions_pkey" PRIMARY KEY ("medication_id","condition_id")
);

-- CreateTable
CREATE TABLE "chains" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "color" TEXT NOT NULL,

    CONSTRAINT "chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "hours" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "location" geography(Point,4326),
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "medication_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "status" "StockStatus" NOT NULL,
    "price_cents" INTEGER,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "branch_id" INTEGER NOT NULL,
    "medication_id" INTEGER NOT NULL,
    "status" "StockStatus" NOT NULL,
    "price_cents" INTEGER,
    "confirmed_at" TIMESTAMP(3) NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 1,
    "last_report_id" TEXT,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("branch_id","medication_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "conditions_slug_key" ON "conditions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "medications_slug_key" ON "medications"("slug");

-- CreateIndex
CREATE INDEX "medications_search_trgm" ON "medications" USING GIN ("search_text" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "medications_scarce_in_css_idx" ON "medications"("scarce_in_css");

-- CreateIndex
CREATE INDEX "medication_conditions_condition_id_idx" ON "medication_conditions"("condition_id");

-- CreateIndex
CREATE UNIQUE INDEX "chains_slug_key" ON "chains"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "branches_slug_key" ON "branches"("slug");

-- CreateIndex
CREATE INDEX "branches_location_idx" ON "branches" USING GIST ("location");

-- CreateIndex
CREATE INDEX "branches_chain_id_idx" ON "branches"("chain_id");

-- CreateIndex
CREATE INDEX "reports_branch_id_medication_id_created_at_idx" ON "reports"("branch_id", "medication_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_medication_id_created_at_idx" ON "reports"("medication_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_user_id_created_at_idx" ON "reports"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "availability_medication_id_status_idx" ON "availability"("medication_id", "status");

-- AddForeignKey
ALTER TABLE "medication_conditions" ADD CONSTRAINT "medication_conditions_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_conditions" ADD CONSTRAINT "medication_conditions_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "conditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ubicación geográfica de cada sucursal, calculada desde lat/lng.
-- Prisma escribe lat/lng; el trigger mantiene `location` (geography) sincronizada para PostGIS.
CREATE OR REPLACE FUNCTION branches_set_location() RETURNS trigger AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER branches_set_location
  BEFORE INSERT OR UPDATE OF lat, lng ON "branches"
  FOR EACH ROW EXECUTE FUNCTION branches_set_location();
