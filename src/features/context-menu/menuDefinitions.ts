import type { Item } from "../../../shared/domain";

export type ContextMenuActionId =
  | "new-note"
  | "new-sticky"
  | "new-frame"
  | "import-image"
  | "fit-view"
  | "reset-view"
  | "rename"
  | "duplicate"
  | "delete"
  | "bring-forward"
  | "send-backward"
  | "toggle-lock"
  | "focus-overlay"
  | "extract-base-palette"
  | "extract-all-8"
  | "extract-all-12"
  | "extract-all-16"
  | "extract-all-24";

export interface ContextMenuEntry {
  id: ContextMenuActionId;
  label: string;
  children?: ContextMenuEntry[];
}

export const buildBoardContextMenu = (): ContextMenuEntry[] => [
  { id: "new-note", label: "New Note" },
  { id: "new-sticky", label: "New Sticky" },
  { id: "new-frame", label: "New Frame" },
  { id: "import-image", label: "Import Image" },
  { id: "fit-view", label: "Fit View" },
  { id: "reset-view", label: "Reset View" }
];

export const buildItemContextMenu = (item: Item): ContextMenuEntry[] => {
  const common: ContextMenuEntry[] = [
    { id: "rename", label: "Rename" },
    { id: "duplicate", label: "Duplicate" },
    { id: "delete", label: "Delete" },
    { id: "bring-forward", label: "Bring Forward" },
    { id: "send-backward", label: "Send Backward" },
    { id: "toggle-lock", label: item.locked ? "Unlock" : "Lock" }
  ];

  if (item.type !== "image") {
    return common;
  }

  return [
    ...common,
    {
      id: "focus-overlay",
      label: "Focus Overlay Mode"
    },
    {
      id: "extract-base-palette",
      label: "Extract Color Swatch",
      children: [
        { id: "extract-base-palette", label: "Base Palette (4 colors)" },
        {
          id: "extract-all-8",
          label: "Extract All Colors",
          children: [
            { id: "extract-all-8", label: "8 colors" },
            { id: "extract-all-12", label: "12 colors" },
            { id: "extract-all-16", label: "16 colors" },
            { id: "extract-all-24", label: "24 colors" }
          ]
        }
      ]
    }
  ];
};
