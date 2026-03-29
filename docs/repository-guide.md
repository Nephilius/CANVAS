# Repository Guide

This repo is organized around a desktop-first Electron architecture with a typed shared domain and a feature-oriented renderer structure.

## Top Level

- `electron/`
  - Main process entrypoint
  - Preload bridge
  - Local storage and schema upgrades
  - Patch install and crash logging flows

- `shared/`
  - Shared domain models
  - IPC contract types
  - Shared import format rules

- `src/`
  - Renderer application

- `docs/`
  - Product and architecture references

- `scripts/`
  - Build and release helper scripts

- `tests/`
  - Vitest coverage for important logic

- `release/`
  - Generated portable executables and versioned patch packages

## Renderer Structure

- `src/app/`
  - Main application shell
  - Focus Overlay Mode shell

- `src/components/`
  - Shared interface components such as dialogs, menu surfaces, and layout chrome

- `src/features/`
  - Feature folders for boards, items, assets, inspector, and contextual interaction

- `src/state/`
  - Zustand store and history-aware actions

- `src/styles/`
  - Global authored styling for the product UI

- `src/utils/`
  - Renderer helpers such as asset URL utilities

## Release Notes

- Portable builds are the primary Windows release target
- Patch zips are grouped by version under `release/patches/<version>/`
- Build artifacts are ignored by git

## Recommended Git Workflow

1. Initialize repo
2. Review ignored files with `git status`
3. Commit docs and source together as the first baseline
4. Keep releases and local runtime state out of source control
