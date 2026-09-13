# Built by Coolify as an Application resource pointed at this repo
# (frontend/ as the base directory) — same deployment model as
# backend/Dockerfile, see that file's header comment for why a
# Dockerfile instead of Nixpacks auto-detection.
#
# Two stages: build the static Vite bundle with Node, then serve it
# with nginx — the built app is just static HTML/JS/CSS, it doesn't
# need a Node process running in production at all.

FROM node:24-slim AS build
WORKDIR /app

# IMPORTANT — read before deploying: Vite bakes every VITE_* variable
# into the static JS bundle at BUILD time (`import.meta.env.VITE_X` is
# literally replaced with its value during `vite build`), not at
# container start. So these must be set as Docker BUILD ARGS in
# Coolify's "Build Variables" section, NOT the regular runtime
# "Environment Variables" section — a runtime-only env var here has
# zero effect on the already-built bundle sitting in the image, and the
# app would ship with `VITE_API_BASE_URL` empty (see lib/apiClient.js's
# explicit check for that). See .env.example for what each one does.
ARG VITE_API_BASE_URL
ARG VITE_MAPID_API_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MAPID_API_KEY=$VITE_MAPID_API_KEY

# Copy package files first (not full source) so this layer — and the
# slow `npm ci` — stays cached across rebuilds that only touch source
# files, same reasoning as backend/Dockerfile.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Informational — Coolify manages the actual port mapping via its proxy,
# not by reading this line.
EXPOSE 80
