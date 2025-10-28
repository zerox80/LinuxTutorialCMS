# Generate Cargo.lock file for reproducible builds
# PowerShell script for Windows users

$ErrorActionPreference = "Stop"

Write-Host "🔧 Generating Cargo.lock for reproducible builds..." -ForegroundColor Cyan

# Change to backend directory
Set-Location $PSScriptRoot

if (Test-Path "Cargo.lock") {
    Write-Host "⚠️  Cargo.lock already exists. Updating dependencies..." -ForegroundColor Yellow
    cargo update
} else {
    Write-Host "📦 Creating new Cargo.lock..." -ForegroundColor Green
    cargo generate-lockfile
}

Write-Host ""
Write-Host "✅ Cargo.lock generated/updated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Test the build: cargo build --release"
Write-Host "2. Commit Cargo.lock: git add Cargo.lock && git commit -m 'Add Cargo.lock'"
Write-Host "3. Build Docker: docker build -t linux-tutorial-backend ."
