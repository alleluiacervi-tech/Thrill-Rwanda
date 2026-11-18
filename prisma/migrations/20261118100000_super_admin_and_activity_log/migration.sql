-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_super_admin" BOOLEAN NOT NULL DEFAULT false;
-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "target" TEXT,
    "target_id" TEXT,
    "summary" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");
-- CreateIndex
CREATE INDEX "activity_logs_actor_id_created_at_idx" ON "activity_logs"("actor_id", "created_at");
-- CreateIndex
CREATE INDEX "activity_logs_area_created_at_idx" ON "activity_logs"("area", "created_at");
-- CreateIndex
CREATE INDEX "activity_logs_target_id_idx" ON "activity_logs"("target_id");

-- Every existing administrator starts as a super admin, so nobody who can
-- manage access today is locked out. A super admin can then narrow this.
UPDATE "users" SET "is_super_admin" = true WHERE "role" = 'ADMIN';

-- The activity log is append-only: entries can be added, never changed or
-- removed, including by the application. This is what makes the log a fair
-- record of who did what.
CREATE FUNCTION "activity_logs_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "activity_logs_no_update"
  BEFORE UPDATE ON "activity_logs"
  FOR EACH ROW EXECUTE FUNCTION "activity_logs_append_only"();

CREATE TRIGGER "activity_logs_no_delete"
  BEFORE DELETE ON "activity_logs"
  FOR EACH ROW EXECUTE FUNCTION "activity_logs_append_only"();

CREATE TRIGGER "activity_logs_no_truncate"
  BEFORE TRUNCATE ON "activity_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "activity_logs_append_only"();
