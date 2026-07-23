# syntax=docker/dockerfile:1

# ---------- base ----------
# Node 24 on purpose: package-lock.json is lockfileVersion 3 authored by
# npm 11. npm 10 (node:22) resolves the hoisted `yaml` dep differently and
# fails `npm ci` with "Missing: yaml@2.9.0 from lock file".
FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---------- development ----------
# react-scripts dev server with hot reload.
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

# ---------- build ----------
FROM base AS build
RUN npm ci
COPY . .
# CRA inlines REACT_APP_* at BUILD time, so this must be supplied as a build
# arg - setting it at runtime has no effect on an already-built bundle.
ARG REACT_APP_API_URL=http://localhost:3010/api
ARG REACT_APP_API_TIMEOUT=10000
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_API_TIMEOUT=$REACT_APP_API_TIMEOUT
RUN npm run build

# ---------- production ----------
FROM nginx:1.27-alpine AS production
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
