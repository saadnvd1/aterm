#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get version from tauri.conf.json
VERSION=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')

echo -e "${YELLOW}Building aTerm v${VERSION}...${NC}"

# Check if release already exists
if gh release view "v${VERSION}" &>/dev/null; then
    echo -e "${RED}Release v${VERSION} already exists!${NC}"
    echo "Update the version in src-tauri/tauri.conf.json and src-tauri/Cargo.toml first."
    exit 1
fi

# Source Apple credentials
if [ -f src-tauri/.env.local ]; then
    source src-tauri/.env.local
else
    echo -e "${RED}Missing src-tauri/.env.local with Apple credentials${NC}"
    exit 1
fi

# Build
echo -e "${YELLOW}Building and signing...${NC}"
npm run tauri build

# Find the DMG
DMG_PATH=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" | head -1)

if [ -z "$DMG_PATH" ]; then
    echo -e "${RED}No DMG found!${NC}"
    exit 1
fi

echo -e "${GREEN}Built: ${DMG_PATH}${NC}"

# Create release
echo -e "${YELLOW}Creating GitHub release...${NC}"
gh release create "v${VERSION}" \
    --title "aTerm v${VERSION}" \
    --notes "## aTerm v${VERSION}

### Download
- **macOS (Apple Silicon)**: \`$(basename "$DMG_PATH")\`

Signed and notarized for macOS." \
    "$DMG_PATH"

echo -e "${GREEN}Released: https://github.com/saadnvd1/aterm/releases/tag/v${VERSION}${NC}"
