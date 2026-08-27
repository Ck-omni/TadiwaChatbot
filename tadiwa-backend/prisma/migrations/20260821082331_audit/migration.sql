-- CreateTable
CREATE TABLE "audit" (
    "request_id" UUID NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "capture_source" TEXT NOT NULL,
    "ticket_chars" INTEGER,
    "suggestion_chars" INTEGER,
    "kb_hits" INTEGER,
    "rating" TEXT,
    "ticket_text" TEXT NOT NULL,
    "ticket_embedding" vector(1536),
    "matched_section" TEXT NOT NULL,
    "choice" INTEGER NOT NULL,
    "override_section" TEXT NOT NULL,
    "session_id" UUID,

    CONSTRAINT "audit_pkey" PRIMARY KEY ("request_id")
);
