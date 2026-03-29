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
  | "set-color-neutral"
  | "set-color-gold"
  | "set-color-blue"
  | "set-color-emerald"
  | "set-color-rose"
  | "set-color-violet"
  | "set-color-charcoal"
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
    ...(item.type === "connector" ? [] : ([{ id: "rename", label: "Rename" }] as ContextMenuEntry[])),
    { id: "duplicate", label: "Duplicate" },
    { id: "delete", label: "Delete" },
    { id: "bring-forward", label: "Bring Forward" },
    { id: "send-backward", label: "Send Backward" },
    { id: "toggle-lock", label: item.locked ? "Unlock" : "Lock" }
  ];

  if (item.type === "connector") {
    return [
      ...common,
      {
        id: "set-color-neutral",
        label: "Change String Color",
        children: [
          { id: "set-color-neutral", label: "Neutral" },
          { id: "set-color-gold", label: "Gold" },
          { id: "set-color-blue", label: "Blue" },
          { id: "set-color-emerald", label: "Emerald" },
          { id: "set-color-rose", label: "Rose" },
          { id: "set-color-violet", label: "Violet" },
          { id: "set-color-charcoal", label: "Charcoal" }
        ]
      }
    ];
  }

  if (item.type !== "image") {
    return [
      ...common,
      {
        id: "set-color-neutral",
        label: "Change Color",
        children: [
          { id: "set-color-neutral", label: "Neutral" },
          { id: "set-color-gold", label: "Gold" },
          { id: "set-color-blue", label: "Blue" },
          { id: "set-color-emerald", label: "Emerald" },
          { id: "set-color-rose", label: "Rose" },
          { id: "set-color-violet", label: "Violet" },
          { id: "set-color-charcoal", label: "Charcoal" }
        ]
      }
    ];
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
