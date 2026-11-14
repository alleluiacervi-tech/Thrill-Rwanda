-- Legal copy an admin can edit, so the client's own terms replace the drafts
-- without a code change. Bookings record the version that was accepted.
CREATE TABLE "legal_documents" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("slug")
);
