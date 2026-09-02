-- Lets an escalation originate from the Chrome extension's Suggested
-- Resolution panel (audit_request_id) instead of only a console chat
-- session (session_id). Exactly one of the two must be set — see the CHECK
-- constraint below; Prisma's schema language can't express that itself.

-- DropForeignKey
ALTER TABLE "escalations" DROP CONSTRAINT "escalations_session_id_fkey";

-- AlterTable
ALTER TABLE "escalations" ADD COLUMN     "audit_request_id" UUID,
ALTER COLUMN "session_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "escalations_audit_request_id_key" ON "escalations"("audit_request_id");

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_audit_request_id_fkey" FOREIGN KEY ("audit_request_id") REFERENCES "audit"("request_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateCheck: exactly one of session_id / audit_request_id is set.
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_source_check"
    CHECK (("session_id" IS NOT NULL) <> ("audit_request_id" IS NOT NULL));
