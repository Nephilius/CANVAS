import { useEffect, useRef, useState } from "react";
import type { ContextMenuActionId, ContextMenuEntry } from "../features/context-menu/menuDefinitions";

interface ContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  items: ContextMenuEntry[];
  onClose: () => void;
  onSelect: (id: ContextMenuActionId) => void;
}

const CLOSE_DELAY_MS = 150;

const MenuBranch = ({
  items,
  onSelect
}: {
  items: ContextMenuEntry[];
  onSelect: (id: ContextMenuActionId) => void;
}) => {
  const [openChild, setOpenChild] = useState<string | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const hoverParentRef = useRef<string | null>(null);
  const hoverSubmenuRef = useRef<string | null>(null);

  const cancelClose = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = (label: string) => {
    cancelClose();
    closeTimeoutRef.current = window.setTimeout(() => {
      if (hoverParentRef.current !== label && hoverSubmenuRef.current !== label) {
        setOpenChild((current) => (current === label ? null : current));
      }
      closeTimeoutRef.current = null;
    }, CLOSE_DELAY_MS);
  };

  useEffect(
    () => () => {
      cancelClose();
    },
    []
  );

  return (
    <div className="context-menu-list">
      {items.map((item) => {
        const isOpen = item.children && openChild === item.label;

        return (
          <div
            key={`${item.id}-${item.label}`}
            className="context-menu-item-shell"
            onMouseEnter={() => {
              if (!item.children) return;
              hoverParentRef.current = item.label;
              cancelClose();
              setOpenChild(item.label);
            }}
            onMouseLeave={() => {
              if (!item.children) return;
              if (hoverParentRef.current === item.label) {
                hoverParentRef.current = null;
              }
              scheduleClose(item.label);
            }}
          >
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                if (!item.children) {
                  onSelect(item.id);
                }
              }}
            >
              <span>{item.label}</span>
              {item.children ? <small>&rsaquo;</small> : null}
            </button>
            {isOpen ? (
              <div
                className="context-submenu"
                onMouseEnter={() => {
                  hoverSubmenuRef.current = item.label;
                  cancelClose();
                  setOpenChild(item.label);
                }}
                onMouseLeave={() => {
                  if (hoverSubmenuRef.current === item.label) {
                    hoverSubmenuRef.current = null;
                  }
                  scheduleClose(item.label);
                }}
              >
                <MenuBranch items={item.children ?? []} onSelect={onSelect} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export const ContextMenu = ({
  open,
  position,
  items,
  onClose,
  onSelect
}: ContextMenuProps) => {
  if (!open) return null;

  return (
    <div className="context-menu-backdrop" onClick={onClose}>
      <div
        className="context-menu"
        style={{ left: position.x, top: position.y }}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuBranch
          items={items}
          onSelect={(id) => {
            onSelect(id);
            onClose();
          }}
        />
      </div>
    </div>
  );
};
