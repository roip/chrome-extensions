# Build script for Focus Reader Chrome Extension (Windows)
# Bundles with esbuild and copies extension files to ~/Downloads/focus-reader
#
# Usage: .\build.ps1           (from focus-reader directory)
#        .\build.ps1 -SkipBuild  (just copy, skip pnpm install/build)

param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$ExtensionName = "focus-reader"
$SourceDir = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }
$OutputDir = Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads\$ExtensionName"

# Verify we're in the right directory
$manifestPath = Join-Path $SourceDir "manifest.json"
if (-not (Test-Path $manifestPath)) {
    Write-Host "Error: manifest.json not found in $SourceDir" -ForegroundColor Red
    exit 1
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version
Write-Host "Building $ExtensionName v$version ..." -ForegroundColor Green

if (-not $SkipBuild) {
    Push-Location $SourceDir
    try {
        Write-Host "Installing dependencies..."
        pnpm install 2>&1 | Out-Null
        Write-Host "Bundling with esbuild..."
        pnpm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Build failed (exit code $LASTEXITCODE)" -ForegroundColor Red
            exit 1
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Skipping build (using existing dist)" -ForegroundColor Yellow
}

# Verify dist exists
$requiredFiles = @("dist\background.js", "dist\content.js", "dist\detector.js")
foreach ($file in $requiredFiles) {
    if (-not (Test-Path (Join-Path $SourceDir $file))) {
        Write-Host "Error: $file not found. Run without -SkipBuild first." -ForegroundColor Red
        exit 1
    }
}

# Clean and create output
if (Test-Path $OutputDir) {
    Remove-Item $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutputDir "dist") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutputDir "fonts") -Force | Out-Null

# Copy manifest
Copy-Item $manifestPath $OutputDir
Write-Host "  + manifest.json" -ForegroundColor Cyan

# Copy bundled scripts
foreach ($file in $requiredFiles) {
    Copy-Item (Join-Path $SourceDir $file) (Join-Path $OutputDir "dist")
    Write-Host "  + $file" -ForegroundColor Cyan
}

# Copy fonts
$fontsSrc = Join-Path $SourceDir "fonts"
if (Test-Path $fontsSrc) {
    Get-ChildItem $fontsSrc -Filter "*.woff2" | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $OutputDir "fonts")
        Write-Host "  + fonts\$($_.Name)" -ForegroundColor Cyan
    }
}

# Copy icons if they exist
$iconsSrc = Join-Path $SourceDir "icons"
if (Test-Path $iconsSrc) {
    Copy-Item $iconsSrc (Join-Path $OutputDir "icons") -Recurse
    Write-Host "  + icons\" -ForegroundColor Cyan
}

# Summary
$fileCount = (Get-ChildItem $OutputDir -Recurse -File).Count
$totalSize = (Get-ChildItem $OutputDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
$sizeKB = [math]::Round($totalSize / 1KB)

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "Output: $OutputDir" -ForegroundColor Yellow
Write-Host "Files:  $fileCount ($sizeKB KB)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Load as unpacked extension in chrome://extensions" -ForegroundColor Gray
