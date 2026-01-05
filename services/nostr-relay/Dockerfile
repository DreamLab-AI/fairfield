FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for native modules (pg)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN apt-get update && apt-get install -y python3 make g++ \
    && npm ci --omit=dev \
    && apt-get purge -y python3 make g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

USER node

EXPOSE 8080

CMD ["node", "dist/server.js"]
