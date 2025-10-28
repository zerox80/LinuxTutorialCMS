@echo off
REM Linux Tutorial - Docker Startup Script (Windows)

echo.
echo ========================================
echo  Linux Tutorial - Docker Startup
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first.
    pause
    exit /b 1
)

echo [INFO] Building and starting containers...
docker-compose up -d --build

if errorlevel 1 (
    echo [ERROR] Failed to start containers!
    pause
    exit /b 1
)

echo.
echo [INFO] Waiting for services to be ready...
timeout /t 5 /nobreak >nul

echo.
echo [INFO] Checking service health...
docker-compose ps

echo.
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Access the application:
echo   - Frontend: http://localhost:8489
echo   - Backend API: http://localhost:8489/api
echo   - Health Check: http://localhost:8489/health
echo.
echo Default Login:
echo   Username: admin
echo   Password: admin123
echo.
echo View logs:
echo   docker-compose logs -f
echo.
echo ========================================
echo.

pause
