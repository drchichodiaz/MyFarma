-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'HIDDEN');

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "photo_height" INTEGER,
ADD COLUMN     "photo_key" TEXT,
ADD COLUMN     "photo_status" "PhotoStatus",
ADD COLUMN     "photo_width" INTEGER;

-- CreateIndex
CREATE INDEX "reports_photo_status_idx" ON "reports"("photo_status");
