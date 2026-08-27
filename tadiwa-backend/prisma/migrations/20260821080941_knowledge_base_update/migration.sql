/*
  Warnings:

  - Added the required column `tags` to the `knowledge_base_entries` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "knowledge_base_entries" ADD COLUMN     "tags" TEXT NOT NULL;
