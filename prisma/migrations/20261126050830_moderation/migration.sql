-- AlterTable
ALTER TABLE "users" ADD COLUMN     "blocked_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "reports_created_at_idx" ON "reports"("created_at" DESC);
