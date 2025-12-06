#!/bin/bash

# Deploy Focus Reader Extension to Windows Host
# This script syncs the focus-reader folder to the Windows filesystem for Chrome to load

SOURCE_DIR="/home/roipa/source/chrome-extensions/focus-reader"
TARGET_DIR="/mnt/c/source/chrome-extensions/focus-reader"
WINDOWS_TARGET_DIR="/mnt/c/source/chrome-extensions"

# Files to deploy (only extension-required files)
DEPLOY_FILES=(
    "manifest.json"
    "background.js"
    "content.js"
    "detector.js"
    "settings.js"
)

echo "🚀 Focus Reader Extension - Deploy to Windows"
echo "=============================================="
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory not found: $SOURCE_DIR"
    exit 1
fi

# Create target parent directory if it doesn't exist
if [ ! -d "$WINDOWS_TARGET_DIR" ]; then
    echo "📁 Creating target directory: $WINDOWS_TARGET_DIR"
    mkdir -p "$WINDOWS_TARGET_DIR"
fi

# Remove old target directory if it exists
if [ -d "$TARGET_DIR" ]; then
    echo "🗑️  Removing old deployment: $TARGET_DIR"
    rm -rf "$TARGET_DIR"
fi

# Create target directory
mkdir -p "$TARGET_DIR"

# Copy only the necessary extension files
echo "📦 Copying extension files..."
for file in "${DEPLOY_FILES[@]}"; do
    if [ -f "$SOURCE_DIR/$file" ]; then
        cp "$SOURCE_DIR/$file" "$TARGET_DIR/"
        echo "   ✓ $file"
    else
        echo "   ⚠ Warning: $file not found in source"
    fi
done

# Verify the copy
if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📍 Extension location: $TARGET_DIR"
    echo "🪟 Windows path: C:\\source\\chrome-extensions\\focus-reader"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Open Chrome and navigate to: chrome://extensions/"
    echo "   2. Enable 'Developer mode' (toggle in top-right)"
    echo "   3. Click 'Load unpacked'"
    echo "   4. Select: C:\\source\\chrome-extensions\\focus-reader"
    echo "   5. Or if already loaded, click the 'Reload' button on the extension card"
    echo ""
    echo "💡 Tip: For updates, just run this script again and click 'Reload' in Chrome"
else
    echo "❌ Deployment failed!"
    exit 1
fi

# List deployed files
echo "📄 Deployed files:"
ls -lh "$TARGET_DIR" | tail -n +2 | awk '{printf "   • %-25s %6s\n", $9, $5}'

echo ""
echo "✨ Done!"
