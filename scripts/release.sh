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

# Build (allow DMG bundling to fail, we'll create it manually)
echo -e "${YELLOW}Building and signing...${NC}"
npm run tauri build || true

# Check if .app was created
APP_PATH="src-tauri/target/release/bundle/macos/aTerm.app"
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Build failed - no .app bundle found${NC}"
    exit 1
fi

# Create DMG manually if it doesn't exist
DMG_DIR="src-tauri/target/release/bundle/dmg"
DMG_PATH="${DMG_DIR}/aTerm_${VERSION}_aarch64.dmg"

if [ ! -f "$DMG_PATH" ]; then
    echo -e "${YELLOW}Creating DMG manually...${NC}"
    mkdir -p "$DMG_DIR"

    # Create DMG with hdiutil
    hdiutil create -volname "aTerm" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"

    # Sign the DMG
    echo -e "${YELLOW}Signing DMG...${NC}"
    codesign --force --sign "$APPLE_SIGNING_IDENTITY" "$DMG_PATH"
fi

if [ ! -f "$DMG_PATH" ]; then
    echo -e "${RED}No DMG found!${NC}"
    exit 1
fi

echo -e "${GREEN}Built: ${DMG_PATH}${NC}"

# Generate changelog from commits since last release
echo -e "${YELLOW}Generating changelog...${NC}"
LAST_VERSION_COMMIT=$(git log --oneline --grep="bump version to" | head -2 | tail -1 | cut -d' ' -f1)
CHANGELOG=""
if [ -n "$LAST_VERSION_COMMIT" ]; then
    while IFS= read -r line; do
        MSG=$(echo "$line" | cut -d' ' -f2-)
        if [[ "$MSG" == feat:* ]]; then
            CHANGELOG="${CHANGELOG}- ${MSG#feat: }"$'\n'
        elif [[ "$MSG" == fix:* ]]; then
            CHANGELOG="${CHANGELOG}- ${MSG#fix: }"$'\n'
        elif [[ "$MSG" != docs:* ]] && [[ "$MSG" != chore:* ]]; then
            CHANGELOG="${CHANGELOG}- ${MSG}"$'\n'
        fi
    done < <(git log ${LAST_VERSION_COMMIT}..HEAD --oneline --no-merges | grep -v "chore: bump version")
fi
[ -z "$CHANGELOG" ] && CHANGELOG="- Initial release"

# Create release
echo -e "${YELLOW}Creating GitHub release...${NC}"
NOTES="## What's Changed

${CHANGELOG}
### Download
- **macOS (Apple Silicon)**: $(basename "$DMG_PATH")

Signed and notarized for macOS."

gh release create "v${VERSION}" \
    --title "aTerm v${VERSION}" \
    --notes "$NOTES" \
    "$DMG_PATH"

echo -e "${GREEN}Released: https://github.com/saadnvd1/aterm/releases/tag/v${VERSION}${NC}"
