/*
  Warnings:

  - You are about to drop the column `billingCycle` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `nextBillingDate` on the `Subscription` table. All the data in the column will be lost.
  - Added the required column `billingInterval` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `renewalDate` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- DropIndex
DROP INDEX "Subscription_userId_nextBillingDate_idx";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "billingCycle",
DROP COLUMN "nextBillingDate",
ADD COLUMN     "billingCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "billingInterval" "BillingInterval" NOT NULL,
ADD COLUMN     "renewalDate" TIMESTAMP(3) NOT NULL;

-- DropEnum
DROP TYPE "BillingCycle";

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_usedAt_idx" ON "EmailVerificationToken"("usedAt");

-- CreateIndex
CREATE INDEX "Subscription_userId_renewalDate_idx" ON "Subscription"("userId", "renewalDate");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
