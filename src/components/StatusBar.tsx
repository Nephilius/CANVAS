interface StatusBarProps {
  zoom: number;
  selectionCount: number;
  saveState: string;
  lastSavedAt: string | null;
  message?: string;
  credit?: string;
}

export const StatusBar = ({
  zoom,
  selectionCount,
  saveState,
  lastSavedAt,
  message,
  credit
}: StatusBarProps) => (
  <footer className="status-bar">
    <span>{Math.round(zoom * 100)}% zoom</span>
    <span>{selectionCount} selected</span>
    <span>{message ?? "Ready"}</span>
    <span>{saveState === "saved" && lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : saveState}</span>
    {credit ? <span className="status-credit">{credit}</span> : null}
  </footer>
);
