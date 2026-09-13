ALTER TABLE "Report" ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "request_id" TEXT;
CREATE UNIQUE INDEX "Report_request_id_key" ON "Report"("request_id");
ALTER TABLE "Report" ADD CONSTRAINT "Report_coordinates_valid" CHECK (
  ("latitude" IS NULL AND "longitude" IS NULL) OR
  ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND
   "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
);
