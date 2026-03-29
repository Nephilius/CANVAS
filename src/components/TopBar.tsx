interface TopBarProps {
  projectTitle: string;
  boardTitle: string;
  onQuickAdd: (kind: "note" | "sticky" | "title" | "checklist" | "swatch" | "frame") => void;
  onImport: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onNewSession: () => void;
}

export const TopBar = ({
  projectTitle,
  boardTitle,
  onQuickAdd,
  onImport,
  onOpenPalette,
  onOpenSettings,
  onNewSession
}: TopBarProps) => (
  <header className="top-bar">
    <div>
      <span className="panel-label">{projectTitle}</span>
      <h2>{boardTitle}</h2>
    </div>
    <div className="toolbar-actions">
      <button type="button" className="toolbar-button" onClick={onNewSession}>
        New Session
      </button>
      <button type="button" className="toolbar-button" onClick={() => onQuickAdd("note")}>
        Note
      </button>
      <button type="button" className="toolbar-button" onClick={() => onQuickAdd("sticky")}>
        Sticky
      </button>
      <button type="button" className="toolbar-button" onClick={() => onQuickAdd("frame")}>
        Frame
      </button>
      <button type="button" className="toolbar-button" onClick={onImport}>
        Import
      </button>
      <button type="button" className="toolbar-button accent" onClick={onOpenPalette}>
        Command
      </button>
      <button type="button" className="toolbar-button" onClick={onOpenSettings}>
        Settings
      </button>
    </div>
  </header>
);
