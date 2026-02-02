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

2. **If the release already exists**, the version needs to be bumped first:
   - Update version in `src-tauri/tauri.conf.json`
   - Update version in `src-tauri/Cargo.toml`
   - Commit with `chore: bump version to X.Y.Z`
   - Then run the release script

3. **If the script fails**, you can manually:
   - Build: `npm run tauri build`
   - Create release: `gh release create v{VERSION} --title "aTerm v{VERSION}" --generate-notes src-tauri/target/release/bundle/dmg/aTerm_{VERSION}_aarch64.dmg`

## Requirements

- Apple signing credentials in `src-tauri/.env.local`
- `gh` CLI authenticated
- Version already bumped in config files

## Example

User: "cut a new release"
Action: Run `./scripts/release.sh` and report the result
