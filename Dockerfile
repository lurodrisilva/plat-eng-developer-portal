# syntax=docker/dockerfile:1.9

# ---------------------------------------------------------------------------
# Developer portal image — slice P4.
#
# NOTHING ENVIRONMENT-SPECIFIC IS BUILT IN, and that is the point of the whole
# image. There is deliberately no ARG/ENV for VITE_* in the build stage: the
# bundle is identical for every tenant and every orchestrator origin, and the
# deployed values arrive at start when the entrypoint renders config.js
# (slice P3, src/lib/config.ts). One digest is promoted, never rebuilt.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS build
WORKDIR /app

# Manifest first so `npm ci` caches across source-only edits.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The two gates that guard the runtime-config contract run here as well as in
# CI, so an image can never be built from a tree that fails them.
RUN npm run lint \
 && npm run check:contract \
 && npm run check:entrypoint \
 && npm run build

# ---------------------------------------------------------------------------
# Runtime — nginx-unprivileged: UID 101, listens on 8080, and already ships the
# pid/temp-path plumbing that makes the upstream image awkward to run non-root.
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

USER root

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf

# The webroot stays ROOT-OWNED and unwritable by the runtime user. A container
# that can rewrite the files it serves is a worse position than one that cannot,
# and P5 wants readOnlyRootFilesystem.
COPY --from=build /app/dist /usr/share/nginx/html

# dist/ carries the committed public/config.js placeholder — `window.
# __PORTAL_CONFIG__ = {}`. Delete it. It is shadowed by the exact-match location
# below, so it would never be served, but leaving it means the failure mode of a
# missing alias is "serves an empty config and signs nobody in" instead of an
# honest 404.
RUN rm -f /usr/share/nginx/html/config.js

# Runtime configuration lives OUTSIDE the webroot, in the one directory the
# runtime user may write. The entrypoint renames a temp file into it, so the
# DIRECTORY must be writable, not merely the file.
RUN mkdir -p /etc/portal && chown 101:101 /etc/portal
ENV PORTAL_CONFIG_PATH=/etc/portal/config.js

# Dropped into the base image's own init directory rather than replacing its
# ENTRYPOINT: nginx's entrypoint runs /docker-entrypoint.d/*.sh and then execs
# the command. The P3 script already tolerates being invoked with no arguments
# (its `exec "$@"` is guarded), so it needs no change to work in either shape.
COPY --chmod=0755 scripts/docker-entrypoint.sh /docker-entrypoint.d/10-render-portal-config.sh

USER 101
EXPOSE 8080

# Serving is only half of ready — a pod whose config never rendered serves a
# portal nobody can sign into. This probes the rendered file, not the webroot.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:8080/config.js | grep -q '__PORTAL_CONFIG__' || exit 1

CMD ["nginx", "-g", "daemon off;"]
