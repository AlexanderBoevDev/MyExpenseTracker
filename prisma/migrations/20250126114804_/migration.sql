/*
  Warnings:

  - A unique constraint covering the columns `[machineName]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[machineName]` on the table `TransactionType` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `machineName` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `machineName` to the `TransactionType` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Category` ADD COLUMN `machineName` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `TransactionType` ADD COLUMN `machineName` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Category_machineName_key` ON `Category`(`machineName`);

-- CreateIndex
CREATE UNIQUE INDEX `TransactionType_machineName_key` ON `TransactionType`(`machineName`);
