# Architecture Blueprint

## Visual Thesis

Canvas Studio should feel like a premium creative workstation: dark, dense, calm, and spatially focused. The canvas remains the dominant surface, while navigation and inspector panels stay quiet and precise.

## Shell Choice

Electron is used instead of Tauri for this repo because the current environment does not have Rust tooling installed. Electron lets us keep momentum without compromising on Windows-native filesystem, clipboard, drag/drop, or future packaging support.

## Rendering Strategy

- DOM + CSS transforms for the first canvas slice
- Absolute-positioned items on an infinite plane
- Pointer-driven pan/zoom and marquee selection
- Command/state separation so high-volume item rendering can later migrate to canvas/WebGL without rewriting the domain model

Why this now:

- Faster to make production-usable quickly
- Good enough for the first board scale
- Keeps interaction logic explicit and testable

Future path:

- Virtualization of off-screen items
- Dedicated canvas layer for large boards
- Optional thumbnail and PDF preview workers

## Persistence Model

- Structured entities are stored in a local SQLite-compatible database via `sql.js`
- Main process owns persistence and filesystem access
- Renderer works against typed app snapshots
- Autosave flushes current app state back to disk after meaningful mutations

The schema is migration-friendly: workspace, project, board, item, asset, and app settings are versioned separately.

## State Model

- Zustand store for application state and actions
- Command history stores reversible mutations for undo/redo
- UI state is separated from persisted domain state
- Selection, viewport, panels, and command palette are ephemeral

## Asset Pipeline

- Imports originate in the renderer through drag/drop or clipboard paste
- Electron main copies assets into an app-managed cache directory
- Asset records keep original path, cached path, hash, dimensions, and metadata
- Duplicate detection is hash-driven

## Feature Boundaries

- `src/features/workspaces`: workspace and app bootstrap
- `src/features/projects`: project shell and navigation
- `src/features/boards`: board viewport, canvas, and interactions
- `src/features/items`: item definitions and renderers
- `src/features/assets`: import and cache behaviors
- `src/features/inspector`: selection-aware inspector
- `src/features/commands`: undo/redo command system
- `src/features/search`: command/search overlay

## Quality Guardrails

- No fake data beyond initial first-launch seed creation
- Every visible control must be wired
- App must stay typechecked and runnable after each milestone
