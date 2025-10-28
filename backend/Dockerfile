# Multi-stage build für kleines Image
FROM rust:1.83-slim as builder

WORKDIR /app

# Dependencies installieren
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Dependencies cachen
COPY Cargo.toml ./
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Source Code kopieren und bauen
COPY . .
RUN touch src/main.rs && \
    cargo build --release

# Runtime Stage
FROM debian:bookworm-slim

WORKDIR /app

# Runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Binary kopieren
COPY --from=builder /app/target/release/linux-tutorial-backend /app/backend

# .env Template
COPY .env.docker .env

# Expose port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Run
CMD ["/app/backend"]
