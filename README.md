# Canvas Studio

I made this because I was tired of juggling 5 different tools just to manage references. Canvas Studio is a focused desktop app where you can drop images, organize ideas, grab colors, and keep a floating reference on screen while you work. It is still a work in progress, but already meant to be useful. Made by Nephilius, free for everyone.

Canvas Studio is a premium desktop visual thinking system for illustrators, concept artists, art directors, thumbnail designers, and visual researchers. It combines freeform infinite boards, fast reference ingestion, color intelligence, session-based organization, and floating overlay reference viewing into one focused Windows app.

This is not a painting app and not a Photoshop alternative. It is built to help creative teams collect references quickly, compare directions visually, organize moodboards spatially, extract useful palettes, annotate intent, and keep creative thinking moving without friction.

## Product Description

Canvas Studio acts like a creative intelligence workspace:

- gather references from files, folders, drag-drop, and clipboard paste
- arrange them on an infinite canvas with frames, notes, swatches, and structured groupings
- inspect color, mood, and composition faster with built-in palette extraction
- keep a floating always-on-top image reference visible while working in other software
- preserve project sessions cleanly so boards stay available when you return

## Current Features

### Visual Boarding

- Infinite canvas with smooth pan and zoom
- Marquee selection and multi-select
- Frame / section items for organizing ideas spatially
- Notes, sticky notes, headers, checklist cards, swatches, PDFs, and image items
- Snap to grid and snap to nearby objects
- Alignment guides during movement
- Perspective grid overlays with 1-point, 2-point, and 3-point modes

### Reference Ingestion

- Drag and drop from Windows Explorer
- File picker import
- Clipboard image paste
- Bulk-friendly local asset caching
- Stable asset metadata and preview persistence after restart

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
- Autosave
- Restore of structured local app state
- Crash report text files written to a dedicated crash-reports folder

### Desktop Utilities

- Custom right-click menus on board, items, and image items
- Undo / redo command history
- Manual patch installer for `.zip` patch packages
- Portable Windows build output

## Tech Stack

- Electron
- React
- TypeScript
- Zustand
- sql.js
- Vite
- Vitest

Electron is used here because the current workspace is already set up and shipping successfully with Windows-native filesystem, clipboard, patching, overlay windows, and packaging support.

## Repository Layout

```text
M:\CANVAS
|- electron/      Main process, preload bridge, patching, storage, crash handling
|- shared/        Shared types, IPC contracts, import rules
|- src/
|  |- app/        Shells and top-level app flows
|  |- components/ Reusable UI pieces
|  |- features/   Canvas, items, inspector, context menu, assets
|  |- state/      Zustand app store and command history wiring
|  |- styles/     Premium dark UI styling
|  |- utils/      Shared renderer utilities
|- docs/          Product, architecture, patch, and repo notes
|- scripts/       Build and release helpers
|- tests/         Vitest coverage for geometry, history, imports, patch validation
|- release/       Portable builds and versioned patches
```

More detail:

- [Product Description](M:\CANVAS\docs\product-description.md)
- [Feature List](M:\CANVAS\docs\feature-list.md)
- [Repository Guide](M:\CANVAS\docs\repository-guide.md)
- [Architecture Blueprint](M:\CANVAS\docs\architecture.md)
- [Patch Format](M:\CANVAS\docs\patch-format.md)
- [Changelog](M:\CANVAS\CHANGELOG.md)

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
npm run create:patch -- 0.1.5
```

## Releases

Portable release output:

- [Canvas-Studio-Portable-0.1.5.exe](M:\CANVAS\release\Canvas-Studio-Portable-0.1.5.exe)

Latest patch output:

- [canvas-studio-patch-0.1.5.zip](M:\CANVAS\release\patches\0.1.5\canvas-studio-patch-0.1.5.zip)

## Git Readiness

The repo is prepared for git with:

- `.gitignore` for dependencies, builds, runtime state, and release artifacts
- `.gitattributes` for predictable line endings and binary handling
- `.editorconfig` for consistent editor behavior
- a lightweight docs structure so the project is understandable from the first commit

## Status

Canvas Studio is in active product build-out. The foundation is already usable and the codebase is structured so future work can extend the board, overlay, library, export, and intelligence systems without a rewrite.
