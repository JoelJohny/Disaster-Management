# =============================================================================
#  DisasterAid — one image, one process: the Express API serving the built
#  Angular bundle from the same origin.
#
#  Node 24 is not a preference. The compiled backend still imports
#  @drms/contracts as a bare specifier, which resolves to a .ts file at
#  runtime; that loads only because Node strips types natively from 22.18.
# =============================================================================

FROM node:24-alpine AS build
WORKDIR /app

# Manifests first, so a source-only change does not reinstall the world.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY packages/contracts/package.json packages/contracts/

# NODE_ENV is deliberately NOT production here: the build needs tsc and the
# Angular CLI, and `npm ci` omits devDependencies when it is set.
RUN npm ci

# The frontend is installed from its OWN lockfile, separately.
#
# The root lockfile declares the frontend workspace but contains none of the
# Angular or Tailwind tree, so the root `npm ci` above installs nothing for it.
# Locally that goes unnoticed because frontend/node_modules was installed from
# frontend/package-lock.json, which is complete — including every platform
# build of lightningcss, the native binary Tailwind 4 needs. Installing from
# the root lock instead yields a lightningcss without a Linux binary, and the
# Angular build dies on MODULE_NOT_FOUND.
#
# This reproduces the arrangement that is known to work. Consolidating the two
# lockfiles into one is the real fix and a separate job.
COPY frontend/package-lock.json frontend/
RUN npm --prefix frontend ci

COPY . .
RUN npm run build


FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# tini reaps zombies and forwards SIGTERM, so the platform can stop the
# container cleanly instead of waiting out a timeout.
RUN apk add --no-cache tini

COPY --from=build /app/node_modules       ./node_modules
COPY --from=build /app/package.json       ./package.json
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist       ./backend/dist
COPY --from=build /app/frontend/dist      ./frontend/dist

# The contracts package ships TypeScript sources and is resolved at runtime
# through the workspace symlink in node_modules, so it has to be here.
COPY --from=build /app/packages           ./packages

# Needed only to initialise a fresh database (scripts/db-deploy.mjs); a few
# kilobytes, and it means the running container can seed itself if asked.
COPY --from=build /app/db                 ./db
COPY --from=build /app/scripts            ./scripts

USER node
EXPOSE 3000

# Entry point is dist/backend/src/server.js, not dist/server.js: tsconfig sets
# rootDir to the repo root so packages/contracts compiles alongside, which
# nests the output one level deeper than it looks.
#
# From /app/backend/dist/backend/src, four levels up is /app, so the server
# finds the Angular bundle at /app/frontend/dist/frontend/browser.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/dist/backend/src/server.js"]
