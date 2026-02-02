---
name: release
description: Cut a new release (build, sign, notarize, publish to GitHub)
allowed-tools: Bash, Read, Edit
---

# Release Skill

Use this skill when the user says "cut a release", "release", "cut a new release", "publish a release", or similar.

## What This Skill Does

Automates the full release process for aTerm:
1. Builds the Tauri app (signed and notarized)
2. Creates DMG
3. Generates changelog from commits since last release
4. Creates GitHub release with the DMG attached

## Instructions

When the user asks to cut a release:

1. **Run the release script**:
   ```bash
   ./scripts/release.sh
   ```

2. **If the script says "Release vX.Y.Z already exists"**, automatically:
   - Bump the patch version (e.g., 0.1.8 → 0.1.9) in both:
     - `src-tauri/tauri.conf.json`
     - `src-tauri/Cargo.toml`
   - Commit with `chore: bump version to X.Y.Z`
   - Re-run `./scripts/release.sh`
   - **Do NOT stop or ask the user** - just handle it automatically

3. **If the script fails for other reasons**, you can manually:
   - Build: `npm run tauri build`
   - Create release: `gh release create v{VERSION} --title "aTerm v{VERSION}" --generate-notes src-tauri/target/release/bundle/dmg/aTerm_{VERSION}_aarch64.dmg`

## Requirements

- Apple signing credentials in `src-tauri/.env.local`
- `gh` CLI authenticated
- Version already bumped in config files

## Example

User: "cut a new release"
Action:
1. Run `./scripts/release.sh`
2. If "already exists" error, bump version, commit, and re-run
3. Report the release URL when done
