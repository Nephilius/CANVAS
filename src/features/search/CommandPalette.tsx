import { useMemo } from "react";
import type { Board } from "../../../shared/domain";

export interface PaletteAction {
  id: string;
  title: string;
  hint: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  query: string;
  boards: Board[];
  onQueryChange: (value: string) => void;
  onClose: () => void;
  actions: PaletteAction[];
}

export const CommandPalette = ({
  open,
  query,
  boards,
  onQueryChange,
  onClose,
  actions
}: CommandPaletteProps) => {
  const normalized = query.trim().toLowerCase();
  const entries = useMemo(() => {
    const boardEntries = boards.map((board) => ({
      id: board.id,
      title: board.title,
      hint: "Board",
      run: () => undefined
    }));
    return [...actions, ...boardEntries].filter((entry) =>
      !normalized ? true : `${entry.title} ${entry.hint}`.toLowerCase().includes(normalized)
    );
  }, [actions, boards, normalized]);

  if (!open) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel palette-panel" onClick={(event) => event.stopPropagation()}>
        <input
          className="palette-input"
          autoFocus
          placeholder="Search boards, notes, and commands"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="palette-results">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="palette-row"
              onClick={() => {
                entry.run();
                onClose();
              }}
            >
              <span>{entry.title}</span>
              <small>{entry.hint}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
