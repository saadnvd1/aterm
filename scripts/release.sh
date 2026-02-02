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

# Verify required env vars
for var in APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Missing required env var: $var${NC}"
        exit 1
    fi
done

# Clean old bundle to ensure fresh build
rm -rf src-tauri/target/release/bundle

# Build the app with Tauri (embeds frontend and creates bundle)
echo -e "${YELLOW}Building app...${NC}"
npm run tauri build

APP_PATH="src-tauri/target/release/bundle/macos/aTerm.app"

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Build failed - no .app bundle found${NC}"
    exit 1
fi

# Sign the app
echo -e "${YELLOW}Signing app...${NC}"
codesign --force --deep --sign "$APPLE_SIGNING_IDENTITY" \
    --options runtime \
    --entitlements src-tauri/Entitlements.plist \
    "$APP_PATH"

# Verify signature
echo -e "${YELLOW}Verifying app signature...${NC}"
codesign --verify --verbose "$APP_PATH"
if [ $? -ne 0 ]; then
    echo -e "${RED}App signature verification failed!${NC}"
    exit 1
fi

# Create DMG
DMG_DIR="src-tauri/target/release/bundle/dmg"
DMG_PATH="${DMG_DIR}/aTerm_${VERSION}_aarch64.dmg"

echo -e "${YELLOW}Creating DMG...${NC}"
mkdir -p "$DMG_DIR"
rm -f "$DMG_PATH"
hdiutil create -volname "aTerm" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"

# Sign the DMG
echo -e "${YELLOW}Signing DMG...${NC}"
codesign --force --sign "$APPLE_SIGNING_IDENTITY" "$DMG_PATH"

# Notarize the DMG
echo -e "${YELLOW}Notarizing DMG (this may take a few minutes)...${NC}"
NOTARIZE_OUTPUT=$(xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait 2>&1)

echo "$NOTARIZE_OUTPUT"

# Check if notarization succeeded
if echo "$NOTARIZE_OUTPUT" | grep -q "status: Accepted"; then
    echo -e "${GREEN}Notarization successful!${NC}"
else
    echo -e "${RED}Notarization failed!${NC}"
    # Get the submission ID and fetch the log
    SUBMISSION_ID=$(echo "$NOTARIZE_OUTPUT" | grep "id:" | head -1 | awk '{print $2}')
    if [ -n "$SUBMISSION_ID" ]; then
        echo -e "${YELLOW}Fetching notarization log...${NC}"
        xcrun notarytool log "$SUBMISSION_ID" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_PASSWORD" \
            --team-id "$APPLE_TEAM_ID"
    fi
    exit 1
fi

# Staple the notarization ticket
echo -e "${YELLOW}Stapling notarization ticket...${NC}"
xcrun stapler staple "$DMG_PATH"
if [ $? -ne 0 ]; then
    echo -e "${RED}Stapling failed!${NC}"
    exit 1
fi

# Verify the stapled DMG
echo -e "${YELLOW}Verifying notarization...${NC}"
spctl --assess --type open --context context:primary-signature -v "$DMG_PATH"
if [ $? -ne 0 ]; then
    echo -e "${RED}DMG verification failed - not properly notarized!${NC}"
    exit 1
fi

echo -e "${GREEN}DMG built, signed, and notarized: ${DMG_PATH}${NC}"

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
