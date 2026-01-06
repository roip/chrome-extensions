#!/bin/bash

# Build script for Focus Reader Chrome Extension
# Creates a zip file ready for Chrome Web Store upload

set -e

# Configuration
EXTENSION_NAME="focus-reader"
BUILD_DIR="build"
OUTPUT_NAME="${EXTENSION_NAME}"

# Files required for the extension (only runtime files)
REQUIRED_FILES=(
  "manifest.json"
  "background.js"
  "content.js"
  "detector.js"
)

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building ${EXTENSION_NAME}...${NC}"

# Get script directory (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="${SCRIPT_DIR}/${EXTENSION_NAME}"
BUILD_PATH="${SCRIPT_DIR}/${BUILD_DIR}"

# Check source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
  echo -e "${RED}Error: Source directory not found: ${SOURCE_DIR}${NC}"
  exit 1
fi

# Get version from manifest.json
VERSION=$(grep -o '"version": *"[^"]*"' "${SOURCE_DIR}/manifest.json" | cut -d'"' -f4)
if [ -z "$VERSION" ]; then
  echo -e "${RED}Error: Could not read version from manifest.json${NC}"
  exit 1
fi

echo -e "Version: ${YELLOW}${VERSION}${NC}"

# Clean previous build
rm -rf "${BUILD_PATH}"
mkdir -p "${BUILD_PATH}/${EXTENSION_NAME}"

# Copy required files
echo "Copying files..."
for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "${SOURCE_DIR}/${file}" ]; then
    cp "${SOURCE_DIR}/${file}" "${BUILD_PATH}/${EXTENSION_NAME}/"
    echo "  ✓ ${file}"
  else
    echo -e "${RED}  ✗ ${file} (not found)${NC}"
    exit 1
  fi
done

# Copy icons directory if it exists
if [ -d "${SOURCE_DIR}/icons" ]; then
  cp -r "${SOURCE_DIR}/icons" "${BUILD_PATH}/${EXTENSION_NAME}/"
  echo "  ✓ icons/"
fi

# Create zip file
ZIP_FILE="${SCRIPT_DIR}/${OUTPUT_NAME}-v${VERSION}.zip"
rm -f "$ZIP_FILE"

cd "${BUILD_PATH}"
if command -v zip &> /dev/null; then
  zip -r "$ZIP_FILE" "${EXTENSION_NAME}"
elif command -v powershell.exe &> /dev/null; then
  # WSL fallback using PowerShell
  WIN_BUILD_PATH=$(wslpath -w "${BUILD_PATH}/${EXTENSION_NAME}")
  WIN_ZIP_PATH=$(wslpath -w "$ZIP_FILE")
  powershell.exe -Command "Compress-Archive -Path '${WIN_BUILD_PATH}' -DestinationPath '${WIN_ZIP_PATH}' -Force"
else
  echo -e "${RED}Error: Neither 'zip' nor PowerShell available. Install zip: sudo apt install zip${NC}"
  exit 1
fi
cd "$SCRIPT_DIR"

# Clean up build directory
rm -rf "${BUILD_PATH}"

# Show result
FILE_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
echo ""
echo -e "${GREEN}Build complete!${NC}"
echo -e "Output: ${YELLOW}${ZIP_FILE}${NC}"
echo -e "Size: ${FILE_SIZE}"
echo ""
echo "Ready for Chrome Web Store upload."
