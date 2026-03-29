# GitHub Release Setup

Canvas Studio currently ships as a portable Windows build.

## Recommended public download format

- `Canvas-Studio-Portable-<version>.exe`

This is the cleanest distribution format for GitHub because it avoids installer complexity and matches the current release strategy in the app.

## Release flow

1. Bump the app version locally.
2. Build the portable release.
3. Create a Git tag like `v0.1.6`.
4. Push the tag.
5. Let GitHub Actions build and attach the portable artifact to the release.

## Current note about drag-drop

Explorer drag-drop is intentionally disabled in the current release because the packaged Electron drop path was not stable enough yet. Stable import paths remain:

- file picker import
- clipboard image paste

## Files users should download

- `Canvas-Studio-Portable-<version>.exe`

## Optional future expansion

If you later want both installer and portable options on GitHub, the release workflow can be expanded to build a second Windows target. For now, portable-only keeps the release path simpler and more reliable.
