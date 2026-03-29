import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import clsx from "clsx";
import type { Asset, Item } from "../../../shared/domain";
import { toAssetUrl } from "../../utils/assets";

interface ItemRendererProps {
  item: Item;
  asset?: Asset;
  selected: boolean;
  zoom: number;
  frameChildCount?: number;
  editing?: boolean;
  editingValue?: string;
  onEditingValueChange?: (value: string) => void;
  onEditingSubmit?: () => void;
  onEditingCancel?: () => void;
}

const getEditableValue = (item: Item) => {
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

const getCompactLabel = (item: Item) => {
  switch (item.type) {
    case "sticky":
      return "ST";
    case "note":
      return "NT";
    case "title":
      return "TT";
    case "checklist":
      return "CL";
    case "swatch":
      return "SW";
    case "frame":
      return "FR";
    case "pdf":
      return "PDF";
    case "link":
      return "LK";
    default:
      return "IT";
  }
};

export const ItemRenderer = ({
  item,
  asset,
  selected,
  zoom,
  frameChildCount = 0,
  editing = false,
  editingValue,
  onEditingValueChange,
  onEditingSubmit,
  onEditingCancel
}: ItemRendererProps) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const baseStyle = { width: "100%", height: "100%", opacity: item.opacity };
  const textScale = Math.max(0.34, Math.min(1.55, zoom));
  const titleScale = Math.max(0.22, Math.min(1.35, zoom));
  const uiScale = Math.max(0.3, Math.min(1.2, zoom));
  const imageSrc = useMemo(
    () => (asset?.cachedPath ? toAssetUrl(asset.cachedPath) : ""),
    [asset?.cachedPath]
  );
  const imageFit =
    item.type === "image" && item.metadata.fitMode === "contain" ? "contain" : "cover";
  const editableValue = editingValue ?? getEditableValue(item) ?? "";
  const compactMode = zoom < 0.38 && item.type !== "image";
  const fillColor =
    typeof item.style.fillColor === "string" ? item.style.fillColor : undefined;
  const textColor =
    typeof item.style.textColor === "string" ? item.style.textColor : undefined;
  const compactStyle = fillColor
    ? ({
        background: `linear-gradient(180deg, ${fillColor}, ${fillColor})`,
        borderColor: "rgba(255,255,255,0.14)",
        color: textColor ?? "#f4f7fb"
      } as const)
    : undefined;

  useEffect(() => {
    if (!editing) return;
    editorRef.current?.focus();
    editorRef.current?.select();
  }, [editing]);

  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onEditingCancel?.();
      return;
    }
    if (event.key === "Enter" && (item.type === "frame" || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onEditingSubmit?.();
    }
  };

  if (item.type === "image") {
    return (
      <div
        className={clsx("board-item-shell", selected && "is-selected", loadFailed && "is-missing")}
        style={baseStyle}
      >
        {imageSrc && !loadFailed ? (
          <img
            className="board-image"
            src={imageSrc}
            alt={item.content.caption || "Reference"}
            draggable={false}
            style={{ objectFit: imageFit }}
            onError={() => {
              console.error("Failed to load asset", asset);
              setLoadFailed(true);
            }}
          />
        ) : (
          <div className="missing-asset-card">
            <div className="board-card-eyebrow">Missing asset</div>
            <strong>{asset?.originalPath.split("\\").at(-1) ?? "Image unavailable"}</strong>
            <button
              type="button"
              className="inline-action"
              onClick={(event) => {
                event.stopPropagation();
                setLoadFailed(false);
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  if (item.type === "connector") {
    return null;
  }

  if (compactMode) {
    return (
      <div
        className={clsx("board-card compact-reference-card", selected && "is-selected")}
        style={{ ...baseStyle, ...compactStyle }}
      >
        <span className="compact-reference-icon">{getCompactLabel(item)}</span>
      </div>
    );
  }

  if (item.type === "pdf") {
    return (
      <div
        className={clsx("board-card pdf-card", selected && "is-selected")}
        style={{
          ...baseStyle,
          ...(fillColor
            ? {
                background: `linear-gradient(180deg, ${fillColor}, ${fillColor})`,
                borderColor: "rgba(255,255,255,0.12)",
                color: textColor ?? "#f4f7fb"
              }
            : {}),
          fontSize: `${14 * textScale}px`
        }}
      >
        <div className="board-card-eyebrow" style={{ fontSize: `${11 * uiScale}px` }}>
          PDF
        </div>
        <h4 style={{ fontSize: `${18 * textScale}px` }}>{item.content.label}</h4>
        <p>{asset?.originalPath.split("\\").at(-1) ?? "Document"}</p>
      </div>
    );
  }

  if (item.type === "link") {
    return (
      <div
        className={clsx("board-card link-card", selected && "is-selected")}
        style={{
          ...baseStyle,
          ...(fillColor
            ? {
                background: `linear-gradient(180deg, ${fillColor}, ${fillColor})`,
                borderColor: "rgba(255,255,255,0.12)",
                color: textColor ?? "#f4f7fb"
              }
            : {}),
          fontSize: `${14 * textScale}px`
        }}
      >
        <div className="board-card-eyebrow" style={{ fontSize: `${11 * uiScale}px` }}>
          Link
        </div>
        <h4 style={{ fontSize: `${18 * textScale}px` }}>{item.content.label}</h4>
        <p>{item.content.url}</p>
      </div>
    );
  }

  if (item.type === "swatch") {
    return (
      <div
        className={clsx("board-card swatch-card", selected && "is-selected")}
        style={{
          ...baseStyle,
          ...(fillColor
            ? {
                background: `linear-gradient(180deg, rgba(20, 24, 29, 0.98), rgba(14, 18, 22, 0.98))`,
                borderColor: "rgba(255,255,255,0.12)",
                color: textColor ?? "#f4f7fb"
              }
            : {}),
          fontSize: `${14 * textScale}px`
        }}
      >
        <div className="swatch-preview" style={{ background: fillColor ?? item.content.color }} />
        {editing ? (
          <input
            ref={editorRef as React.RefObject<HTMLInputElement>}
            className="canvas-inline-input"
            value={editableValue}
            onChange={(event) => onEditingValueChange?.(event.target.value)}
            onBlur={() => onEditingSubmit?.()}
            onKeyDown={handleEditorKeyDown}
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <strong style={{ fontSize: `${18 * textScale}px` }}>{item.content.name}</strong>
        )}
        <span style={{ fontSize: `${14 * textScale}px` }}>{item.content.hex}</span>
      </div>
    );
  }

  if (item.type === "checklist") {
    return (
      <div
        className={clsx("board-card checklist-card", selected && "is-selected")}
        style={{
          ...baseStyle,
          ...(fillColor
            ? {
                background: `linear-gradient(180deg, ${fillColor}, ${fillColor})`,
                borderColor: "rgba(255,255,255,0.12)",
                color: textColor ?? "#f4f7fb"
              }
            : {}),
          fontSize: `${15 * textScale}px`
        }}
      >
        <div className="board-card-eyebrow" style={{ fontSize: `${11 * uiScale}px` }}>
          Checklist
        </div>
        {editing ? (
          <input
            ref={editorRef as React.RefObject<HTMLInputElement>}
            className="canvas-inline-input"
            value={editableValue}
            onChange={(event) => onEditingValueChange?.(event.target.value)}
            onBlur={() => onEditingSubmit?.()}
            onKeyDown={handleEditorKeyDown}
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <h4 style={{ fontSize: `${18 * textScale}px` }}>{item.content.title}</h4>
        )}
        <ul>
          {item.content.items.map((entry) => (
            <li key={entry.id} className={entry.done ? "done" : undefined}>
              {entry.text}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (item.type === "frame") {
    return (
      <div
        className={clsx("board-frame-card", selected && "is-selected")}
        style={{
          ...baseStyle,
          ...(fillColor
            ? {
                background: `${fillColor}1C`,
                borderColor: `${fillColor}99`,
                color: textColor ?? "#f4f7fb"
              }
            : {}),
          fontSize: `${14 * textScale}px`
        }}
      >
        <div
          className="frame-header"
          style={{
            fontSize: `${13 * textScale}px`,
            background: fillColor ? `${fillColor}33` : undefined
          }}
        >
          {editing ? (
            <input
              ref={editorRef as React.RefObject<HTMLInputElement>}
              className="canvas-inline-input frame-inline-input"
              value={editableValue}
              onChange={(event) => onEditingValueChange?.(event.target.value)}
              onBlur={() => onEditingSubmit?.()}
              onKeyDown={handleEditorKeyDown}
              onPointerDown={(event) => event.stopPropagation()}
            />
          ) : (
            <span>{item.content.label}</span>
          )}
        </div>
        <div className="frame-meta" style={{ fontSize: `${13 * textScale}px` }}>
          <strong style={{ fontSize: `${18 * textScale}px` }}>{frameChildCount}</strong>
          <span>{frameChildCount === 1 ? "reference inside" : "references inside"}</span>
        </div>
      </div>
    );
  }

  const cardClass =
    item.type === "sticky" ? "sticky-card" : item.type === "title" ? "title-card" : "note-card";

  return (
    <div
      className={clsx("board-card", cardClass, selected && "is-selected")}
      style={{
        ...baseStyle,
        ...(fillColor
          ? {
              background:
                item.type === "title"
                  ? "transparent"
                  : `linear-gradient(180deg, ${fillColor}, ${fillColor})`,
              borderColor: item.type === "title" ? "transparent" : "rgba(255,255,255,0.12)",
              color: textColor ?? "#f4f7fb"
            }
          : {}),
        fontSize:
          item.type === "title"
            ? `${40 * titleScale}px`
            : `${15 * textScale}px`
      }}
    >
      {editing ? (
        <textarea
          ref={editorRef as React.RefObject<HTMLTextAreaElement>}
          className={clsx("canvas-inline-textarea", item.type === "title" && "canvas-inline-title")}
          value={editableValue}
          onChange={(event) => onEditingValueChange?.(event.target.value)}
          onBlur={() => onEditingSubmit?.()}
          onKeyDown={handleEditorKeyDown}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : (
        <p>{item.content.text}</p>
      )}
    </div>
  );
};
