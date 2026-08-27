/*
  Warnings:

  - The primary key for the `chat_sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `chat_sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `session_id` on the `escalations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `session_id` on the `messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "escalations" DROP CONSTRAINT "escalations_session_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_session_id_fkey";

-- AlterTable
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "escalations" DROP COLUMN "session_id",
ADD COLUMN     "session_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "session_id",
ADD COLUMN     "session_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "escalations_session_id_key" ON "escalations"("session_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
