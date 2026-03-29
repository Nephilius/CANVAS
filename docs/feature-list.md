# Feature List

## Core Canvas

- Infinite board canvas with smooth navigation
- Mouse-based pan and zoom
- Multi-selection and marquee selection
- Moveable items with snapping and alignment feedback
- Frame items for structuring boards into directions, ideas, and mood clusters

## Board Content

- Image items
- Notes and sticky notes
- Headers / title cards
- Checklist cards
- Color swatch cards
- PDF preview items
- Link-oriented content cards

## Reference Ingestion

- Drag and drop imports
- File picker import
- Clipboard image paste
- Local asset caching for persistence across restarts
- Metadata-aware asset records

Supported image formats:

- PNG
- JPG / JPEG
- WEBP
- GIF
- BMP
- SVG
- ICO

Other supported visual assets:

- PDF previews

## Color Intelligence

- Base Palette extraction with 4 colors
- Expanded extracted palettes in 8, 12, 16, and 24 color sets
- Swatch creation directly on the board
- Hex labels for design workflow use

## Spatial Intelligence

- Snap to grid
- Snap to nearby objects
- Alignment guides
- Perspective grid overlays:
  - 1-point
  - 2-point
  - 3-point

## Overlay Workflow

- Focus Overlay Mode for selected image items
- Separate always-on-top floating reference window
- Frameless presentation with minimal controls
- Window drag area in the top bar
- Image pan and zoom inside the overlay
- Lock / unlock for image transform
- Pass-through mode for interacting with applications behind the overlay
- Reset view and opacity control

## Project and Session Flow

- New Session creates a fresh project session in the current workspace
- Autosave-backed local persistence
- Return to existing projects and boards

## Contextual Actions

- Custom right-click menus on the board background
- Custom right-click menus on items
- Image-specific right-click tools for swatch extraction and overlay mode

## Stability and Delivery

- Crash report text logs written to user data
- Manual `.zip` patch installer
- Portable Windows release output
- Typechecked and tested codebase
