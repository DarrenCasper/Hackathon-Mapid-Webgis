-- CreateEnum
CREATE TYPE "PoiCategory" AS ENUM ('kopi_minuman', 'quick_meal', 'warung_makan', 'bakery', 'casual_dining', 'hiburan');

-- CreateEnum
CREATE TYPE "PriceTier" AS ENUM ('ekonomis', 'menengah', 'premium');

-- CreateEnum
CREATE TYPE "PoiSource" AS ENUM ('mapid_missions', 'openstreetmap', 'mock');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('trotoar_rusak', 'akses_tertutup', 'banjir', 'penyeberangan_tidak_aman', 'tempat_tutup', 'umkm_baru', 'info_lainnya');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'verified', 'rejected', 'applied');

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationExit" (
    "id" SERIAL NOT NULL,
    "station_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,

    CONSTRAINT "StationExit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Isochrone" (
    "id" SERIAL NOT NULL,
    "station_id" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "polygon" geometry(Polygon, 4326) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'valhalla',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Isochrone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapidMission" (
    "id" TEXT NOT NULL,
    "mission_type" TEXT NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "raw_properties" JSONB NOT NULL,
    "poi_id" INTEGER,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapidMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapidActivity" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "location" geometry(Point, 4326) NOT NULL,
    "media_urls" TEXT[],
    "user_name" TEXT,
    "user_full_name" TEXT,
    "community_name" TEXT,
    "total_comment" INTEGER,
    "likes_count" INTEGER,
    "source_created_at" TIMESTAMP(3),
    "raw_properties" JSONB NOT NULL,
    "poi_id" INTEGER,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapidActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poi" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PoiCategory" NOT NULL,
    "price_tier" "PriceTier" NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "source" "PoiSource" NOT NULL DEFAULT 'mock',
    "verified_field" BOOLEAN NOT NULL DEFAULT false,
    "menu_utama" TEXT,
    "harga_rata_rata" INTEGER,
    "jam_buka" TEXT,
    "jam_tutup" TEXT,
    "kondisi_tempat" TEXT,
    "raw_category_text" TEXT,

    CONSTRAINT "Poi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moderator" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Moderator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "poi_id" INTEGER,
    "report_type" "ReportType" NOT NULL,
    "description" TEXT NOT NULL,
    "photo_url" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "moderator_id" TEXT,
    "moderator_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Isochrone_station_id_minutes_key" ON "Isochrone"("station_id", "minutes");

-- CreateIndex
CREATE UNIQUE INDEX "Moderator_email_key" ON "Moderator"("email");

-- AddForeignKey
ALTER TABLE "StationExit" ADD CONSTRAINT "StationExit_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Isochrone" ADD CONSTRAINT "Isochrone_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapidMission" ADD CONSTRAINT "MapidMission_poi_id_fkey" FOREIGN KEY ("poi_id") REFERENCES "Poi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapidActivity" ADD CONSTRAINT "MapidActivity_poi_id_fkey" FOREIGN KEY ("poi_id") REFERENCES "Poi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_poi_id_fkey" FOREIGN KEY ("poi_id") REFERENCES "Poi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "Moderator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
