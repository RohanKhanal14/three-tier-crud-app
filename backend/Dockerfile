# ── Build stage ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# ── Production stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY --from=builder /app/src ./src

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

# Environment defaults
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Health check – poll the /health endpoint every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
