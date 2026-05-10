# ─────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────
FROM oven/bun:1-debian AS deps

WORKDIR /app

# Copy only the files needed for install (better layer caching)
COPY package.json bun.lockb ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# ─────────────────────────────────────────────
# Stage 2: Final runtime image
# ─────────────────────────────────────────────
FROM oven/bun:1-debian AS runner

WORKDIR /app

# Install system libraries required by sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY kysely.config.ts ./
COPY package.json ./

# Use non-root user for security (bun image ships with this user)
USER bun

# Run the bot
CMD ["bun", "run", "src/index.ts"]
