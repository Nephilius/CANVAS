import { useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "../../shared/domain";
import type { ContextMenuActionId } from "../features/context-menu/menuDefinitions";
import type { PatchProgressState, PatchValidationResult } from "../../shared/ipc";
import { toAssetUrl } from "../utils/assets";
import { FocusOverlayApp } from "./FocusOverlayApp";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { StatusBar } from "../components/StatusBar";
import { HelpDialog } from "../components/HelpDialog";
import { SettingsDialog } from "../components/SettingsDialog";
import { ContextMenu } from "../components/ContextMenu";
import { RenameDialog } from "../components/RenameDialog";
import { InspectorPanel } from "../features/inspector/InspectorPanel";
import { BoardCanvas } from "../features/boards/BoardCanvas";
import { CommandPalette, type PaletteAction } from "../features/search/CommandPalette";
import { createItemsFromImportedAssets, createLinkFromText } from "../features/items/itemFactory";
import { extractPaletteFromAsset } from "../features/assets/colorExtraction";
import {
  buildBoardContextMenu,
  buildItemContextMenu
} from "../features/context-menu/menuDefinitions";
import {
  selectActiveBoard,
  selectActiveProject,
  selectActiveWorkspace,
  selectAssetsById,
  selectBoardItems,
  selectBoardStrokes,
  useAppStore
} from "../state/useAppStore";
import { screenToBoard } from "../features/boards/geometry";

const getItemRenameValue = (item: Item | null) => {
  if (!item) return "";
  if ("text" in item.content) return item.content.text;
  if ("label" in item.content) return item.content.label;
  if ("title" in item.content) return item.content.title;
  if ("name" in item.content) return item.content.name;
  return item.type;
};

export const App = () => {
  const overlayParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const overlayMode = overlayParams?.get("focusOverlay") === "1";

  if (overlayMode) {
    return (
      <FocusOverlayApp
        src={overlayParams?.get("src") ?? ""}
        label={overlayParams?.get("label") ?? "Reference Overlay"}
        initialOpacity={Number(overlayParams?.get("opacity") ?? "0.95")}
      />
    );
  }

  const {
    snapshot,
    selectedItemIds,
    ui,
    bootstrap,
    markSaved,
    markSaving,
    markError,
    updatePalette,
    toggleHelp,
    toggleSettings,
    selectItems,
    createBoard,
    createSessionProject,
    clearSession,
    setActiveProject,
    setActiveBoard,
    updateBoardViewport,
    addQuickItem,
    addImportedContent,
    addConnector,
    addStroke,
    replaceAssetReference,
    moveSelectedItems,
    applyLiveSelectionDelta,
    applyLiveItemBounds,
    pushHistoryEntry,
    updateItemText,
    updateSelectedText,
    updateSelectedMetadata,
    updateSelectedStyle,
    updateSelectedOpacity,
    updateSelectedDimensions,
    renameSelection,
    adjustSelectionZOrder,
    toggleSelectionLock,
    resetActiveBoardView,
    addSwatchPaletteFromColors,
    updateActiveBoard,
    updateWorkspaceSettings,
    deleteSelection,
    duplicateSelection,
    fitActiveBoardToContent,
    undo,
    redo
  } = useAppStore();

  const activeWorkspace = selectActiveWorkspace(snapshot);
  const activeProject = selectActiveProject(snapshot);
  const activeBoard = selectActiveBoard(snapshot);
  const boardItems = selectBoardItems(snapshot, activeBoard.id);
  const boardStrokes = selectBoardStrokes(snapshot, activeBoard.id);
  const assetsById = selectAssetsById(snapshot);
  const selectedItem = snapshot.items.find((item) => selectedItemIds.includes(item.id)) ?? null;
  const autosaveTimeout = useRef<number | null>(null);
  const boardFrameRef = useRef<HTMLDivElement | null>(null);
  const bridgeReady = typeof window !== "undefined" && typeof window.appApi !== "undefined";
  const [appVersion, setAppVersion] = useState("0.0.0");
  const [packagedBuild, setPackagedBuild] = useState(false);
  const [crashReportsPath, setCrashReportsPath] = useState("");
  const [selectedPatchPath, setSelectedPatchPath] = useState<string | null>(null);
  const [installingPatch, setInstallingPatch] = useState(false);
  const [patchProgress, setPatchProgress] = useState<PatchProgressState>({
    phase: "idle",
    percent: 0,
    message: "Select a patch to begin."
  });
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false);
  const [importNotice, setImportNotice] = useState("Ready");
  const [drawMode, setDrawMode] = useState(false);
  const [connectorSourceItemId, setConnectorSourceItemId] = useState<string | null>(null);
  const [drawColor, setDrawColor] = useState("#f3f5f7");
  const [drawSize, setDrawSize] = useState(5);
  const [drawSmoothing, setDrawSmoothing] = useState(0.7);
  const [clearSessionOpen, setClearSessionOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<
    | {
        open: true;
        position: { x: number; y: number };
        boardPoint: { x: number; y: number };
        item?: Item;
      }
    | { open: false }
  >({ open: false });
  const [patchValidation, setPatchValidation] = useState<PatchValidationResult>({
    ok: false,
    filePath: null,
    fileName: null,
    status: "idle",
    message: "Select a .zip patch package to begin validation."
  });

  const getVisibleBoardOrigin = () => {
    const frame = boardFrameRef.current?.getBoundingClientRect();
    if (!frame) {
      return { x: 0, y: 0 };
    }

    const center = screenToBoard(
      { x: frame.width / 2, y: frame.height / 2 },
      activeBoard.viewport
    );

    return {
      x: center.x - 180,
      y: center.y - 120
    };
  };

  useEffect(() => {
    if (!bridgeReady) return;
    window.appApi.getAppVersion().then(({ version, packaged }) => {
      setAppVersion(version);
      setPackagedBuild(packaged);
    });
    window.appApi.getCrashReportsDirectory().then(({ path }) => {
      setCrashReportsPath(path);
    });
    window.appApi.loadSnapshot().then(bootstrap).catch((error) => {
      console.error("Failed to load snapshot", error);
    });
  }, [bootstrap, bridgeReady]);

  useEffect(() => {
    if (!bridgeReady) return;
    return window.appApi.onPatchProgress((progress) => {
      setPatchProgress(progress);
    });
  }, [bridgeReady]);

  if (!bridgeReady) {
    return (
      <div className="startup-shell">
        <div className="startup-card">
          <div className="panel-label">Startup</div>
          <h1>Desktop bridge unavailable</h1>
          <p>The Electron preload API did not initialize, so the app cannot open project data yet.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (ui.saveState !== "dirty") return;
    if (autosaveTimeout.current) window.clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = window.setTimeout(() => {
      markSaving();
      window.appApi
        .saveSnapshot(snapshot)
        .then((result) => markSaved(result.savedAt))
        .catch(() => markError());
    }, activeWorkspace.settings.autosaveMs);

    return () => {
      if (autosaveTimeout.current) window.clearTimeout(autosaveTimeout.current);
    };
  }, [activeWorkspace.settings.autosaveMs, markError, markSaved, markSaving, snapshot, ui.saveState]);

  const handleImportAt = async (paths: string[], origin: { x: number; y: number }) => {
    try {
      const result = await window.appApi.importFiles(paths);
      const { assets, items } = createItemsFromImportedAssets(
        activeBoard.id,
        result.imported,
        snapshot.assets,
        origin
      );
      if (items.length) {
        addImportedContent(assets, items);
        setImportNotice(
          result.rejected.length
            ? `Imported ${items.length} item(s). Skipped ${result.rejected.length} unsupported file(s).`
            : `Imported ${items.length} item(s).`
        );
      } else {
        setImportNotice(
          result.rejected[0]?.reason ??
            "No supported files found. Supported: PNG, JPG, WEBP, GIF, BMP, SVG, ICO, PDF."
        );
      }
    } catch (error) {
      console.error("Failed to import files", error);
      setImportNotice(
        error instanceof Error ? `Import failed: ${error.message}` : "Import failed."
      );
    }
  };

  const handleImportDialog = async (origin = getVisibleBoardOrigin()) => {
    try {
      const paths = await window.appApi.openImportDialog();
      if (!paths.length) {
        setImportNotice("Import cancelled.");
        return;
      }
      await handleImportAt(paths, origin);
    } catch (error) {
      console.error("Failed to open import dialog", error);
      setImportNotice(
        error instanceof Error ? `Import dialog failed: ${error.message}` : "Import dialog failed."
      );
    }
  };

  const handleSaveSessionFile = async () => {
    try {
      const result = await window.appApi.saveSessionFile(snapshot);
      if (!result.filePath) {
        setImportNotice("Save cancelled.");
        return;
      }
      setImportNotice(`Saved session to ${result.filePath.split(/[/\\]/).at(-1) ?? "session file"}.`);
    } catch (error) {
      console.error("Failed to save session file", error);
      setImportNotice(
        error instanceof Error ? `Save failed: ${error.message}` : "Save failed."
      );
    }
  };

  const handleOpenSessionFile = async () => {
    try {
      const result = await window.appApi.openSessionFile();
      if (!result) {
        setImportNotice("Open cancelled.");
        return;
      }
      bootstrap(result.snapshot);
      setImportNotice(`Opened session ${result.filePath.split(/[/\\]/).at(-1) ?? "session file"}.`);
    } catch (error) {
      console.error("Failed to open session file", error);
      setImportNotice(
        error instanceof Error ? `Open failed: ${error.message}` : "Open failed."
      );
    }
  };

  const handleRelinkAsset = async (assetId: string) => {
    const paths = await window.appApi.openImportDialog();
    if (!paths.length) return;
    const result = await window.appApi.importFiles([paths[0]]);
    const replacement = result.imported[0];
    if (replacement) {
      replaceAssetReference(assetId, replacement);
      setImportNotice("Asset relinked.");
    }
  };

  const handleConfirmClearSession = () => {
    clearSession();
    setDrawMode(false);
    setConnectorSourceItemId(null);
    setContextMenu({ open: false });
    setClearSessionOpen(false);
    setImportNotice("Session cleared. Started fresh.");
  };

  const handleSelectPatch = async () => {
    const filePath = await window.appApi.selectPatchFile();
    if (!filePath) {
      setPatchProgress({
        phase: "idle",
        percent: 0,
        message: "Patch selection cancelled."
      });
      setPatchValidation({
        ok: false,
        filePath: null,
        fileName: null,
        status: "cancelled",
        message: "Patch selection cancelled."
      });
      return;
    }

    setSelectedPatchPath(filePath);
    setPatchProgress({
      phase: "validating",
      percent: 8,
      message: "Validating selected patch package..."
    });
    setPatchValidation({
      ok: false,
      filePath,
      fileName: filePath.split(/[/\\]/).at(-1) ?? null,
      status: "validating",
      message: "Validating patch package..."
    });
    const result = await window.appApi.validatePatch(filePath);
    setPatchValidation(result);
    setPatchProgress({
      phase: result.ok ? "idle" : "failed",
      percent: result.ok ? 0 : 100,
      message: result.ok ? "Ready to install. Canvas Studio will restart to apply the patch." : result.message
    });
  };

  const handleInstallPatch = async () => {
    if (!selectedPatchPath || !patchValidation.ok) return;
    setInstallingPatch(true);
    setPatchProgress({
      phase: "validating",
      percent: 12,
      message: "Starting patch install workflow..."
    });
    setPatchValidation((current) => ({
      ...current,
      status: "installing",
      message: "Patch is being staged. Canvas Studio will restart to complete installation."
    }));
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    try {
      const result = await window.appApi.installPatch(selectedPatchPath);
      setInstallingPatch(false);
      setPatchValidation((current) => ({
        ...current,
        ok: result.ok,
        status: result.status,
        message: result.message
      }));
      if (!result.ok) {
        setPatchProgress({
          phase: "failed",
          percent: 100,
          message: result.message
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Patch installation failed.";
      setInstallingPatch(false);
      setPatchValidation((current) => ({
        ...current,
        ok: false,
        status: "failed",
        message
      }));
      setPatchProgress({
        phase: "failed",
        percent: 100,
        message
      });
    }
  };

  const handleContextAction = async (actionId: ContextMenuActionId) => {
    const boardPoint = contextMenu.open ? contextMenu.boardPoint : { x: 0, y: 0 };
    const menuItem = contextMenu.open ? contextMenu.item : undefined;

    switch (actionId) {
      case "new-note":
        addQuickItem("note", boardPoint);
        return;
      case "new-sticky":
        addQuickItem("sticky", boardPoint);
        return;
      case "new-frame":
        addQuickItem("frame", boardPoint);
        return;
      case "import-image":
        await handleImportDialog(boardPoint);
        return;
      case "fit-view":
        if (boardFrameRef.current) {
          const frame = boardFrameRef.current.getBoundingClientRect();
          fitActiveBoardToContent({ width: frame.width, height: frame.height });
        }
        return;
      case "reset-view":
        resetActiveBoardView();
        return;
      case "rename":
        setRenameOpen(true);
        return;
      case "duplicate":
        duplicateSelection();
        return;
      case "delete":
        deleteSelection();
        return;
      case "bring-forward":
        adjustSelectionZOrder("forward");
        return;
      case "send-backward":
        adjustSelectionZOrder("backward");
        return;
      case "toggle-lock":
        toggleSelectionLock();
        return;
      case "set-color-neutral":
      case "set-color-gold":
      case "set-color-blue":
      case "set-color-emerald":
      case "set-color-rose":
      case "set-color-violet":
      case "set-color-charcoal": {
        const colorThemes: Record<string, { fillColor: string; textColor: string }> = {
          "set-color-neutral": { fillColor: "#1b1f25", textColor: "#f4f7fb" },
          "set-color-gold": { fillColor: "#6f5a24", textColor: "#fff6dc" },
          "set-color-blue": { fillColor: "#243e67", textColor: "#ecf4ff" },
          "set-color-emerald": { fillColor: "#1f5846", textColor: "#e6fff4" },
          "set-color-rose": { fillColor: "#6a3044", textColor: "#ffeef5" },
          "set-color-violet": { fillColor: "#4f3978", textColor: "#f3ecff" },
          "set-color-charcoal": { fillColor: "#14181d", textColor: "#f3f5f7" }
        };
        const theme = colorThemes[actionId];
        updateSelectedStyle(
          selectedItem?.type === "connector"
            ? { strokeColor: theme.fillColor }
            : { fillColor: theme.fillColor, textColor: theme.textColor }
        );
        return;
      }
      case "focus-overlay":
        if (!menuItem || menuItem.type !== "image") return;
        {
          const asset = assetsById.get(menuItem.content.assetId);
          if (!asset) return;
          await window.appApi.openFocusOverlay({
            src: toAssetUrl(asset.cachedPath),
            label: asset.originalPath.split(/[/\\]/).at(-1) ?? "Reference Overlay",
            opacity: 0.95
          });
        }
        return;
      case "extract-base-palette":
      case "extract-all-8":
      case "extract-all-12":
      case "extract-all-16":
      case "extract-all-24":
        if (!menuItem || menuItem.type !== "image") return;
        const asset = assetsById.get(menuItem.content.assetId);
        if (!asset) return;
        const countMap: Record<string, number> = {
          "extract-base-palette": 4,
          "extract-all-8": 8,
          "extract-all-12": 12,
          "extract-all-16": 16,
          "extract-all-24": 24
        };
        const colors = await extractPaletteFromAsset(asset.cachedPath, countMap[actionId]);
        addSwatchPaletteFromColors(menuItem.id, colors);
        setImportNotice(`Extracted ${colors.length} swatch colors.`);
        return;
      default:
        return;
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createSessionProject();
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "x") {
        event.preventDefault();
        setClearSessionOpen(true);
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDrawMode((value) => !value);
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSaveSessionFile();
      } else if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void handleOpenSessionFile();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        updatePalette({ paletteOpen: true });
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void window.appApi.openNewWindow();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        updatePalette({ paletteOpen: true });
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createBoard();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void handleImportDialog();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        markSaving();
        window.appApi.saveSnapshot(snapshot).then((result) => markSaved(result.savedAt)).catch(() => markError());
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z") ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y")
      ) {
        event.preventDefault();
        redo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelection();
      } else if (event.key.toLowerCase() === "f") {
        const frame = boardFrameRef.current?.getBoundingClientRect();
        if (frame) fitActiveBoardToContent({ width: frame.width, height: frame.height });
      } else if (event.key === "ArrowUp") {
        moveSelectedItems({ x: 0, y: event.shiftKey ? -10 : -1 });
      } else if (event.key === "ArrowDown") {
        moveSelectedItems({ x: 0, y: event.shiftKey ? 10 : 1 });
      } else if (event.key === "ArrowLeft") {
        moveSelectedItems({ x: event.shiftKey ? -10 : -1, y: 0 });
      } else if (event.key === "ArrowRight") {
        moveSelectedItems({ x: event.shiftKey ? 10 : 1, y: 0 });
      } else if (event.key === "Escape") {
        setConnectorSourceItemId(null);
        setContextMenu({ open: false });
      } else if (event.key === "?") {
        toggleHelp(true);
      }
    };

    const onPaste = async (event: ClipboardEvent) => {
      const clipboardItems = Array.from(event.clipboardData?.items ?? []);
      const imageFile = clipboardItems.find((item) => item.type.startsWith("image/"))?.getAsFile();
      if (imageFile) {
        const reader = new FileReader();
        reader.onload = async () => {
          const imported = await window.appApi.importClipboardImage({
            name: `pasted-${Date.now()}.png`,
            dataUrl: String(reader.result)
          });
          const { assets, items } = createItemsFromImportedAssets(activeBoard.id, [imported], snapshot.assets, {
            x: 0,
            y: 0
          });
          addImportedContent(assets, items);
          setImportNotice("Pasted image imported.");
        };
        reader.readAsDataURL(imageFile);
        return;
      }

      const text = event.clipboardData?.getData("text/plain");
      if (text && /^https?:\/\//.test(text)) {
        addImportedContent(snapshot.assets, [createLinkFromText(activeBoard.id, text, 40, 40)]);
        setImportNotice("Pasted link imported.");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("paste", onPaste);
    };
  }, [
    activeBoard.id,
    addImportedContent,
    createBoard,
    createSessionProject,
    deleteSelection,
    duplicateSelection,
    fitActiveBoardToContent,
    bootstrap,
    markError,
    markSaved,
    markSaving,
    moveSelectedItems,
    redo,
    snapshot,
    toggleHelp,
    undo,
    updatePalette
  ]);

  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      { id: "new-session", title: "New session", hint: "Project", run: createSessionProject },
      { id: "clear-session", title: "Clear current session", hint: "Warning", run: () => setClearSessionOpen(true) },
      { id: "open-session", title: "Open session file", hint: "File", run: () => void handleOpenSessionFile() },
      { id: "save-session", title: "Save session file", hint: "File", run: () => void handleSaveSessionFile() },
      { id: "toggle-draw", title: drawMode ? "Exit draw mode" : "Enter draw mode", hint: "Sketch", run: () => setDrawMode((value) => !value) },
      { id: "new-window", title: "Open new window", hint: "Window", run: () => void window.appApi.openNewWindow() },
      { id: "new-board", title: "New board", hint: "Create", run: createBoard },
      {
        id: "connector-mode",
        title: connectorSourceItemId ? "Cancel connector mode" : "Start connector mode",
        hint: "Connect",
        run: () => {
          if (connectorSourceItemId) {
            setConnectorSourceItemId(null);
            setImportNotice("Connector mode cancelled.");
            return;
          }
          if (!selectedItem || selectedItem.type === "connector") {
            setImportNotice("Select a frame or reference first, then start Connector mode.");
            return;
          }
          setConnectorSourceItemId(selectedItem.id);
          setImportNotice("Connector mode active. Click another frame or reference to link it.");
        }
      },
      { id: "new-note", title: "New note", hint: "Quick add", run: () => addQuickItem("note", { x: -120, y: -80 }) },
      { id: "new-sticky", title: "New sticky", hint: "Quick add", run: () => addQuickItem("sticky", { x: -120, y: -80 }) },
      { id: "import", title: "Import files", hint: "Assets", run: () => void handleImportDialog() },
      {
        id: "fit",
        title: "Fit board",
        hint: "Viewport",
        run: () => {
          const frame = boardFrameRef.current?.getBoundingClientRect();
          if (frame) fitActiveBoardToContent({ width: frame.width, height: frame.height });
        }
      },
      { id: "settings", title: "Show settings", hint: "Preferences", run: () => toggleSettings(true) },
      { id: "help", title: "Show shortcuts", hint: "Help", run: () => toggleHelp(true) }
    ],
    [
      addQuickItem,
      connectorSourceItemId,
      createBoard,
      createSessionProject,
      drawMode,
      fitActiveBoardToContent,
      selectedItem,
      toggleHelp,
      toggleSettings
    ]
  );

  const contextMenuItems =
    contextMenu.open && contextMenu.item
      ? buildItemContextMenu(contextMenu.item)
      : buildBoardContextMenu();

  return (
    <div
      className={`app-shell${leftRailCollapsed ? " app-shell-left-collapsed" : ""}${
        rightRailCollapsed ? " app-shell-right-collapsed" : ""
      }`}
    >
      <Sidebar
        workspace={activeWorkspace}
        project={activeProject}
        projects={snapshot.projects.filter((project) => project.workspaceId === activeWorkspace.id)}
        boards={snapshot.boards.filter((board) => board.projectId === activeProject.id)}
        assets={snapshot.assets}
        activeProjectId={activeProject.id}
        activeBoardId={activeBoard.id}
        onSelectProject={setActiveProject}
        onSelectBoard={setActiveBoard}
        onCreateBoard={createBoard}
        onCreateSession={createSessionProject}
        collapsed={leftRailCollapsed}
        onToggleCollapsed={() => setLeftRailCollapsed((value) => !value)}
      />

      <main className="workspace-shell">
        <TopBar
          projectTitle={activeProject.title}
          boardTitle={activeBoard.title}
          onQuickAdd={(kind) => addQuickItem(kind, { x: -120, y: -80 })}
          onOpenSession={() => void handleOpenSessionFile()}
          onSaveSession={() => void handleSaveSessionFile()}
          onImport={() => void handleImportDialog()}
          onToggleConnectorMode={() => {
            if (connectorSourceItemId) {
              setConnectorSourceItemId(null);
              setImportNotice("Connector mode cancelled.");
              return;
            }
            if (!selectedItem || selectedItem.type === "connector") {
              setImportNotice("Select a frame or reference first, then start Connector mode.");
              return;
            }
            setConnectorSourceItemId(selectedItem.id);
            setImportNotice("Connector mode active. Click another frame or reference to link it.");
          }}
          onOpenNewWindow={() => void window.appApi.openNewWindow()}
          onOpenPalette={() => updatePalette({ paletteOpen: true })}
          onOpenSettings={() => toggleSettings(true)}
          onNewSession={createSessionProject}
          onClearSession={() => setClearSessionOpen(true)}
          drawMode={drawMode}
          connectorMode={Boolean(connectorSourceItemId)}
          drawColor={drawColor}
          drawSize={drawSize}
          drawSmoothing={drawSmoothing}
          onToggleDrawMode={() => setDrawMode((value) => !value)}
          onDrawColorChange={setDrawColor}
          onDrawSizeChange={setDrawSize}
          onDrawSmoothingChange={setDrawSmoothing}
        />
        <div className="board-frame" ref={boardFrameRef}>
          <BoardCanvas
            snapshot={snapshot}
            board={{ ...activeBoard, showGrid: activeWorkspace.settings.showGrid }}
            settings={activeWorkspace.settings}
            items={boardItems}
            strokes={boardStrokes}
            assetsById={assetsById}
            selectedItemIds={selectedItemIds}
            drawMode={drawMode}
            drawColor={drawColor}
            drawSize={drawSize}
            drawSmoothing={drawSmoothing}
            onSelectItems={selectItems}
            onViewportChange={(viewport) => updateBoardViewport(activeBoard.id, viewport)}
            onApplyLiveSelectionDelta={applyLiveSelectionDelta}
            onApplyLiveItemBounds={applyLiveItemBounds}
            onCommitInteraction={pushHistoryEntry}
            onUpdateItemText={updateItemText}
            onCreateNote={(position) => addQuickItem("note", position)}
            connectorSourceItemId={connectorSourceItemId}
            onCreateConnector={(fromItemId, toItemId) => {
              addConnector(fromItemId, toItemId);
              setConnectorSourceItemId(null);
              setImportNotice("Connector added.");
            }}
            onCancelConnector={() => setConnectorSourceItemId(null)}
            onAddStroke={addStroke}
            onOpenBoardContextMenu={(payload) =>
              setContextMenu({
                open: true,
                position: payload.screen,
                boardPoint: payload.board
              })
            }
            onOpenItemContextMenu={(payload) =>
              setContextMenu({
                open: true,
                position: payload.screen,
                boardPoint: payload.board,
                item: payload.item
              })
            }
          />
        </div>
        <StatusBar
          zoom={activeBoard.viewport.zoom}
          selectionCount={selectedItemIds.length}
          saveState={ui.saveState}
          lastSavedAt={ui.lastSavedAt}
          message={
            connectorSourceItemId
              ? "Connector mode active. Click another frame or reference to link it."
              : drawMode
                ? `Draw mode · ${drawSize}px · ${Math.round(drawSmoothing * 100)}% smooth`
                : importNotice
          }
          credit="Made by nephillius · free for others"
        />
      </main>

      <InspectorPanel
        item={selectedItem}
        asset={selectedItem && "assetId" in selectedItem.content ? assetsById.get(selectedItem.content.assetId) : undefined}
        board={activeBoard}
        settings={activeWorkspace.settings}
        onTextChange={updateSelectedText}
        onMetadataChange={updateSelectedMetadata}
        onStyleChange={updateSelectedStyle}
        onOpacityChange={updateSelectedOpacity}
        onSizeChange={updateSelectedDimensions}
        onBoardChange={updateActiveBoard}
        onSettingsChange={updateWorkspaceSettings}
        onRelinkAsset={handleRelinkAsset}
        collapsed={rightRailCollapsed}
        onToggleCollapsed={() => setRightRailCollapsed((value) => !value)}
      />

      <CommandPalette
        open={ui.paletteOpen}
        query={ui.paletteQuery}
        boards={snapshot.boards}
        onQueryChange={(value) => updatePalette({ paletteQuery: value })}
        onClose={() => updatePalette({ paletteOpen: false, paletteQuery: "" })}
        actions={paletteActions}
      />

      <HelpDialog open={ui.helpOpen} title="Shortcuts" onClose={() => toggleHelp(false)} />
      {clearSessionOpen ? (
        <div className="overlay-backdrop" onClick={() => setClearSessionOpen(false)}>
          <div className="overlay-panel rename-panel" onClick={(event) => event.stopPropagation()}>
            <div className="panel-label">Warning</div>
            <h3>Clear current session?</h3>
            <p className="feature-caption">
              This will wipe the current in-app session and replace it with a fresh workspace. Saved session files are not deleted.
            </p>
            <div className="rename-actions">
              <button type="button" className="ghost-button" onClick={() => setClearSessionOpen(false)}>
                Cancel
              </button>
              <button type="button" className="toolbar-button accent" onClick={handleConfirmClearSession}>
                Clear Session
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <SettingsDialog
        open={ui.settingsOpen}
        version={appVersion}
        packaged={packagedBuild}
        crashReportsPath={crashReportsPath}
        patchFile={selectedPatchPath}
        validation={patchValidation}
        patchProgress={patchProgress}
        installing={installingPatch}
        onClose={() => toggleSettings(false)}
        onSelectPatch={() => void handleSelectPatch()}
        onInstallPatch={() => void handleInstallPatch()}
      />
      <ContextMenu
        open={contextMenu.open}
        position={contextMenu.open ? contextMenu.position : { x: 0, y: 0 }}
        items={contextMenuItems}
        onClose={() => setContextMenu({ open: false })}
        onSelect={(id) => void handleContextAction(id)}
      />
      <RenameDialog
        open={renameOpen}
        initialValue={getItemRenameValue(selectedItem)}
        title="Rename item"
        onClose={() => setRenameOpen(false)}
        onSubmit={(value) => {
          if (value) {
            renameSelection(value);
          }
          setRenameOpen(false);
        }}
      />
    </div>
  );
};
