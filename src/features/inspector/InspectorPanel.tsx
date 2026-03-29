import type { Asset, Board, Item, WorkspaceSettings } from "../../../shared/domain";

interface InspectorPanelProps {
  item: Item | null;
  asset?: Asset;
  board: Board;
  settings: WorkspaceSettings;
  onTextChange: (value: string) => void;
  onMetadataChange: (metadata: Record<string, string | number | boolean | null>) => void;
  onOpacityChange: (value: number) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
  onBoardChange: (board: Partial<Board>) => void;
  onSettingsChange: (settings: Partial<WorkspaceSettings>) => void;
  onRelinkAsset: (assetId: string) => void;
}

export const InspectorPanel = ({
  item,
  asset,
  board,
  settings,
  onTextChange,
  onMetadataChange,
  onOpacityChange,
  onSizeChange,
  onBoardChange,
  onSettingsChange,
  onRelinkAsset
}: InspectorPanelProps) => (
  <aside className="inspector-rail">
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

        <div className="panel-section">
          <span className="panel-label">Appearance</span>
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
            {board.perspectiveGrid.visible
              ? `${board.perspectiveGrid.mode} perspective active`
              : settings.showGrid
                ? "Grid visible"
                : "Board overlays hidden"}
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
          <span className="panel-label">Perspective Grid</span>
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={board.perspectiveGrid.visible}
              onChange={(event) =>
                onBoardChange({
                  perspectiveGrid: {
                    ...board.perspectiveGrid,
                    visible: event.target.checked
                  }
                })
              }
            />
            <span>Show perspective guide</span>
          </label>
          <label className="field">
            <span>Mode</span>
            <select
              className="inspector-select"
              value={board.perspectiveGrid.mode}
              onChange={(event) =>
                onBoardChange({
                  perspectiveGrid: {
                    ...board.perspectiveGrid,
                    mode: event.target.value as Board["perspectiveGrid"]["mode"]
                  }
                })
              }
            >
              <option value="none">None</option>
              <option value="1-point">1-point</option>
              <option value="2-point">2-point</option>
              <option value="3-point">3-point</option>
            </select>
          </label>
          <label className="field">
            <span>Horizon</span>
            <input
              type="range"
              min="0.2"
              max="0.8"
              step="0.02"
              value={board.perspectiveGrid.horizon}
              onChange={(event) =>
                onBoardChange({
                  perspectiveGrid: {
                    ...board.perspectiveGrid,
                    horizon: Number(event.target.value)
                  }
                })
              }
            />
          </label>
          <label className="field">
            <span>Perspective spread</span>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={board.perspectiveGrid.intensity}
              onChange={(event) =>
                onBoardChange({
                  perspectiveGrid: {
                    ...board.perspectiveGrid,
                    intensity: Number(event.target.value)
                  }
                })
              }
            />
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
  </aside>
);
