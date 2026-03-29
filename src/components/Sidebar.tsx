import type { Asset, Board, Project, Workspace } from "../../shared/domain";

interface SidebarProps {
  workspace: Workspace;
  project: Project;
  projects: Project[];
  boards: Board[];
  assets: Asset[];
  activeBoardId: string;
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: () => void;
  onCreateSession: () => void;
}

export const Sidebar = ({
  workspace,
  project,
  projects,
  boards,
  assets,
  activeBoardId,
  activeProjectId,
  onSelectProject,
  onSelectBoard,
  onCreateBoard,
  onCreateSession
}: SidebarProps) => (
  <aside className="left-rail">
    <div className="panel-section">
      <span className="panel-label">Workspace</span>
      <h1>{workspace.name}</h1>
      <p>{project.title}</p>
    </div>

    <div className="panel-section">
      <div className="panel-row">
        <span className="panel-label">Sessions</span>
        <button className="ghost-button" onClick={onCreateSession} type="button">
          New Session
        </button>
      </div>
      <div className="board-list">
        {projects.map((entry) => (
          <button
            key={entry.id}
            className={entry.id === activeProjectId ? "board-chip active" : "board-chip"}
            onClick={() => onSelectProject(entry.id)}
            type="button"
          >
            <span>{entry.title}</span>
          </button>
        ))}
      </div>
    </div>

    <div className="panel-section">
      <div className="panel-row">
        <span className="panel-label">Boards</span>
        <button className="ghost-button" onClick={onCreateBoard} type="button">
          New
        </button>
      </div>
      <div className="board-list">
        {boards.map((board) => (
          <button
            key={board.id}
            className={board.id === activeBoardId ? "board-chip active" : "board-chip"}
            onClick={() => onSelectBoard(board.id)}
            type="button"
          >
            <span>{board.title}</span>
            <small>{Math.round(board.viewport.zoom * 100)}%</small>
          </button>
        ))}
      </div>
    </div>

    <div className="panel-section">
      <span className="panel-label">Quick Notes</span>
      <ul className="utility-list">
        <li>Drag files from Explorer into the board.</li>
        <li>Hold spacebar or middle mouse to pan.</li>
        <li>Ctrl+K opens the command palette.</li>
      </ul>
    </div>

    <div className="panel-section">
      <span className="panel-label">Reference Library</span>
      <p className="feature-caption">{assets.length} reusable references cached locally</p>
      <div className="board-list">
        {assets.slice(0, 5).map((asset) => (
          <div key={asset.id} className="library-chip">
            <span>{asset.originalPath.split(/[/\\]/).at(-1)}</span>
            <small>{asset.width && asset.height ? `${asset.width}×${asset.height}` : "Reference"}</small>
          </div>
        ))}
        {!assets.length ? <p className="feature-caption">Imported references appear here for reuse across sessions.</p> : null}
      </div>
    </div>
  </aside>
);
