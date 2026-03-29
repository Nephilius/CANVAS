# Changelog

## 0.1.6

- Converted releases to portable-first Windows delivery and standardized the local release flow around the portable executable
- Refined the top toolbar into a flatter Photoshop-style menu strip instead of large pill buttons
- Added left and right rail collapse / restore controls with compact collapsed states
- Added multi-window support through `Open New Window`
- Added inline text editing directly on the canvas for frames, notes, titles, checklists, and swatches
- Added container behavior for frames so moving or resizing a frame can move and scale contained references
- Added Quick Draw board sketching with smoothing, custom colors, brush size, and undo / redo integration
- Added connector strings between references and frames with selectable line color
- Added compact icon rendering for non-image references when zoomed far out
- Added plain session file save / open flow for reopening work later
- Added Clear Session with confirmation and removed the visible perspective grid workflow
- Improved pen / Windows Ink handling for draw mode
- Fixed sql.js wasm runtime loading for packaged portable builds
- Improved import feedback and file picker behavior, while disabling broken drag-drop until it is reworked safely
- Documented that drag-drop is intentionally paused in this release because packaged Explorer drop handling was not reliable enough yet

## 0.1.5

- Added Focus Overlay Mode for image items with a separate always-on-top reference window
- Added image transform controls inside the overlay: pan, zoom, reset, lock / unlock
- Added pass-through mode so the overlay can stay visible while clicks go to other software
- Expanded board-level visual intelligence work around palettes, frames, snapping, and reference study workflows
- Switched the release strategy toward portable-first Windows output

## 0.1.4

- Published a clean current installer base to avoid patching from older unstable installs
- Rebuilt the installation baseline so users could move off older broken patch paths

## 0.1.3

- Expanded image import coverage across common desktop formats
- Added the New Session flow
- Added custom right-click menus on boards and items
- Added image palette extraction into real swatch items on the board
- Added stronger submenu behavior for the color extraction menu

## 0.1.2

- Improved patch staging and update progress behavior
- Added clearer update state messaging and more visible install progress feedback

## 0.1.1

- Introduced manual `.zip` patching support
- Added patch validation, staging, and restart handoff support

## 0.1.0

- Initial production slice with the desktop shell, workspace and project model, board canvas, import pipeline, inspector, autosave, and command history
