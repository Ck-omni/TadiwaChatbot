/*
  Warnings:

  - The `tags` column on the `knowledge_base_entries` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "audit" ALTER COLUMN "ticket_text" DROP NOT NULL,
ALTER COLUMN "matched_section" DROP NOT NULL,
ALTER COLUMN "override_section" DROP NOT NULL;

-- AlterTable
-- Prisma's Unsupported("vector(...)") type isn't diffed automatically, so
-- the dimension change (1536 -> 768, matching nomic-embed-text, the
-- embedding model actually in use) has to be done by hand. Both columns
-- are empty in tadiwa today, so there's no data to reconcile.
ALTER TABLE "audit" ALTER COLUMN "ticket_embedding" TYPE vector(768);

-- AlterTable
ALTER TABLE "knowledge_base_entries" ADD COLUMN     "section" TEXT,
ADD COLUMN     "source" TEXT,
DROP COLUMN "tags",
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "knowledge_base_entries" ALTER COLUMN "embedding" TYPE vector(768);

-- CreateTable
CREATE TABLE "copilot_sessions" (
    "session_id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "chat_turns" (
    "id" BIGSERIAL NOT NULL,
    "session_id" UUID NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "chat_turns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_turns_role_check" CHECK ("role" IN ('user', 'assistant'))
);

-- CreateIndex
CREATE INDEX "chat_turns_session_id_ts_idx" ON "chat_turns"("session_id", "ts");

-- AddForeignKey
ALTER TABLE "chat_turns" ADD CONSTRAINT "chat_turns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "copilot_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
