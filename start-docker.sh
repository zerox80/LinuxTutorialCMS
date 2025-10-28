#!/bin/bash

# Linux Tutorial - Docker Startup Script

echo "🐋 Starting Linux Tutorial with Docker Compose..."

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed!"
    exit 1
fi

# Check if .env.docker exists
if [ ! -f .env.docker ]; then
    echo "⚠️  .env.docker not found, using defaults"
fi

# Build and start containers
echo "📦 Building and starting containers..."
docker-compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check health
echo "🏥 Checking service health..."
docker-compose ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Access the application:"
echo "   - Frontend: http://localhost:8489"
echo "   - Backend API: http://localhost:8489/api"
echo "   - Health Check: http://localhost:8489/health"
echo ""
echo "🔐 Default Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f"
echo ""
