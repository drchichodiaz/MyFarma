-- CreateEnum
CREATE TYPE "ReportSource" AS ENUM ('USER', 'CALL');

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "source" "ReportSource" NOT NULL DEFAULT 'USER';

