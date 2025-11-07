# Multi-stage build für kleines Image
# Use latest stable Rust
# Multi-stage build for optimized image size
FROM rust:latest AS builder

WORKDIR /app

# Dependencies installieren
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Dependencies cachen - copy Cargo.toml and optionally Cargo.lock
COPY Cargo.toml Cargo.lock* ./

# Generate Cargo.lock if it doesn't exist (for reproducible builds)
RUN if [ ! -f Cargo.lock ]; then \
        echo "INFO: Cargo.lock not found, generating..."; \
        cargo generate-lockfile; \
    fi

# Build dependencies (cached layer)
RUN mkdir -p src/bin && \
    echo "fn main() {}" > src/main.rs && \
    echo "fn main() {}" > src/bin/export_content.rs && \
    echo "fn main() {}" > src/bin/import_content.rs && \
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

# Expose port
EXPOSE 8489

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8489/api/health || exit 1

# Run
CMD ["/app/backend"]
