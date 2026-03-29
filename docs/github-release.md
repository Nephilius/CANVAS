# GitHub Release Setup

Canvas Studio ships as both a portable Windows build and a Windows installer.

## Recommended public download formats

- `Canvas-Studio-Portable-<version>.exe`
- `Canvas-Studio-Setup-<version>.exe`

This gives users two clear options:

- portable for quick try/run without installation
- installer for a more standard desktop app setup

## Release flow

1. Bump the app version locally.
2. Build the Windows release artifacts.
3. Create a Git tag like `v0.1.6`.
4. Push the tag.
5. Let GitHub Actions build and attach both the portable and installer artifacts to the release.

## Current note about drag-drop

Explorer drag-drop is intentionally disabled in the current release because the packaged Electron drop path was not stable enough yet. Stable import paths remain:

- file picker import
- clipboard image paste

## Files users should download

- `Canvas-Studio-Portable-<version>.exe`
- `Canvas-Studio-Setup-<version>.exe`

## Download guidance

- users who want a no-install executable should download the portable build
- users who want Start Menu / installed-app behavior should download the setup build
