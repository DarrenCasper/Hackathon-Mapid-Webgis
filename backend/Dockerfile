# Built by Coolify as an Application resource pointed at this repo — not
# run manually, and not the same thing as docker-compose.yml (that file
# is Valhalla only; this Dockerfile is the actual Express API).
#
# Why a Dockerfile instead of letting Coolify's Nixpacks auto-detect a
# Node project: Nixpacks would work for a plain Express app, but this
# project has two things Nixpacks' generic Node detection doesn't know
# about — (1) `prisma generate` must run against schema.prisma before
# the app can import a working Prisma Client, and (2) pending migrations
# should apply automatically on every deploy via `prisma migrate deploy`
# (safe to run on every start — already-applied migrations are just
# skipped; see build.md for why `deploy`, not `dev`, is the right command
# for this project specifically). Writing both steps out explicitly here
# is more transparent than trusting Nixpacks to infer them.
FROM node:24-slim

WORKDIR /app

# Prisma's query engine needs to detect the installed OpenSSL version to
# pick the correct prebuilt binary — Debian slim images don't include
# OpenSSL by default, so without this Prisma silently guesses
# ("Defaulting to openssl-1.1.x") instead of erroring, which can mean a
# build that succeeds but a Prisma Client that fails at runtime if the
# guess is wrong. Confirmed this warning firing during a local test
# build of this exact Dockerfile — not a hypothetical, actually hit it.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files AND the Prisma schema before `npm ci` — the
# `postinstall` script in package.json runs `prisma generate`, which
# needs prisma/schema.prisma to already exist at that point. Copying the
# rest of the source code separately afterward is deliberate: it keeps
# this layer cacheable so `npm ci` (the slow step) only re-runs when
# package.json or the schema actually change, not on every source edit.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# Informational — Coolify manages the actual port mapping via the PORT
# env var it injects, not by reading this line.
EXPOSE 3000

# `prisma migrate deploy` before starting the server: applies any
# migrations that exist in prisma/migrations/ but haven't been applied
# to this DATABASE_URL yet. Uses `deploy`, not `dev` — `dev` requires a
# shadow database, and this project's shadow DB doesn't have the PostGIS
# extension enabled (see build.md Phase 2), so `dev` would fail here even
# on a correct migration.
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
