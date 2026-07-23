# syntax=docker/dockerfile:1

# ---------- base ----------
# Node 24 to match the frontend image and the host dev environment.
FROM node:24-alpine AS base
WORKDIR /app
# Install deps first so a source-only change does not re-run npm ci.
COPY package*.json ./

# ---------- development ----------
# Keeps devDependencies so nodemon is available for hot reload.
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3010
CMD ["npm", "run", "dev"]

# ---------- production ----------
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY . .
# Drop root before running the app.
USER node
EXPOSE 3010
CMD ["node", "src/server.js"]
