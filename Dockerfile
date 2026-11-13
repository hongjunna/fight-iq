# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
# NEXT_PUBLIC_* 값은 빌드할 때 클라이언트 번들에 박힌다.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG DEPLOYMENT_VERSION=local
ENV NEXT_TELEMETRY_DISABLED=1
ENV DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 문제 생성 워커 — Next 빌드 없이 TypeScript 를 tsx 로 바로 실행 (웹 앱과 스키마·규격 코드를 공유)
FROM node:24-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Seoul
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node src ./src
USER node
CMD ["node_modules/.bin/tsx", "src/worker/main.ts"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Seoul
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
