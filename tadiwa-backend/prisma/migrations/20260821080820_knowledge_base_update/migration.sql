-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "knowledge_base_entries" ADD COLUMN     "embedding" vector(1536);
