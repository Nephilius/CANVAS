import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

interface FocusOverlayAppProps {
  src: string;
  label: string;
  initialOpacity: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const FocusOverlayApp = ({ src, label, initialOpacity }: FocusOverlayAppProps) => {
  const title = useMemo(() => label || "Reference Overlay", [label]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [opacity, setOpacity] = useState(initialOpacity);
  const [locked, setLocked] = useState(false);
  const [clickThrough, setClickThrough] = useState(false);
  const [shortcutHint, setShortcutHint] = useState("Ctrl+Shift+X");
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [stageSize, setStageSize] = useState({ width: 1, height: 1 });
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragState, setDragState] = useState<null | {
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>(null);

  const fitScale = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height || !stageSize.width || !stageSize.height) {
      return 1;
    }
    return Math.min(stageSize.width / naturalSize.width, stageSize.height / naturalSize.height);
  }, [naturalSize, stageSize]);

  const minScale = Math.max(0.1, fitScale * 0.25);
  const maxScale = Math.max(minScale, fitScale * 8);
  const displayScale = Math.round((scale / Math.max(fitScale, 0.0001)) * 100);

  const resetView = () => {
    setScale(fitScale || 1);
    setOffsetX(0);
    setOffsetY(0);
  };

  useEffect(() => {
    void window.appApi.setFocusOverlayOpacity(initialOpacity);
    void window.appApi.getFocusOverlayWindowState().then((state) => {
      setClickThrough(state.clickThrough);
      setShortcutHint(state.shortcutHint);
    });
    return window.appApi.onFocusOverlayWindowState((state) => {
      setClickThrough(state.clickThrough);
      setShortcutHint(state.shortcutHint);
    });
  }, [initialOpacity]);

  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    const update = () => {
      setStageSize({ width: element.clientWidth, height: element.clientHeight });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!imageRef.current) return;
    const image = imageRef.current;
    const handleLoad = () => {
      setNaturalSize({
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1
      });
    };

    handleLoad();
    image.addEventListener("load", handleLoad);
    return () => image.removeEventListener("load", handleLoad);
  }, [src]);

  useEffect(() => {
    resetView();
  }, [fitScale]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragState || locked || clickThrough) return;
      setOffsetX(dragState.originX + (event.clientX - dragState.startX));
      setOffsetY(dragState.originY + (event.clientY - dragState.startY));
    };

    const onPointerUp = () => {
      setDragState(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [clickThrough, dragState, locked]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void window.appApi.closeFocusOverlay();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "x") {
        event.preventDefault();
        void window.appApi.setFocusOverlayClickThrough(!clickThrough);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clickThrough]);

  return (
    <div className="focus-overlay-shell">
      <header className="focus-overlay-toolbar">
        <div className="focus-overlay-drag">
          <div className="panel-label">Focus Overlay</div>
          <strong>{title}</strong>
        </div>
        <div className="focus-overlay-actions">
          <div className="focus-overlay-stat">{displayScale}%</div>
          <label className="focus-overlay-opacity">
            <span>Opacity</span>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(event) => {
                const next = Number(event.target.value);
                setOpacity(next);
                void window.appApi.setFocusOverlayOpacity(next);
              }}
            />
          </label>
          <button
            type="button"
            className={locked ? "toolbar-button accent" : "toolbar-button"}
            onClick={() => setLocked((current) => !current)}
          >
            {locked ? "Unlock" : "Lock"}
          </button>
          <button
            type="button"
            className={clickThrough ? "toolbar-button accent" : "toolbar-button"}
            onClick={() => void window.appApi.setFocusOverlayClickThrough(!clickThrough)}
          >
            {clickThrough ? "Pass Through On" : "Pass Through"}
          </button>
          <button type="button" className="toolbar-button" onClick={resetView}>
            Reset View
          </button>
          <button type="button" className="toolbar-button" onClick={() => void window.appApi.closeFocusOverlay()}>
            Return
          </button>
        </div>
      </header>
      <main
        ref={stageRef}
        className={locked ? "focus-overlay-stage is-locked" : "focus-overlay-stage"}
        onDoubleClick={() => {
          if (!locked && !clickThrough) {
            resetView();
          }
        }}
        onPointerDown={(event) => {
          if (locked || clickThrough) return;
          setDragState({
            startX: event.clientX,
            startY: event.clientY,
            originX: offsetX,
            originY: offsetY
          });
        }}
        onWheel={(event) => {
          if (locked || clickThrough) return;
          event.preventDefault();
          const nextScale = clamp(scale * (event.deltaY < 0 ? 1.08 : 0.92), minScale, maxScale);
          setScale(nextScale);
        }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={title}
          className="focus-overlay-image"
          draggable={false}
          style={{
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
          }}
        />
        {clickThrough ? (
          <div className="focus-overlay-hint">
            Pass-through active. Press {shortcutHint} to make the overlay interactive again.
          </div>
        ) : null}
      </main>
    </div>
  );
};
