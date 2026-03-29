import type { PatchProgressState, PatchValidationResult } from "../../shared/ipc";

interface SettingsDialogProps {
  open: boolean;
  version: string;
  packaged: boolean;
  crashReportsPath: string;
  patchFile: string | null;
  validation: PatchValidationResult;
  patchProgress: PatchProgressState;
  installing: boolean;
  onClose: () => void;
  onSelectPatch: () => void;
  onInstallPatch: () => void;
}

export const SettingsDialog = ({
  open,
  version,
  packaged,
  crashReportsPath,
  patchFile,
  validation,
  patchProgress,
  installing,
  onClose,
  onSelectPatch,
  onInstallPatch
}: SettingsDialogProps) => {
  if (!open) return null;

  const displayPercent =
    installing && patchProgress.percent === 0 ? 12 : patchProgress.percent;
  const displayMessage =
    installing && patchProgress.percent === 0
      ? "Starting patch install workflow..."
      : patchProgress.message;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-row">
          <div>
            <div className="panel-label">Preferences</div>
            <h3>Settings & Updates</h3>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="settings-section">
          <div className="settings-header">
            <div>
              <div className="panel-label">Updates / Patch Installer</div>
              <p className="feature-caption">Current version {version}</p>
            </div>
            <span className={packaged ? "status-pill ready" : "status-pill warning"}>
              {packaged ? "Packaged build" : "Dev build"}
            </span>
          </div>

          <div className="patch-card">
            <div className="patch-row">
              <button type="button" className="toolbar-button" onClick={onSelectPatch}>
                Select Patch (.zip)
              </button>
              <div className="patch-file-copy">
                {patchFile ? patchFile.split(/[/\\]/).at(-1) : "No patch selected"}
              </div>
            </div>

            <div className="validation-box">
              <div className="panel-label">Validation</div>
              <div className={`validation-status ${validation.ok ? "ok" : "error"}`}>
                {validation.message}
              </div>
              {validation.manifest ? (
                <div className="manifest-grid">
                  <span>Patch version</span>
                  <strong>{validation.manifest.version}</strong>
                  <span>Minimum base</span>
                  <strong>{validation.manifest.minSupportedVersion}</strong>
                  <span>Entry</span>
                  <strong>{validation.manifest.entry}</strong>
                </div>
              ) : null}
            </div>

            <div className="validation-box">
              <div className="panel-label">Install Progress</div>
              <div className="progress-row">
                <strong>{displayPercent}%</strong>
                <span>{displayMessage}</span>
              </div>
              <div className="progress-track" aria-hidden="true">
                <div
                  className="progress-bar"
                  style={{ width: `${Math.max(0, Math.min(100, displayPercent))}%` }}
                />
              </div>
              <p className="feature-caption">
                {installing || patchProgress.phase === "ready-to-restart" || patchProgress.phase === "quitting"
                  ? "The patch is staged first, then applied after the app closes so the running build is never overwritten in place."
                  : "After validation, the patch will be staged safely and then applied during restart."}
              </p>
            </div>

            <div className="patch-actions">
              <button
                type="button"
                className="toolbar-button accent"
                onClick={onInstallPatch}
                disabled={!validation.ok || !!validation.packagedOnly || installing}
              >
                {installing ? "Preparing Restart..." : "Install Patch"}
              </button>
              <p className="feature-caption">
                {packaged
                  ? "Install stages the patch, backs up the current app.asar, then restarts Canvas Studio to apply it."
                  : "Install Patch is only available in the packaged Windows app."}
              </p>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-header">
            <div>
              <div className="panel-label">Crash Reports</div>
              <p className="feature-caption">If the app crashes, a unique `.txt` report is written here.</p>
            </div>
          </div>
          <div className="patch-card">
            <div className="patch-file-copy">{crashReportsPath}</div>
          </div>
        </section>
      </div>
    </div>
  );
};
