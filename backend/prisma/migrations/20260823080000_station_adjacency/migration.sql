-- Hand-written and applied via `prisma migrate deploy`, same reason as
-- every other migration in this project since `init`: the shadow
-- database `migrate dev` needs doesn't have PostGIS enabled, so
-- replaying the full migration history there always fails regardless of
-- what this specific migration changes.
--
-- Adds rough, single-neighbor-per-direction line adjacency to Station —
-- see the comment on schema.prisma's Station model for why this is a
-- simplification (junction stations have more than one real "next").
ALTER TABLE "Station" ADD COLUMN "prev_station_id" TEXT;
ALTER TABLE "Station" ADD COLUMN "next_station_id" TEXT;

ALTER TABLE "Station" ADD CONSTRAINT "Station_prev_station_id_fkey"
  FOREIGN KEY ("prev_station_id") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Station" ADD CONSTRAINT "Station_next_station_id_fkey"
  FOREIGN KEY ("next_station_id") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
