import { useEffect, useMemo, useRef, useState } from "react";
import type { AppSnapshot, Asset, Board, Item, WorkspaceSettings } from "../../../shared/domain";
import {
  type AlignmentGuide,
  boardToScreen,
  clampZoom,
  clientToBoard,
  getSelectionBounds,
  itemToScreenRect,
  rectsIntersect,
  resizeItemBounds,
  snapRectToGrid,
  snapRectToItems,
  type ResizeHandle
} from "./geometry";
import { ItemRenderer } from "../items/ItemRenderer";

interface BoardCanvasProps {
  snapshot: AppSnapshot;
  board: Board;
  settings: WorkspaceSettings;
  items: Item[];
  assetsById: Map<string, Asset>;
  selectedItemIds: string[];
  onSelectItems: (ids: string[]) => void;
  onViewportChange: (viewport: Board["viewport"]) => void;
  onApplyLiveSelectionDelta: (delta: { x: number; y: number }) => void;
  onApplyLiveItemBounds: (
    itemId: string,
    bounds: Partial<Pick<Item, "x" | "y" | "width" | "height">>
  ) => void;
  onCommitInteraction: (label: string, before: AppSnapshot) => void;
  onCreateNote: (position: { x: number; y: number }) => void;
  onImportAt: (paths: string[], position: { x: number; y: number }) => void;
  onOpenBoardContextMenu: (payload: {
    screen: { x: number; y: number };
    board: { x: number; y: number };
  }) => void;
  onOpenItemContextMenu: (payload: {
    screen: { x: number; y: number };
    board: { x: number; y: number };
    item: Item;
  }) => void;
}

type Interaction =
  | { mode: "idle" }
  | { mode: "pan"; lastX: number; lastY: number }
  | {
      mode: "drag";
      before: AppSnapshot;
      startBoardX: number;
      startBoardY: number;
      originBounds: { x: number; y: number; width: number; height: number } | null;
      selectionIds: string[];
      lastDx: number;
      lastDy: number;
      changed: boolean;
    }
  | {
      mode: "resize";
      before: AppSnapshot;
      itemId: string;
      handle: ResizeHandle;
      originItem: Item;
      startBoardX: number;
      startBoardY: number;
      changed: boolean;
      preserveAspect: boolean;
    }
  | {
      mode: "marquee";
      startBoardX: number;
      startBoardY: number;
      currentBoardX: number;
      currentBoardY: number;
    };

const handles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export const BoardCanvas = ({
  snapshot,
  board,
  settings,
  items,
  assetsById,
  selectedItemIds,
  onSelectItems,
  onViewportChange,
  onApplyLiveSelectionDelta,
  onApplyLiveItemBounds,
  onCommitInteraction,
  onCreateNote,
  onImportAt,
  onOpenBoardContextMenu,
  onOpenItemContextMenu
}: BoardCanvasProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<Interaction>({ mode: "idle" });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<{ x: number; y: number } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const selectedItem =
    selectedItemIds.length === 1 ? items.find((item) => item.id === selectedItemIds[0]) ?? null : null;
  const selectedScreenRect = useMemo(
    () => (selectedItem ? itemToScreenRect(selectedItem, board.viewport) : null),
    [board.viewport, selectedItem]
  );
  const frameChildCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const frames = items.filter((item) => item.type === "frame");
    frames.forEach((frame) => {
      counts.set(
        frame.id,
        items.filter(
          (candidate) =>
            candidate.id !== frame.id &&
            candidate.x >= frame.x &&
            candidate.y >= frame.y + 44 &&
            candidate.x + candidate.width <= frame.x + frame.width &&
            candidate.y + candidate.height <= frame.y + frame.height
        ).length
      );
    });
    return counts;
  }, [items]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      setCanvasSize({ width: element.clientWidth, height: element.clientHeight });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (interaction.mode === "idle") return;

      if (interaction.mode === "pan") {
        setAlignmentGuides([]);
        onViewportChange({
          ...board.viewport,
          x: board.viewport.x + (event.clientX - interaction.lastX),
          y: board.viewport.y + (event.clientY - interaction.lastY)
        });
        setInteraction({ mode: "pan", lastX: event.clientX, lastY: event.clientY });
        return;
      }

      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const boardPoint = clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport);

      if (interaction.mode === "drag") {
        const rawDx = boardPoint.x - interaction.startBoardX;
        const rawDy = boardPoint.y - interaction.startBoardY;
        let snappedDx = rawDx;
        let snappedDy = rawDy;
        let nextGuides: AlignmentGuide[] = [];

        if (interaction.originBounds) {
          const candidate = {
            x: interaction.originBounds.x + rawDx,
            y: interaction.originBounds.y + rawDy,
            width: interaction.originBounds.width,
            height: interaction.originBounds.height
          };
          const gridSnap = snapRectToGrid(candidate, settings.snapToGrid);
          const objectSnap = snapRectToItems(
            {
              ...candidate,
              x: gridSnap.x,
              y: gridSnap.y
            },
            items
              .filter((item) => !interaction.selectionIds.includes(item.id))
              .map((item) => ({
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height
              })),
            settings.snapToObjects
          );
          snappedDx = objectSnap.x - interaction.originBounds.x;
          snappedDy = objectSnap.y - interaction.originBounds.y;
          nextGuides = [...gridSnap.guides, ...objectSnap.guides];
        }

        setAlignmentGuides(nextGuides);
        onApplyLiveSelectionDelta({
          x: snappedDx - interaction.lastDx,
          y: snappedDy - interaction.lastDy
        });
        setInteraction({
          ...interaction,
          lastDx: snappedDx,
          lastDy: snappedDy,
          changed: true
        });
        return;
      }

      if (interaction.mode === "resize") {
        setAlignmentGuides([]);
        const nextBounds = resizeItemBounds(
          interaction.originItem,
          interaction.handle,
          {
            x: boardPoint.x - interaction.startBoardX,
            y: boardPoint.y - interaction.startBoardY
          },
          {
            lockAspectRatio: interaction.preserveAspect
          }
        );
        onApplyLiveItemBounds(interaction.itemId, nextBounds);
        setInteraction({ ...interaction, changed: true });
        return;
      }

      const next = { ...interaction, currentBoardX: boardPoint.x, currentBoardY: boardPoint.y };
      setAlignmentGuides([]);
      setInteraction(next);
      const marquee = {
        x: Math.min(next.startBoardX, next.currentBoardX),
        y: Math.min(next.startBoardY, next.currentBoardY),
        width: Math.abs(next.currentBoardX - next.startBoardX),
        height: Math.abs(next.currentBoardY - next.startBoardY)
      };
      onSelectItems(
        items
          .filter((item) =>
            rectsIntersect(marquee, {
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height
            })
          )
          .map((item) => item.id)
      );
    };

    const up = () => {
      if (interaction.mode === "drag" && interaction.changed) {
        onCommitInteraction("Move selection", interaction.before);
      }
      if (interaction.mode === "resize" && interaction.changed) {
        onCommitInteraction("Resize item", interaction.before);
      }
      setAlignmentGuides([]);
      setInteraction({ mode: "idle" });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [
    board.viewport,
    interaction,
    items,
    onApplyLiveItemBounds,
    onApplyLiveSelectionDelta,
    onCommitInteraction,
    onSelectItems,
    onViewportChange
  ]);

  const marquee =
    interaction.mode === "marquee"
      ? {
          start: boardToScreen(
            { x: interaction.startBoardX, y: interaction.startBoardY },
            board.viewport
          ),
          current: boardToScreen(
            { x: interaction.currentBoardX, y: interaction.currentBoardY },
            board.viewport
          )
        }
      : null;

  const perspectiveLines = useMemo(() => {
    if (!board.perspectiveGrid.visible || board.perspectiveGrid.mode === "none" || !canvasSize.width || !canvasSize.height) {
      return [];
    }

    const { width, height } = canvasSize;
    const horizonY = height * board.perspectiveGrid.horizon;
    const sideOffset = width * (0.7 + board.perspectiveGrid.intensity);
    const topOffset = height * (0.55 + board.perspectiveGrid.intensity * 0.45);
    const vpCenter = { x: width / 2, y: horizonY };
    const vpLeft = { x: -sideOffset, y: horizonY };
    const vpRight = { x: width + sideOffset, y: horizonY };
    const vpTop = { x: width / 2, y: -topOffset };
    const bottomSamples = Array.from({ length: 8 }, (_, index) => (index / 7) * width);
    const sideSamples = Array.from({ length: 5 }, (_, index) => (index / 4) * height);
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; strong?: boolean }> = [];

    if (board.perspectiveGrid.mode === "1-point") {
      bottomSamples.forEach((x, index) => {
        lines.push({ x1: x, y1: height, x2: vpCenter.x, y2: vpCenter.y, strong: index === 3 || index === 4 });
      });
    }

    if (board.perspectiveGrid.mode === "2-point" || board.perspectiveGrid.mode === "3-point") {
      sideSamples.forEach((y, index) => {
        lines.push({ x1: 0, y1: y, x2: vpRight.x, y2: vpRight.y, strong: index === 2 });
        lines.push({ x1: width, y1: y, x2: vpLeft.x, y2: vpLeft.y, strong: index === 2 });
      });
      bottomSamples.forEach((x, index) => {
        lines.push({ x1: x, y1: height, x2: vpLeft.x, y2: vpLeft.y, strong: index === 2 });
        lines.push({ x1: x, y1: height, x2: vpRight.x, y2: vpRight.y, strong: index === 5 });
      });
    }

    if (board.perspectiveGrid.mode === "3-point") {
      bottomSamples.forEach((x, index) => {
        lines.push({ x1: x, y1: height, x2: vpTop.x, y2: vpTop.y, strong: index === 3 || index === 4 });
      });
    }

    return lines;
  }, [board.perspectiveGrid, canvasSize]);

  return (
    <div
      ref={containerRef}
      className={board.showGrid ? "board-canvas-shell with-grid" : "board-canvas-shell"}
      style={{
        backgroundSize: `${Math.max(48, board.viewport.zoom * 80)}px ${Math.max(48, board.viewport.zoom * 80)}px`,
        backgroundPosition: `${board.viewport.x}px ${board.viewport.y}px`
      }}
      onWheel={(event) => {
        event.preventDefault();
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const localPoint = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top
        };
        const boardPoint = clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport);
        const nextZoom = clampZoom(board.viewport.zoom * (event.deltaY < 0 ? 1.08 : 0.92));
        onViewportChange({
          zoom: nextZoom,
          x: localPoint.x - boardPoint.x * nextZoom,
          y: localPoint.y - boardPoint.y * nextZoom
        });
      }}
      onPointerDown={(event) => {
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const boardPoint = clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport);
        if (event.button === 2) {
          onSelectItems([]);
          return;
        }
        if (event.button === 1 || spaceHeld) {
          setInteraction({ mode: "pan", lastX: event.clientX, lastY: event.clientY });
          return;
        }
        if (event.detail === 2) {
          onCreateNote(boardPoint);
          return;
        }
        onSelectItems([]);
        setInteraction({
          mode: "marquee",
          startBoardX: boardPoint.x,
          startBoardY: boardPoint.y,
          currentBoardX: boardPoint.x,
          currentBoardY: boardPoint.y
        });
      }}
      onDragOver={(event) => {
        event.preventDefault();
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        setDropIndicator(clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport));
      }}
      onDragLeave={() => setDropIndicator(null)}
      onDrop={(event) => {
        event.preventDefault();
        const paths = Array.from(event.dataTransfer.files)
          .map((file) => (file as File & { path?: string }).path)
          .filter(Boolean) as string[];
        if (paths.length && dropIndicator) onImportAt(paths, dropIndicator);
        setDropIndicator(null);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        onOpenBoardContextMenu({
          screen: { x: event.clientX, y: event.clientY },
          board: clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport)
        });
      }}
    >
      {items.map((item) => {
        const position = boardToScreen({ x: item.x, y: item.y }, board.viewport);
        return (
          <div
            key={item.id}
            className="board-node"
            style={{
              transform: `translate(${Math.round(position.x)}px, ${Math.round(position.y)}px) rotate(${item.rotation}deg)`,
              width: Math.max(1, item.width * board.viewport.zoom),
              height: Math.max(1, item.height * board.viewport.zoom),
              zIndex: item.zIndex
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              const bounds = containerRef.current?.getBoundingClientRect();
              if (!bounds) return;
              if (event.button === 2) {
                onSelectItems([item.id]);
                return;
              }
              const point = clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport);
              const nextSelection = event.shiftKey
                ? [...new Set([...selectedItemIds, item.id])]
                : [item.id];
              onSelectItems(nextSelection);
              if (item.locked) return;
              const originBounds =
                getSelectionBounds(
                  snapshot.items.filter((candidate) => nextSelection.includes(candidate.id))
                ) ?? null;
              setInteraction({
                mode: "drag",
                before: structuredClone(snapshot),
                startBoardX: point.x,
                startBoardY: point.y,
                originBounds,
                selectionIds: nextSelection,
                lastDx: 0,
                lastDy: 0,
                changed: false
              });
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const bounds = containerRef.current?.getBoundingClientRect();
              if (!bounds) return;
              onSelectItems([item.id]);
              onOpenItemContextMenu({
                screen: { x: event.clientX, y: event.clientY },
                board: clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport),
                item
              });
            }}
          >
            <ItemRenderer
              item={item}
              asset={"assetId" in item.content ? assetsById.get(item.content.assetId) : undefined}
              selected={selectedItemIds.includes(item.id)}
              zoom={board.viewport.zoom}
              frameChildCount={item.type === "frame" ? frameChildCounts.get(item.id) ?? 0 : undefined}
            />
          </div>
        );
      })}

      {perspectiveLines.length ? (
        <svg className="perspective-grid-layer" width={canvasSize.width} height={canvasSize.height}>
          <line
            x1="0"
            y1={canvasSize.height * board.perspectiveGrid.horizon}
            x2={canvasSize.width}
            y2={canvasSize.height * board.perspectiveGrid.horizon}
            className="perspective-horizon"
          />
          {perspectiveLines.map((line, index) => (
            <line
              key={`${line.x1}-${line.y1}-${line.x2}-${line.y2}-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className={line.strong ? "perspective-line strong" : "perspective-line"}
            />
          ))}
        </svg>
      ) : null}

      {selectedScreenRect && selectedItem ? (
        <div
          className="selection-outline"
          style={{
            transform: `translate(${selectedScreenRect.x}px, ${selectedScreenRect.y}px)`,
            width: selectedScreenRect.width,
            height: selectedScreenRect.height
          }}
        >
          {handles.map((handle) => (
            <button
              key={handle}
              type="button"
              className={`resize-handle handle-${handle}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (selectedItem.locked) return;
                const bounds = containerRef.current?.getBoundingClientRect();
                if (!bounds) return;
                const startBoardPoint = clientToBoard(
                  { x: event.clientX, y: event.clientY },
                  bounds,
                  board.viewport
                );
                setInteraction({
                  mode: "resize",
                  before: structuredClone(snapshot),
                  itemId: selectedItem.id,
                  handle,
                  originItem: structuredClone(selectedItem),
                  startBoardX: startBoardPoint.x,
                  startBoardY: startBoardPoint.y,
                  changed: false,
                  preserveAspect: selectedItem.type === "image" && !event.shiftKey
                });
              }}
            />
          ))}
        </div>
      ) : null}

      {alignmentGuides.map((guide, index) => {
        const screenPosition = boardToScreen(
          guide.orientation === "vertical"
            ? { x: guide.position, y: 0 }
            : { x: 0, y: guide.position },
          board.viewport
        );
        return (
          <div
            key={`${guide.orientation}-${guide.position}-${index}`}
            className={
              guide.orientation === "vertical" ? "alignment-guide vertical" : "alignment-guide horizontal"
            }
            style={
              guide.orientation === "vertical"
                ? { left: screenPosition.x }
                : { top: screenPosition.y }
            }
          />
        );
      })}

      {marquee ? (
        <div
          className="marquee"
          style={{
            transform: `translate(${Math.min(marquee.start.x, marquee.current.x)}px, ${Math.min(
              marquee.start.y,
              marquee.current.y
            )}px)`,
            width: Math.abs(marquee.current.x - marquee.start.x),
            height: Math.abs(marquee.current.y - marquee.start.y)
          }}
        />
      ) : null}

      {dropIndicator ? (
        <div
          className="drop-indicator"
          style={{
            transform: `translate(${board.viewport.x + dropIndicator.x * board.viewport.zoom}px, ${
              board.viewport.y + dropIndicator.y * board.viewport.zoom
            }px)`
          }}
        />
      ) : null}
    </div>
  );
};
