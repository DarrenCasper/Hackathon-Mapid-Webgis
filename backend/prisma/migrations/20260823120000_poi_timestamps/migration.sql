-- Hand-written and applied via `prisma migrate deploy`, same reason as
-- every migration since `init`: the shadow database `migrate dev` needs
-- doesn't have PostGIS enabled, so replaying full history there always
-- fails regardless of what this migration changes.
--
-- created_at/updated_at for change-detection (Phase 9's daily insight
-- refresh). DEFAULT now() covers created_at for every INSERT
-- automatically. updated_at needs a real trigger, not just a column
-- default, because nearly every write to this table goes through
-- $executeRaw across multiple scripts (resolve-pois.js,
-- fetch-osm-fallback.js, fetch-jakarta-opendata.js,
-- classify-categories.js) — a DB-level trigger fires on every UPDATE
-- regardless of which script performs it, so nothing needs to remember
-- to set this column by hand in four different places.
ALTER TABLE "Poi" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "Poi" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION set_poi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER poi_set_updated_at
  BEFORE UPDATE ON "Poi"
  FOR EACH ROW
  EXECUTE FUNCTION set_poi_updated_at();
