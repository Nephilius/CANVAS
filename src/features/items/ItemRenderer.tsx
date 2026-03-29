import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Asset, Item } from "../../../shared/domain";
import { toAssetUrl } from "../../utils/assets";

interface ItemRendererProps {
  item: Item;
  asset?: Asset;
  selected: boolean;
  zoom: number;
  frameChildCount?: number;
}

export const ItemRenderer = ({ item, asset, selected, zoom, frameChildCount = 0 }: ItemRendererProps) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const baseStyle = { width: "100%", height: "100%", opacity: item.opacity };
  const textScale = Math.max(0.82, Math.min(1.55, zoom));
  const imageSrc = useMemo(
    () => (asset?.cachedPath ? toAssetUrl(asset.cachedPath) : ""),
    [asset?.cachedPath]
  );
  const imageFit =
    item.type === "image" && item.metadata.fitMode === "contain" ? "contain" : "cover";

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

  if (item.type === "pdf") {
    return (
      <div className={clsx("board-card pdf-card", selected && "is-selected")} style={baseStyle}>
        <div className="board-card-eyebrow">PDF</div>
        <h4>{item.content.label}</h4>
        <p>{asset?.originalPath.split("\\").at(-1) ?? "Document"}</p>
      </div>
    );
  }

  if (item.type === "link") {
    return (
      <div className={clsx("board-card link-card", selected && "is-selected")} style={baseStyle}>
        <div className="board-card-eyebrow">Link</div>
        <h4>{item.content.label}</h4>
        <p>{item.content.url}</p>
      </div>
    );
  }

  if (item.type === "swatch") {
    return (
      <div className={clsx("board-card swatch-card", selected && "is-selected")} style={baseStyle}>
        <div className="swatch-preview" style={{ background: item.content.color }} />
        <strong>{item.content.name}</strong>
        <span>{item.content.hex}</span>
      </div>
    );
  }

  if (item.type === "checklist") {
    return (
      <div
        className={clsx("board-card checklist-card", selected && "is-selected")}
        style={{ ...baseStyle, fontSize: `${15 * textScale}px` }}
      >
        <div className="board-card-eyebrow">Checklist</div>
        <h4>{item.content.title}</h4>
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
      <div className={clsx("board-frame-card", selected && "is-selected")} style={baseStyle}>
        <div className="frame-header" style={{ fontSize: `${13 * textScale}px` }}>
          <span>{item.content.label}</span>
        </div>
        <div className="frame-meta">
          <strong>{frameChildCount}</strong>
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
        fontSize:
          item.type === "title"
            ? `${40 * Math.max(0.78, Math.min(1.35, zoom))}px`
            : `${15 * textScale}px`
      }}
    >
      <p>{item.content.text}</p>
    </div>
  );
};
