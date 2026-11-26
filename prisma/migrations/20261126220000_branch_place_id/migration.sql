-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "place_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "branches_place_id_key" ON "branches"("place_id");

