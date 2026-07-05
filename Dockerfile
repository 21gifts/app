# Multi-stage Docker build for the 21.gifts app (Next.js standalone output).
#
# Build:
#   docker build -t 21gifts/app:beta .
#   docker build -t 21gifts/app:latest .
#
# Run:
#   docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://dev-api.21.gifts 21gifts/app:beta
#   docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://api.21.gifts 21gifts/app:latest
#
# One image, multiple environments: `next build` inlines NEXT_PUBLIC_* values
# into the emitted bundles, so the image is built with literal placeholders
# (__NEXT_PUBLIC_API_URL__) and entrypoint.sh substitutes the real runtime
# values at container start — the same image runs DEV and PRD without rebuild.
#
# Current NEXT_PUBLIC_* variables:
#   NEXT_PUBLIC_API_URL — base URL of the 21.gifts api
#                         DEV: https://dev-api.21.gifts / PRD: https://api.21.gifts

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=__NEXT_PUBLIC_API_URL__
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Owned by the app user: entrypoint.sh rewrites these files in place at start.
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --chmod=0755 entrypoint.sh /app/entrypoint.sh

# Own the working dir itself, not just its contents. entrypoint.sh rewrites
# placeholders in place with `sed -i`, which writes a temp file into the
# target's directory and renames it over the file — that needs write on the
# /app directory, not merely on the file. WORKDIR created /app as root:root and
# the COPY --chown lines above only touched the copied content, so without this
# the `app` user cannot rewrite files sitting directly in /app (e.g. server.js).
RUN chown app:app /app

USER app
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT}/healthz || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
