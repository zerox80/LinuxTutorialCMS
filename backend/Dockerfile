# Multi-stage build für kleines Image
# Use latest stable Rust
FROM rust:1.82-bookworm as builder

WORKDIR /app

# Dependencies installieren
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Dependencies cachen - copy both Cargo.toml and Cargo.lock
# NOTE: Cargo.lock is required for reproducible builds
COPY Cargo.toml Cargo.lock ./
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
    curl \
    && rm -rf /var/lib/apt/lists/*

# Binary kopieren
COPY --from=builder /app/target/release/linux-tutorial-backend /app/backend

# .env Template
COPY .env.docker .env

# Expose port
EXPOSE 8489

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8489/api/health || exit 1

# Run
CMD ["/app/backend"]
