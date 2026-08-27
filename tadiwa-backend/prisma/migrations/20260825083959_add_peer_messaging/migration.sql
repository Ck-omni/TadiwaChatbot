-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "recipient_id" INTEGER;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "sender_id" INTEGER NOT NULL,
ALTER COLUMN "role" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_user_id_recipient_id_key" ON "chat_sessions"("user_id", "recipient_id");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

