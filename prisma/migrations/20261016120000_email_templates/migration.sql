-- Admin-editable email wording. No row means the built-in copy is used.
CREATE TABLE "email_templates" (
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta_label" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("key")
);
