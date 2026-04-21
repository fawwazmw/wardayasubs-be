-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyEmailReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyRenewalReminders" BOOLEAN NOT NULL DEFAULT true;
