-- Hand-written and applied via `prisma migrate deploy`, same reason as
-- the GIST index migration: `migrate dev`'s shadow-database validation
-- replays the full migration history (including geometry columns from
-- `init`) against a fresh DB with no PostGIS extension, which always
-- fails there regardless of what this particular change is.
--
-- Poi.category and Poi.price_tier were NOT NULL in the original schema,
-- but resolve-pois.js (which creates Poi rows) runs before
-- classify-categories.js (which determines category) and before
-- anything sets price_tier at all. Decision confirmed with the project
-- owner: make both nullable, meaning NULL = "not yet classified" rather
-- than inventing a placeholder enum value that would misrepresent
-- unclassified rows as classified.
ALTER TABLE "Poi" ALTER COLUMN "category" DROP NOT NULL;
ALTER TABLE "Poi" ALTER COLUMN "price_tier" DROP NOT NULL;
