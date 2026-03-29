interface HelpDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
}

const shortcuts = [
  ["Ctrl+N", "Create a new board"],
  ["Ctrl+O", "Import files"],
  ["Ctrl+S", "Save now"],
  ["Ctrl+Z", "Undo"],
  ["Ctrl+Shift+Z", "Redo"],
  ["Ctrl+D", "Duplicate selection"],
  ["Delete", "Delete selection"],
  ["Ctrl+K", "Command palette"],
  ["Space", "Pan canvas"],
  ["F", "Fit board to content"],
  ["Arrow keys", "Nudge selection"]
];

export const HelpDialog = ({ open, title, onClose }: HelpDialogProps) => {
  if (!open) return null;
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel help-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-row">
          <h3>{title}</h3>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="shortcut-list">
          {shortcuts.map(([keys, label]) => (
            <div key={keys} className="shortcut-row">
              <kbd>{keys}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
