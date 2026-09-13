ALTER TABLE "Report" ADD COLUMN "route_edge_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 ADD COLUMN "route_graph_version" TEXT, ADD COLUMN "route_feedback" TEXT,
 ADD COLUMN "verification_evidence" TEXT, ADD COLUMN "verified_on_site_at" TIMESTAMP(3);
ALTER TABLE "Report" ADD CONSTRAINT "Report_route_feedback_valid" CHECK ("route_feedback" IS NULL OR "route_feedback" IN ('avoid','recommend'));
CREATE TABLE "WalkingGraph" ("station_id" TEXT PRIMARY KEY, "version" TEXT NOT NULL, "data" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "RouteDecision" ("id" TEXT PRIMARY KEY, "report_id" TEXT NOT NULL REFERENCES "Report"("id"), "moderator_id" TEXT NOT NULL, "decision" TEXT NOT NULL, "evidence" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
