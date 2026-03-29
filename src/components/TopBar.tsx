interface TopBarProps {
  projectTitle: string;
  boardTitle: string;
  onQuickAdd: (kind: "note" | "sticky" | "title" | "checklist" | "swatch" | "frame") => void;
  onOpenSession: () => void;
  onSaveSession: () => void;
  onImport: () => void;
  onToggleConnectorMode: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onNewSession: () => void;
  onClearSession: () => void;
  onOpenNewWindow: () => void;
  drawMode: boolean;
  connectorMode: boolean;
  drawColor: string;
  drawSize: number;
  drawSmoothing: number;
  onToggleDrawMode: () => void;
  onDrawColorChange: (value: string) => void;
  onDrawSizeChange: (value: number) => void;
  onDrawSmoothingChange: (value: number) => void;
}

export const TopBar = ({
  projectTitle,
  boardTitle,
  onQuickAdd,
  onOpenSession,
  onSaveSession,
  onImport,
  onToggleConnectorMode,
  onOpenPalette,
  onOpenSettings,
  onNewSession,
  onClearSession,
  onOpenNewWindow,
  drawMode,
  connectorMode,
  drawColor,
  drawSize,
  drawSmoothing,
  onToggleDrawMode,
  onDrawColorChange,
  onDrawSizeChange,
  onDrawSmoothingChange
}: TopBarProps) => (
  <header className="top-bar">
    <div className="top-bar-meta">
      <span className="panel-label">{projectTitle}</span>
      <h2>{boardTitle}</h2>
    </div>
    <div className="toolbar-strip">
      <div className="toolbar-menu">
        <div className="toolbar-menu-group">
          <span className="toolbar-menu-heading">Session</span>
          <button type="button" className="toolbar-menu-item" onClick={onNewSession}>
            New
          </button>
          <button type="button" className="toolbar-menu-item" onClick={onOpenSession}>
            Open
          </button>
          <button type="button" className="toolbar-menu-item" onClick={onSaveSession}>
            Save
          </button>
          <button type="button" className="toolbar-menu-item danger" onClick={onClearSession}>
            Clear
          </button>
        </div>
        <div className="toolbar-menu-group">
          <span className="toolbar-menu-heading">Create</span>
          <button type="button" className="toolbar-menu-item" onClick={() => onQuickAdd("note")}>
            Note
          </button>
          <button type="button" className="toolbar-menu-item" onClick={() => onQuickAdd("sticky")}>
            Sticky
          </button>
          <button type="button" className="toolbar-menu-item" onClick={() => onQuickAdd("frame")}>
            Frame
          </button>
          <button
            type="button"
            className={`toolbar-menu-item${connectorMode ? " active" : ""}`}
            onClick={onToggleConnectorMode}
          >
            Connector
          </button>
          <button type="button" className="toolbar-menu-item" onClick={onImport}>
            Import
          </button>
        </div>
        <div className="toolbar-menu-group">
          <span className="toolbar-menu-heading">View</span>
          <button type="button" className="toolbar-menu-item" onClick={onOpenNewWindow}>
            Window
          </button>
          <button
            type="button"
            className={`toolbar-menu-item${drawMode ? " active" : ""}`}
            onClick={onToggleDrawMode}
          >
            Draw
          </button>
        </div>
      </div>
      {drawMode ? (
        <div className="draw-toolbar">
          <span className="toolbar-menu-heading">Brush</span>
          <span className="draw-color-preview" style={{ backgroundColor: drawColor }} />
          <input
            className="draw-color-input"
            type="color"
            value={drawColor}
            onChange={(event) => onDrawColorChange(event.target.value)}
            aria-label="Draw color"
          />
          <label className="draw-toolbar-field">
            <span>Size</span>
            <input
              type="range"
              min="1"
              max="32"
              value={drawSize}
              onChange={(event) => onDrawSizeChange(Number(event.target.value))}
            />
            <strong>{drawSize}px</strong>
          </label>
          <label className="draw-toolbar-field">
            <span>Smooth</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={drawSmoothing}
              onChange={(event) => onDrawSmoothingChange(Number(event.target.value))}
            />
            <strong>{Math.round(drawSmoothing * 100)}%</strong>
          </label>
        </div>
      ) : null}
      <div className="toolbar-utilities">
        <button type="button" className="toolbar-menu-item utility accent" onClick={onOpenPalette}>
          Command
        </button>
        <button type="button" className="toolbar-menu-item utility" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </div>
  </header>
);
