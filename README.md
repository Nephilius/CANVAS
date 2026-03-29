# Canvas Studio

Canvas Studio is a premium desktop visual thinking system for illustrators, concept artists, art directors, thumbnail designers, and visual researchers. It combines an infinite board, structured frames, quick sketching, color extraction, floating reference overlays, and session-based organization into one focused creative workspace.

It is not a painting app and not a Photoshop replacement. It is built to help artists collect references quickly, compare directions visually, connect ideas spatially, mark up boards fast, and keep visual thinking moving without friction.

Made by Nephilius, free for everyone.

## Product Summary

Canvas Studio acts like a creative intelligence workspace:

- gather references from files and clipboard paste
- arrange them on an infinite canvas with frames, notes, swatches, sketches, and structured groupings
- connect frames and references with curved visual strings
- inspect color, mood, and composition faster with built-in palette extraction
- keep a floating always-on-top image reference visible while working in other software
- preserve sessions cleanly so boards can be reopened later

## Current Features

### Visual Boarding

- Infinite canvas with smooth pan and zoom
- Marquee selection and multi-select
- Frame / section items for organizing ideas spatially
- Notes, sticky notes, headers, checklist cards, swatches, PDFs, and image items
- Connector strings between frames and references
- Snap to grid and snap to nearby objects
- Alignment guides during movement
- Container-style frame transforms that move and scale contained items

### Reference Ingestion

- File picker import with multi-file selection
- Clipboard image paste
- Bulk-friendly local asset caching
- Stable preview rendering after restart

Current note:

- Drag-drop from Explorer is intentionally disabled in the current release while the packaged Electron drop path is being rebuilt for reliability

Supported image formats end to end:

- PNG
- JPG / JPEG
- WEBP
- GIF
- BMP
- SVG
- ICO

Additional asset support:

- PDF preview items

### Color Intelligence

- Base Palette extraction with 4 dominant colors
- Expanded palette extraction with 8, 12, 16, or 24 colors
- Real swatch items added to the board
- Hex labels with contrast-aware text
- Color-changing for non-image references and connector strings

### Quick Draw

- Board-level sketch layer
- Mouse and pen input
- Smooth anti-aliased strokes
- Adjustable color, brush size, and smoothing
- Undo / redo and persistence for completed strokes

### Overlay Workflow

- Focus Overlay Mode for image items
- Separate frameless always-on-top overlay window
- Top bar drags the window
- Image area supports pan and zoom
- Lock / unlock for image transform inside the overlay
- Opacity control
- Pass-through mode for interacting with apps behind the overlay
- `Ctrl+Shift+X` safety toggle for recovering from pass-through mode

### Sessions and Persistence

- New Session flow creates a fresh project session in the current workspace
- Save session file and reopen it later
- Autosave for in-app state
- Crash report text files written to a dedicated crash-reports folder

### Desktop Utilities

- Custom right-click menus on board, items, and image items
- Undo / redo command history
- Multi-window support
- Manual `.zip` patch installer
- Portable and installer Windows build outputs

## Tech Stack

- Electron
- React
- TypeScript
- Zustand
- sql.js
- Vite
- Vitest

Electron is used here because the app needs Windows-native filesystem access, clipboard integration, floating overlay windows, portable packaging, and patching support in one desktop shell.

## Repository Layout

```text
M:\CANVAS
|- electron/      Main process, preload bridge, storage, patching, overlay windows
|- shared/        Shared domain types and IPC contracts
|- src/
|  |- app/        Shells and top-level application flows
|  |- components/ Shared UI building blocks
|  |- features/   Canvas, items, inspector, context menu, assets, search
|  |- state/      Zustand store and history wiring
|  |- styles/     App styling
|  |- utils/      Shared renderer utilities
|- docs/          Product notes, architecture, release notes, repo guidance
|- scripts/       Build and release helpers
|- tests/         Vitest coverage
|- release/       Portable builds and versioned patch packages
```

Useful docs:

- [Product Description](./docs/product-description.md)
- [Feature List](./docs/feature-list.md)
- [Repository Guide](./docs/repository-guide.md)
- [Architecture Blueprint](./docs/architecture.md)
- [Patch Format](./docs/patch-format.md)
- [Changelog](./CHANGELOG.md)
- [Release Notes Index](./docs/release-notes/README.md)

## Development

Install and run locally:

```powershell
npm install
npm run dev
```

Useful commands:

```powershell
npm run typecheck
npm test
npm run build
npm run pack
npm run dist:portable
npm run dist:installer
npm run dist:release
npm run create:patch -- 0.1.6
```

## Releases

Portable release output:

- `release/Canvas-Studio-Portable-0.1.6.exe`

Installer release output:

- `release/Canvas-Studio-Setup-0.1.6.exe`

Patch outputs:

- `release/patches/<version>/`

GitHub distribution:

- Attach both `Canvas-Studio-Portable-<version>.exe` and `Canvas-Studio-Setup-<version>.exe` to GitHub Releases
- The repo includes a GitHub Actions workflow for building and uploading both Windows artifacts on release tags

## Git Readiness

The repo is prepared for git with:

- `.gitignore` for dependencies, builds, runtime state, and release artifacts
- `.gitattributes` for predictable line endings and binary handling
- `.editorconfig` for consistent editor behavior
- versioned release notes and a changelog for cleaner release history

## Status

Canvas Studio is in active product build-out. The app is already usable, and the codebase is structured so future work can extend the board, overlay, library, export, and intelligence systems without a rewrite.
