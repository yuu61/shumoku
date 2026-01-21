# Build stage
FROM oven/bun:1 AS builder

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ============================================
# Copy monorepo config files
# ============================================
COPY package.json bun.lock turbo.json tsconfig.base.json ./

# ============================================
# Copy only required packages (server and its dependencies)
# Excludes: @shumoku/icons (not needed), @shumoku/netbox (not needed),
#           shumoku (wrapper), apps/docs
# ============================================
COPY packages/@shumoku/core/ ./packages/@shumoku/core/
COPY packages/@shumoku/parser-yaml/ ./packages/@shumoku/parser-yaml/
COPY packages/@shumoku/renderer/ ./packages/@shumoku/renderer/
COPY apps/server/ ./apps/server/

# ============================================
# Install dependencies and build
# ============================================
RUN bun install
RUN bun run build

# Build web UI
WORKDIR /app/apps/server/web
RUN bun install && bun run build

# Bundle server into single file
WORKDIR /app/apps/server
RUN node esbuild.config.js

# ============================================
# Production stage
# ============================================
FROM node:22-slim

WORKDIR /app

# Install curl for health check and build tools for native modules
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy bundled server
COPY --from=builder /app/apps/server/dist/bundle.js ./server.js

# Create package.json and install better-sqlite3 native module
RUN echo '{"type": "module", "dependencies": {"better-sqlite3": "^11.8.1"}}' > package.json \
    && npm install --omit=dev

# Copy web UI build
COPY --from=builder /app/apps/server/web/build ./web/build

# Create data directory
RUN mkdir -p /data

# Environment
ENV DATA_DIR=/data
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
