-- Hand-written and applied via `prisma migrate deploy`, same reason as
-- every migration since `init`: the shadow database `migrate dev` needs
-- doesn't have PostGIS enabled, so replaying full history there always
-- fails regardless of what this migration changes.
--
-- Phase 9: cached AI-generated station recommendation text — see the
-- comment on Station.ai_insight in schema.prisma for why this is
-- pre-generated/cached rather than produced live per request.
ALTER TABLE "Station" ADD COLUMN "ai_insight" TEXT;
ALTER TABLE "Station" ADD COLUMN "ai_insight_generated_at" TIMESTAMP(3);
