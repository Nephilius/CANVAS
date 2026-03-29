import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AppSnapshot,
  Asset,
  Board,
  ConnectorItem,
  Item,
  SketchStroke,
  StrokePoint,
  WorkspaceSettings
} from "../../../shared/domain";
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
  strokes: SketchStroke[];
  assetsById: Map<string, Asset>;
  selectedItemIds: string[];
  drawMode: boolean;
  drawColor: string;
  drawSize: number;
  drawSmoothing: number;
  onSelectItems: (ids: string[]) => void;
  onViewportChange: (viewport: Board["viewport"]) => void;
  onApplyLiveSelectionDelta: (delta: { x: number; y: number }) => void;
  onApplyLiveItemBounds: (
    itemId: string,
    bounds: Partial<Pick<Item, "x" | "y" | "width" | "height">>
  ) => void;
  onCommitInteraction: (label: string, before: AppSnapshot) => void;
  onUpdateItemText: (itemId: string, value: string) => void;
  onCreateNote: (position: { x: number; y: number }) => void;
  connectorSourceItemId: string | null;
  onCreateConnector: (fromItemId: string, toItemId: string) => void;
  onCancelConnector: () => void;
  onAddStroke: (input: {
    boardId: string;
    points: StrokePoint[];
    color: string;
    size: number;
    opacity: number;
    smoothing: number;
  }) => void;
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
      mode: "draw";
      points: StrokePoint[];
      pointerId: number;
    }
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

const buildStrokePath = (
  points: StrokePoint[],
  viewport: Board["viewport"],
  smoothing: number
) => {
  if (!points.length) return "";
  const screenPoints = points.map((point) => boardToScreen(point, viewport));
  if (screenPoints.length === 1) {
    const point = screenPoints[0];
    return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)} L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  if (screenPoints.length === 2) {
    return `M ${screenPoints[0].x.toFixed(2)} ${screenPoints[0].y.toFixed(2)} L ${screenPoints[1].x.toFixed(2)} ${screenPoints[1].y.toFixed(2)}`;
  }

  const tension = 0.18 + smoothing * 0.34;
  let path = `M ${screenPoints[0].x.toFixed(2)} ${screenPoints[0].y.toFixed(2)}`;

  for (let index = 1; index < screenPoints.length - 1; index += 1) {
    const current = screenPoints[index];
    const next = screenPoints[index + 1];
    const controlX = current.x + (next.x - current.x) * tension;
    const controlY = current.y + (next.y - current.y) * tension;
    const endX = (current.x + next.x) / 2;
    const endY = (current.y + next.y) / 2;
    path += ` Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`;
  }

  const last = screenPoints.at(-1)!;
  path += ` T ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return path;
};

const appendPoint = (points: StrokePoint[], point: StrokePoint) => {
  const last = points.at(-1);
  if (!last) return [point];
  const distance = Math.hypot(point.x - last.x, point.y - last.y);
  if (distance < 0.8) {
    return points;
  }
  return [...points, point];
};

const getItemAnchor = (item: Item, toward: { x: number; y: number }) => {
  const centerX = item.x + item.width / 2;
  const centerY = item.y + item.height / 2;
  const dx = toward.x - centerX;
  const dy = toward.y - centerY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: dx >= 0 ? item.x + item.width : item.x,
      y: centerY
    };
  }
  return {
    x: centerX,
    y: dy >= 0 ? item.y + item.height : item.y
  };
};

const getConnectorGeometry = (connector: ConnectorItem, items: Item[], viewport: Board["viewport"]) => {
  const fromItem = items.find((item) => item.id === connector.content.fromItemId);
  const toItem = items.find((item) => item.id === connector.content.toItemId);
  if (!fromItem || !toItem || fromItem.type === "connector" || toItem.type === "connector") {
    return null;
  }

  const fromCenter = { x: fromItem.x + fromItem.width / 2, y: fromItem.y + fromItem.height / 2 };
  const toCenter = { x: toItem.x + toItem.width / 2, y: toItem.y + toItem.height / 2 };
  const startBoard = getItemAnchor(fromItem, toCenter);
  const endBoard = getItemAnchor(toItem, fromCenter);
  const start = boardToScreen(startBoard, viewport);
  const end = boardToScreen(endBoard, viewport);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const curve = Math.max(36, Math.min(180, Math.abs(dx) * 0.35 + Math.abs(dy) * 0.18));
  const controlA = { x: start.x + curve, y: start.y };
  const controlB = { x: end.x - curve, y: end.y };
  const d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${controlA.x.toFixed(2)} ${controlA.y.toFixed(2)} ${controlB.x.toFixed(2)} ${controlB.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;

  return {
    connector,
    start,
    end,
    d,
    stroke: typeof connector.style.strokeColor === "string" ? connector.style.strokeColor : "#D5B66F"
  };
};

const distancePointToSegment = (
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projected = { x: start.x + dx * t, y: start.y + dy * t };
  return Math.hypot(point.x - projected.x, point.y - projected.y);
};

const cubicPoint = (
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) => {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
  };
};

export const BoardCanvas = ({
  snapshot,
  board,
  settings,
  items,
  strokes,
  assetsById,
  selectedItemIds,
  drawMode,
  drawColor,
  drawSize,
  drawSmoothing,
  onSelectItems,
  onViewportChange,
  onApplyLiveSelectionDelta,
  onApplyLiveItemBounds,
  onCommitInteraction,
  onUpdateItemText,
  onCreateNote,
  connectorSourceItemId,
  onCreateConnector,
  onCancelConnector,
  onAddStroke,
  onOpenBoardContextMenu,
  onOpenItemContextMenu
}: BoardCanvasProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<Interaction>({ mode: "idle" });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const connectorItems = useMemo(
    () => items.filter((item): item is ConnectorItem => item.type === "connector"),
    [items]
  );
  const renderableItems = useMemo(() => items.filter((item) => item.type !== "connector"), [items]);

  const selectedItem =
    selectedItemIds.length === 1 ? items.find((item) => item.id === selectedItemIds[0]) ?? null : null;

  const getItemEditValue = (item: Item) => {
    switch (item.type) {
      case "note":
      case "sticky":
      case "title":
        return item.content.text;
      case "checklist":
        return item.content.title;
      case "frame":
        return item.content.label;
      case "link":
        return item.content.label;
      case "pdf":
        return item.content.label;
      case "swatch":
        return item.content.name;
      default:
        return null;
    }
  };

  const commitInlineEdit = () => {
    if (!editingItemId) return;
    const item = items.find((candidate) => candidate.id === editingItemId);
    if (!item) {
      setEditingItemId(null);
      setEditingValue("");
      return;
    }
    const nextValue = editingValue.trim();
    const currentValue = getItemEditValue(item);
    if (currentValue !== null && nextValue && currentValue !== nextValue) {
      onUpdateItemText(item.id, nextValue);
    }
    setEditingItemId(null);
    setEditingValue("");
  };

  const cancelInlineEdit = () => {
    setEditingItemId(null);
    setEditingValue("");
  };

  const selectedScreenRect = useMemo(
    () => (selectedItem ? itemToScreenRect(selectedItem, board.viewport) : null),
    [board.viewport, selectedItem]
  );

  const frameChildCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const frames = renderableItems.filter((item) => item.type === "frame");
    frames.forEach((frame) => {
      counts.set(
        frame.id,
        renderableItems.filter(
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
  }, [renderableItems]);

  const findTopItemAtBoardPoint = (point: { x: number; y: number }, excludeId?: string) =>
    [...items]
      .filter((candidate) => candidate.type !== "connector")
      .filter((candidate) => candidate.id !== excludeId)
      .filter(
        (candidate) =>
          point.x >= candidate.x &&
          point.x <= candidate.x + candidate.width &&
          point.y >= candidate.y &&
          point.y <= candidate.y + candidate.height
      )
      .sort((a, b) => b.zIndex - a.zIndex)[0] ?? null;

  const findConnectorAtScreenPoint = (point: { x: number; y: number }) => {
    const connectors = [...connectorItems]
      .sort((a, b) => b.zIndex - a.zIndex)
      .map((connector) => getConnectorGeometry(connector, renderableItems, board.viewport))
      .filter((geometry): geometry is NonNullable<typeof geometry> => Boolean(geometry));

    for (const geometry of connectors) {
      const dx = geometry.end.x - geometry.start.x;
      const dy = geometry.end.y - geometry.start.y;
      const curve = Math.max(36, Math.min(180, Math.abs(dx) * 0.35 + Math.abs(dy) * 0.18));
      const controlA = { x: geometry.start.x + curve, y: geometry.start.y };
      const controlB = { x: geometry.end.x - curve, y: geometry.end.y };
      let previous = geometry.start;
      for (let index = 1; index <= 24; index += 1) {
        const current = cubicPoint(index / 24, geometry.start, controlA, controlB, geometry.end);
        if (distancePointToSegment(point, previous, current) <= 10) {
          return geometry.connector;
        }
        previous = current;
      }
    }
    return null;
  };

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
    if (!drawMode && interaction.mode === "draw") {
      setInteraction({ mode: "idle" });
    }
  }, [drawMode, interaction.mode]);

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

      if (interaction.mode === "draw") {
        if (event.pointerId !== interaction.pointerId) return;
        setAlignmentGuides([]);
        setInteraction({
          ...interaction,
          points: appendPoint(interaction.points, {
            x: boardPoint.x,
            y: boardPoint.y,
            pressure: event.pointerType === "pen" ? event.pressure : undefined
          })
        });
        return;
      }

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
        renderableItems
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

    const up = (event?: PointerEvent) => {
      if (interaction.mode === "drag" && interaction.changed) {
        onCommitInteraction("Move selection", interaction.before);
      }
      if (interaction.mode === "resize" && interaction.changed) {
        onCommitInteraction("Resize item", interaction.before);
      }
      if (interaction.mode === "draw" && interaction.points.length > 1) {
        onAddStroke({
          boardId: board.id,
          points: interaction.points,
          color: drawColor,
          size: drawSize,
          opacity: 1,
          smoothing: drawSmoothing
        });
        if (event && containerRef.current?.hasPointerCapture(event.pointerId)) {
          containerRef.current.releasePointerCapture(event.pointerId);
        }
      }
      setAlignmentGuides([]);
      setInteraction({ mode: "idle" });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [
    board.id,
    board.viewport,
    drawColor,
    drawSize,
    drawSmoothing,
    interaction,
    items,
    renderableItems,
    onAddStroke,
    onApplyLiveItemBounds,
    onApplyLiveSelectionDelta,
    onCommitInteraction,
    onSelectItems,
    onViewportChange,
    settings.snapToGrid,
    settings.snapToObjects
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

  const strokePaths = useMemo(
    () =>
      strokes.map((stroke) => ({
        id: stroke.id,
        d: buildStrokePath(stroke.points, board.viewport, stroke.smoothing),
        stroke: stroke.color,
        strokeWidth: Math.max(1.2, stroke.size * board.viewport.zoom),
        opacity: stroke.opacity
      })),
    [board.viewport, strokes]
  );

  const connectorPaths = useMemo(
    () =>
      connectorItems
        .map((connector) => getConnectorGeometry(connector, renderableItems, board.viewport))
        .filter((geometry): geometry is NonNullable<typeof geometry> => Boolean(geometry)),
    [board.viewport, connectorItems, renderableItems]
  );

  const draftStrokePath =
    interaction.mode === "draw" && interaction.points.length > 1
      ? {
          d: buildStrokePath(interaction.points, board.viewport, drawSmoothing),
          stroke: drawColor,
          strokeWidth: Math.max(1.2, drawSize * board.viewport.zoom)
        }
      : null;

  return (
    <div
      ref={containerRef}
      className={`${board.showGrid ? "board-canvas-shell with-grid" : "board-canvas-shell"}${drawMode ? " is-draw-mode" : ""}`}
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
        if (editingItemId) {
          commitInlineEdit();
        }
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const boardPoint = clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport);
        const screenPoint = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        const hitConnector = findConnectorAtScreenPoint(screenPoint);
        if (event.button === 2) {
          if (hitConnector) {
            onSelectItems([hitConnector.id]);
            return;
          }
          onSelectItems([]);
          return;
        }
        if (event.button === 1 || spaceHeld) {
          event.preventDefault();
          setInteraction({ mode: "pan", lastX: event.clientX, lastY: event.clientY });
          return;
        }
        if (drawMode) {
          event.preventDefault();
          event.stopPropagation();
          containerRef.current?.setPointerCapture(event.pointerId);
          const nextPoint = {
            x: boardPoint.x,
            y: boardPoint.y,
            pressure: event.pointerType === "pen" ? event.pressure : undefined
          };
          setInteraction({
            mode: "draw",
            points: [nextPoint],
            pointerId: event.pointerId
          });
          return;
        }
        if (event.detail === 2) {
          onCreateNote(boardPoint);
          return;
        }
        if (hitConnector) {
          onSelectItems([hitConnector.id]);
          setInteraction({ mode: "idle" });
          return;
        }
        if (connectorSourceItemId) {
          onCancelConnector();
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
      onContextMenu={(event) => {
        event.preventDefault();
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const screenPoint = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        const hitConnector = findConnectorAtScreenPoint(screenPoint);
        if (hitConnector) {
          onSelectItems([hitConnector.id]);
          onOpenItemContextMenu({
            screen: { x: event.clientX, y: event.clientY },
            board: clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport),
            item: hitConnector
          });
          return;
        }
        onOpenBoardContextMenu({
          screen: { x: event.clientX, y: event.clientY },
          board: clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport)
        });
      }}
    >
      {connectorPaths.length ? (
        <svg className="connector-layer" width={canvasSize.width} height={canvasSize.height}>
          {connectorPaths.map((geometry) => {
            const selected = selectedItemIds.includes(geometry.connector.id);
            return (
              <g key={geometry.connector.id} opacity={geometry.connector.opacity}>
                <path
                  d={geometry.d}
                  fill="none"
                  stroke={geometry.stroke}
                  strokeWidth={selected ? 3.6 : 2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={geometry.start.x} cy={geometry.start.y} r={selected ? 5 : 4} fill={geometry.stroke} />
                <circle cx={geometry.end.x} cy={geometry.end.y} r={selected ? 5 : 4} fill={geometry.stroke} />
              </g>
            );
          })}
        </svg>
      ) : null}

      {renderableItems.map((item) => {
        const position = boardToScreen({ x: item.x, y: item.y }, board.viewport);
        return (
          <div
            key={item.id}
            className="board-node"
            style={{
              transform: `translate(${Math.round(position.x)}px, ${Math.round(position.y)}px) rotate(${item.rotation}deg)`,
              width: Math.max(1, item.width * board.viewport.zoom),
              height: Math.max(1, item.height * board.viewport.zoom),
              zIndex: item.zIndex,
              pointerEvents: drawMode ? "none" : "auto"
            }}
            onPointerDown={(event) => {
              if (editingItemId === item.id || drawMode) return;
              event.stopPropagation();
              const bounds = containerRef.current?.getBoundingClientRect();
              if (!bounds) return;
              const point = clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport);
              const actualItem =
                item.type === "frame" ? findTopItemAtBoardPoint(point, item.id) ?? item : item;
              if (connectorSourceItemId) {
                if (actualItem.id !== connectorSourceItemId) {
                  onCreateConnector(connectorSourceItemId, actualItem.id);
                }
                onCancelConnector();
                return;
              }
              if (event.button === 2) {
                onSelectItems([actualItem.id]);
                return;
              }
              const nextSelection = event.shiftKey
                ? [...new Set([...selectedItemIds, actualItem.id])]
                : [actualItem.id];
              onSelectItems(nextSelection);
              if (actualItem.locked) return;
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
            onDoubleClick={(event) => {
              if (drawMode) return;
              event.preventDefault();
              event.stopPropagation();
              const bounds = containerRef.current?.getBoundingClientRect();
              if (!bounds) return;
              const point = clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport);
              const actualItem =
                item.type === "frame" ? findTopItemAtBoardPoint(point, item.id) ?? item : item;
              const editableValue = getItemEditValue(actualItem);
              if (editableValue === null || actualItem.locked) return;
              onSelectItems([actualItem.id]);
              setEditingItemId(actualItem.id);
              setEditingValue(editableValue);
              setInteraction({ mode: "idle" });
            }}
            onContextMenu={(event) => {
              if (drawMode) return;
              event.preventDefault();
              event.stopPropagation();
              const bounds = containerRef.current?.getBoundingClientRect();
              if (!bounds) return;
              const point = clientToBoard({ x: event.clientX, y: event.clientY }, bounds, board.viewport);
              const actualItem =
                item.type === "frame" ? findTopItemAtBoardPoint(point, item.id) ?? item : item;
              onSelectItems([actualItem.id]);
              onOpenItemContextMenu({
                screen: { x: event.clientX, y: event.clientY },
                board: point,
                item: actualItem
              });
            }}
          >
            <ItemRenderer
              item={item}
              asset={"assetId" in item.content ? assetsById.get(item.content.assetId) : undefined}
              selected={selectedItemIds.includes(item.id)}
              zoom={board.viewport.zoom}
              frameChildCount={item.type === "frame" ? frameChildCounts.get(item.id) ?? 0 : undefined}
              editing={editingItemId === item.id}
              editingValue={editingItemId === item.id ? editingValue : undefined}
              onEditingValueChange={setEditingValue}
              onEditingSubmit={commitInlineEdit}
              onEditingCancel={cancelInlineEdit}
            />
          </div>
        );
      })}

      {strokePaths.length || draftStrokePath ? (
        <svg className="sketch-layer" width={canvasSize.width} height={canvasSize.height}>
          {strokePaths.map((stroke) => (
            <path
              key={stroke.id}
              d={stroke.d}
              fill="none"
              stroke={stroke.stroke}
              strokeWidth={stroke.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={stroke.opacity}
            />
          ))}
          {draftStrokePath ? (
            <path
              d={draftStrokePath.d}
              fill="none"
              stroke={draftStrokePath.stroke}
              strokeWidth={draftStrokePath.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      ) : null}
      {selectedScreenRect && selectedItem && selectedItem.type !== "connector" && !drawMode ? (
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

      {marquee && !drawMode ? (
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
    </div>
  );
};
