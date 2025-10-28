#!/bin/bash
# Generate Cargo.lock file for reproducible builds

set -e

echo "🔧 Generating Cargo.lock for reproducible builds..."

cd "$(dirname "$0")"

if [ -f "Cargo.lock" ]; then
    echo "⚠️  Cargo.lock already exists. Updating dependencies..."
    cargo update
else
    echo "📦 Creating new Cargo.lock..."
    cargo generate-lockfile
fi

echo "✅ Cargo.lock generated/updated successfully!"
echo ""
echo "Next steps:"
echo "1. Test the build: cargo build --release"
echo "2. Commit Cargo.lock: git add Cargo.lock && git commit -m 'Add Cargo.lock'"
echo "3. Build Docker: docker build -t linux-tutorial-backend ."
