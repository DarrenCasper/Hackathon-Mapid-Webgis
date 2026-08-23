-- Hand-written and applied via `prisma migrate deploy`, same reason as
-- every other migration since `init`: the shadow database `migrate dev`
-- needs doesn't have PostGIS enabled, so replaying full history there
-- always fails regardless of what this migration changes.
--
-- Adds a distinct PoiSource value for real government open data (e.g.
-- satudata.jakarta.go.id's market registry) — see the comment on the
-- enum in schema.prisma for why this needed its own value rather than
-- reusing 'openstreetmap' or 'mock'.
ALTER TYPE "PoiSource" ADD VALUE 'jakarta_opendata';
