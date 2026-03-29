import { useEffect, useState } from "react";

interface RenameDialogProps {
  open: boolean;
  initialValue: string;
  title: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export const RenameDialog = ({
  open,
  initialValue,
  title,
  onClose,
  onSubmit
}: RenameDialogProps) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (!open) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel rename-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-label">Rename</div>
        <h3>{title}</h3>
        <input value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
        <div className="patch-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="toolbar-button accent"
            onClick={() => onSubmit(value.trim())}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
