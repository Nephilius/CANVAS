import type { Asset, Board, Item, WorkspaceSettings } from "../../../shared/domain";

interface InspectorPanelProps {
  item: Item | null;
  asset?: Asset;
  board: Board;
  settings: WorkspaceSettings;
  onTextChange: (value: string) => void;
  onMetadataChange: (metadata: Record<string, string | number | boolean | null>) => void;
  onStyleChange: (style: Record<string, string | number | boolean>) => void;
  onOpacityChange: (value: number) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
  onBoardChange: (board: Partial<Board>) => void;
  onSettingsChange: (settings: Partial<WorkspaceSettings>) => void;
  onRelinkAsset: (assetId: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export const InspectorPanel = ({
  item,
  asset,
  board,
  settings,
  onTextChange,
  onMetadataChange,
  onStyleChange,
  onOpacityChange,
  onSizeChange,
  onBoardChange,
  onSettingsChange,
  onRelinkAsset,
  collapsed,
  onToggleCollapsed
}: InspectorPanelProps) => (
  <aside className={collapsed ? "inspector-rail is-collapsed" : "inspector-rail"}>
    <div className="rail-toggle-row">
      <span className="panel-label">{collapsed ? "Board" : item ? "Inspector" : "Board"}</span>
      <button
        className="ghost-button rail-toggle-button"
        onClick={onToggleCollapsed}
        type="button"
        aria-label={collapsed ? "Expand right panel" : "Collapse right panel"}
        title={collapsed ? "Expand right panel" : "Collapse right panel"}
      >
        {collapsed ? "<<" : ">>"}
      </button>
    </div>

    {collapsed ? (
      <div className="collapsed-rail-content collapsed-rail-content-right">
        <button className="collapsed-rail-chip active" onClick={onToggleCollapsed} type="button">
          <span>{item ? item.type.slice(0, 2).toUpperCase() : "BR"}</span>
        </button>
      </div>
    ) : (
      <>
        {item ? (
          <>
            <div className="panel-section">
              <span className="panel-label">Selection</span>
              <h3>{item.type}</h3>
              <p className="feature-caption">
                {Math.round(item.x)}, {Math.round(item.y)}
              </p>
            </div>

            {"text" in item.content || "label" in item.content || "title" in item.content ? (
              <div className="panel-section">
                <span className="panel-label">Content</span>
                <textarea
                  value={
                    "text" in item.content
                      ? item.content.text
                      : "label" in item.content
                        ? item.content.label
                        : item.content.title
                  }
                  onChange={(event) => onTextChange(event.target.value)}
                />
              </div>
            ) : null}

            {item.type !== "connector" ? (
              <div className="panel-section">
                <span className="panel-label">Transform</span>
                <div className="size-grid">
                  <label className="field">
                    <span>Width</span>
                    <input
                      type="number"
                      value={Math.round(item.width)}
                      onChange={(event) =>
                        onSizeChange({ width: Number(event.target.value), height: item.height })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Height</span>
                    <input
                      type="number"
                      value={Math.round(item.height)}
                      onChange={(event) =>
                        onSizeChange({ width: item.width, height: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}

            <div className="panel-section">
              <span className="panel-label">Appearance</span>
              {item.type === "swatch" ? (
                <label className="field">
                  <span>Swatch color</span>
                  <div className="swatch-color-field">
                    <input
                      className="swatch-color-input"
                      type="color"
                      value={item.content.color}
                      onChange={(event) => onStyleChange({ fillColor: event.target.value })}
                    />
                    <span className="swatch-color-value">{item.content.hex}</span>
                  </div>
                </label>
              ) : null}
              {item.type === "connector" ? (
                <label className="field">
                  <span>String color</span>
                  <input
                    type="color"
                    value={String(item.style.strokeColor ?? "#D5B66F")}
                    onChange={(event) => onStyleChange({ strokeColor: event.target.value })}
                  />
                </label>
              ) : null}
              <label className="field">
                <span>Opacity</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={item.opacity}
                  onChange={(event) => onOpacityChange(Number(event.target.value))}
                />
              </label>

              {item.type === "image" ? (
                <label className="field">
                  <span>Image fit</span>
                  <select
                    className="inspector-select"
                    value={String(item.metadata.fitMode ?? "cover")}
                    onChange={(event) => onMetadataChange({ fitMode: event.target.value })}
                  >
                    <option value="cover">Cover frame</option>
                    <option value="contain">Contain fully</option>
                  </select>
                </label>
              ) : null}

              {asset ? (
                <div className="asset-card">
                  <p className="meta-copy">{asset.originalPath}</p>
                  <button type="button" className="toolbar-button subtle" onClick={() => onRelinkAsset(asset.id)}>
                    Relink asset
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="panel-section">
              <span className="panel-label">Board</span>
              <h3>{board.title}</h3>
              <p className="feature-caption">
                {settings.showGrid ? "Grid visible" : "Board overlays hidden"}
              </p>
            </div>

            <div className="panel-section">
              <span className="panel-label">Navigation Grid</span>
              <label className="field checkbox-field">
                <input
                  type="checkbox"
                  checked={settings.showGrid}
                  onChange={(event) => onSettingsChange({ showGrid: event.target.checked })}
                />
                <span>Show grid by default</span>
              </label>
              <label className="field checkbox-field">
                <input
                  type="checkbox"
                  checked={settings.snapToGrid}
                  onChange={(event) => onSettingsChange({ snapToGrid: event.target.checked })}
                />
                <span>Snap to grid</span>
              </label>
              <label className="field checkbox-field">
                <input
                  type="checkbox"
                  checked={settings.snapToObjects}
                  onChange={(event) => onSettingsChange({ snapToObjects: event.target.checked })}
                />
                <span>Snap to nearby objects</span>
              </label>
            </div>
            <div className="panel-section">
              <span className="panel-label">Preferences</span>
              <label className="field">
                <span>Autosave delay</span>
                <input
                  type="range"
                  min="200"
                  max="2000"
                  step="100"
                  value={settings.autosaveMs}
                  onChange={(event) => onSettingsChange({ autosaveMs: Number(event.target.value) })}
                />
              </label>
            </div>
          </>
        )}
      </>
    )}
  </aside>
);
