-- CreateTable
CREATE TABLE "shift_blocks" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "task" TEXT NOT NULL,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_blocks_user_id_starts_at_idx" ON "shift_blocks"("user_id", "starts_at");

-- AddForeignKey
ALTER TABLE "shift_blocks" ADD CONSTRAINT "shift_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_blocks" ADD CONSTRAINT "shift_blocks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
