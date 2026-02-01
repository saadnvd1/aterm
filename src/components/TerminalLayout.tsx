import { useState, useRef, useCallback } from "react";
import { TerminalPane } from "./TerminalPane";
import type { ProjectConfig } from "../lib/config";
import type { Layout, LayoutRow, LayoutPane } from "../lib/layouts";
import type { TerminalProfile } from "../lib/profiles";

interface Props {
  project: ProjectConfig;
  layout: Layout;
  profiles: TerminalProfile[];
  onLayoutChange: (layout: Layout) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  paneId: string;
  rowId: string;
}

export function TerminalLayout({ project, layout, profiles, onLayoutChange }: Props) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showProfileSubmenu, setShowProfileSubmenu] = useState<"vertical" | "horizontal" | null>(null);

  function handleContextMenu(e: React.MouseEvent, paneId: string, rowId: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, paneId, rowId });
    setShowProfileSubmenu(null);
  }

  function closeContextMenu() {
    setContextMenu(null);
    setShowProfileSubmenu(null);
  }

  function splitVertical(profileId: string) {
    if (!contextMenu) return;

    const newPane: LayoutPane = {
      id: crypto.randomUUID(),
      profileId,
      flex: 1,
    };

    const newRows = layout.rows.map((row) => {
      if (row.id !== contextMenu.rowId) return row;

      const paneIndex = row.panes.findIndex((p) => p.id === contextMenu.paneId);
      const newPanes = [...row.panes];
      newPanes.splice(paneIndex + 1, 0, newPane);

      return { ...row, panes: newPanes };
    });

    onLayoutChange({ ...layout, rows: newRows });
    closeContextMenu();
  }

  function splitHorizontal(profileId: string) {
    if (!contextMenu) return;

    const rowIndex = layout.rows.findIndex((r) => r.id === contextMenu.rowId);
    const currentRow = layout.rows[rowIndex];

    const newRow: LayoutRow = {
      id: crypto.randomUUID(),
      flex: currentRow.flex,
      panes: [
        {
          id: crypto.randomUUID(),
          profileId,
          flex: 1,
        },
      ],
    };

    const newRows = [...layout.rows];
    newRows.splice(rowIndex + 1, 0, newRow);

    onLayoutChange({ ...layout, rows: newRows });
    closeContextMenu();
  }

  function closePane() {
    if (!contextMenu) return;

    const totalPanes = layout.rows.reduce((acc, r) => acc + r.panes.length, 0);
    if (totalPanes <= 1) return; // Don't close the last pane

    const newRows = layout.rows
      .map((row) => {
        if (row.id !== contextMenu.rowId) return row;
        return {
          ...row,
          panes: row.panes.filter((p) => p.id !== contextMenu.paneId),
        };
      })
      .filter((row) => row.panes.length > 0);

    onLayoutChange({ ...layout, rows: newRows });
    closeContextMenu();
  }

  const totalPanes = layout.rows.reduce((acc, r) => acc + r.panes.length, 0);

  return (
    <div style={styles.container}>
      {layout.rows.map((row, rowIndex) => (
        <RowWithResizer
          key={row.id}
          row={row}
          rowIndex={rowIndex}
          totalRows={layout.rows.length}
          project={project}
          profiles={profiles}
          layout={layout}
          onLayoutChange={onLayoutChange}
          onContextMenu={handleContextMenu}
        />
      ))}

      {contextMenu && (
        <>
          <div style={styles.contextOverlay} onClick={closeContextMenu} />
          <div
            style={{
              ...styles.contextMenu,
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <div
              style={styles.contextMenuItem}
              onMouseEnter={() => setShowProfileSubmenu("vertical")}
            >
              <span>Split Vertical</span>
              <span style={styles.menuArrow}>▸</span>
              {showProfileSubmenu === "vertical" && (
                <div style={styles.submenu}>
                  <button
                    style={styles.submenuItem}
                    onClick={() => splitVertical("shell")}
                  >
                    Shell (default)
                  </button>
                  <div style={styles.submenuDivider} />
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      style={styles.submenuItem}
                      onClick={() => splitVertical(p.id)}
                    >
                      <span
                        style={{
                          ...styles.profileDot,
                          backgroundColor: p.color,
                        }}
                      />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              style={styles.contextMenuItem}
              onMouseEnter={() => setShowProfileSubmenu("horizontal")}
            >
              <span>Split Horizontal</span>
              <span style={styles.menuArrow}>▸</span>
              {showProfileSubmenu === "horizontal" && (
                <div style={styles.submenu}>
                  <button
                    style={styles.submenuItem}
                    onClick={() => splitHorizontal("shell")}
                  >
                    Shell (default)
                  </button>
                  <div style={styles.submenuDivider} />
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      style={styles.submenuItem}
                      onClick={() => splitHorizontal(p.id)}
                    >
                      <span
                        style={{
                          ...styles.profileDot,
                          backgroundColor: p.color,
                        }}
                      />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {totalPanes > 1 && (
              <>
                <div style={styles.menuDivider} />
                <button
                  style={styles.contextMenuItemButton}
                  onClick={closePane}
                  onMouseEnter={() => setShowProfileSubmenu(null)}
                >
                  Close Pane
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface RowProps {
  row: LayoutRow;
  rowIndex: number;
  totalRows: number;
  project: ProjectConfig;
  profiles: TerminalProfile[];
  layout: Layout;
  onLayoutChange: (layout: Layout) => void;
  onContextMenu: (e: React.MouseEvent, paneId: string, rowId: string) => void;
}

function RowWithResizer({
  row,
  rowIndex,
  totalRows,
  project,
  profiles,
  layout,
  onLayoutChange,
  onContextMenu,
}: RowProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRowResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startY = e.clientY;
      const container = containerRef.current?.parentElement;
      if (!container) return;

      const totalHeight = container.clientHeight;
      const currentRow = layout.rows[rowIndex];
      const nextRow = layout.rows[rowIndex + 1];
      const startCurrentFlex = currentRow.flex;
      const startNextFlex = nextRow.flex;
      const totalFlex = startCurrentFlex + startNextFlex;

      const onMouseMove = (e: MouseEvent) => {
        const deltaY = e.clientY - startY;
        const deltaFlex = (deltaY / totalHeight) * totalFlex * 2;

        const newCurrentFlex = Math.max(0.1, startCurrentFlex + deltaFlex);
        const newNextFlex = Math.max(0.1, startNextFlex - deltaFlex);

        const newRows = layout.rows.map((r, i) => {
          if (i === rowIndex) return { ...r, flex: newCurrentFlex };
          if (i === rowIndex + 1) return { ...r, flex: newNextFlex };
          return r;
        });

        onLayoutChange({ ...layout, rows: newRows });
      };

      const onMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [layout, rowIndex, onLayoutChange]
  );

  return (
    <>
      <div ref={containerRef} style={{ ...styles.row, flex: row.flex }}>
        {row.panes.map((pane, paneIndex) => {
          const profile = profiles.find((p) => p.id === pane.profileId);
          const isLast = paneIndex === row.panes.length - 1;

          return (
            <PaneWithResizer
              key={pane.id}
              paneId={pane.id}
              paneIndex={paneIndex}
              flex={pane.flex}
              isLast={isLast}
              project={project}
              profile={profile}
              row={row}
              layout={layout}
              onLayoutChange={onLayoutChange}
              onContextMenu={(e) => onContextMenu(e, pane.id, row.id)}
            />
          );
        })}
      </div>
      {rowIndex < totalRows - 1 && (
        <div
          style={{
            ...styles.rowResizer,
            ...(isDragging ? styles.resizerActive : {}),
          }}
          onMouseDown={handleRowResize}
        />
      )}
    </>
  );
}

interface PaneProps {
  paneId: string;
  paneIndex: number;
  flex: number;
  isLast: boolean;
  project: ProjectConfig;
  profile: TerminalProfile | undefined;
  row: LayoutRow;
  layout: Layout;
  onLayoutChange: (layout: Layout) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function PaneWithResizer({
  paneId,
  paneIndex,
  flex,
  isLast,
  project,
  profile,
  row,
  layout,
  onLayoutChange,
  onContextMenu,
}: PaneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePaneResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const container = containerRef.current?.parentElement;
      if (!container) return;

      const totalWidth = container.clientWidth;
      const currentPane = row.panes[paneIndex];
      const nextPane = row.panes[paneIndex + 1];
      const startCurrentFlex = currentPane.flex;
      const startNextFlex = nextPane.flex;
      const totalFlex = startCurrentFlex + startNextFlex;

      const onMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaFlex = (deltaX / totalWidth) * totalFlex * 2;

        const newCurrentFlex = Math.max(0.1, startCurrentFlex + deltaFlex);
        const newNextFlex = Math.max(0.1, startNextFlex - deltaFlex);

        const newRows = layout.rows.map((r) => {
          if (r.id !== row.id) return r;
          return {
            ...r,
            panes: r.panes.map((p, i) => {
              if (i === paneIndex) return { ...p, flex: newCurrentFlex };
              if (i === paneIndex + 1) return { ...p, flex: newNextFlex };
              return p;
            }),
          };
        });

        onLayoutChange({ ...layout, rows: newRows });
      };

      const onMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [layout, row, paneIndex, onLayoutChange]
  );

  if (!profile) {
    return (
      <div style={{ ...styles.pane, flex }}>
        <div style={styles.missingProfile}>Profile not found</div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{ ...styles.pane, flex }}
        onContextMenu={onContextMenu}
      >
        <TerminalPane
          id={`${project.id}-${paneId}`}
          title={profile.name}
          cwd={project.path}
          command={profile.command}
          accentColor={profile.color}
        />
      </div>
      {!isLast && (
        <div
          style={{
            ...styles.paneResizer,
            ...(isDragging ? styles.resizerActive : {}),
          }}
          onMouseDown={handlePaneResize}
        />
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    gap: 0,
    padding: "6px",
    backgroundColor: "var(--bg)",
    minHeight: 0,
  },
  row: {
    display: "flex",
    minHeight: 0,
    gap: 0,
  },
  pane: {
    display: "flex",
    minWidth: 0,
    minHeight: 0,
  },
  rowResizer: {
    height: "6px",
    cursor: "row-resize",
    backgroundColor: "transparent",
    transition: "background-color 0.15s ease",
    flexShrink: 0,
  },
  paneResizer: {
    width: "6px",
    cursor: "col-resize",
    backgroundColor: "transparent",
    transition: "background-color 0.15s ease",
    flexShrink: 0,
  },
  resizerActive: {
    backgroundColor: "var(--accent)",
  },
  missingProfile: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
    fontSize: "12px",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "8px",
  },
  contextOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  contextMenu: {
    position: "fixed",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
    zIndex: 1000,
    minWidth: "160px",
    padding: "4px",
    overflow: "visible",
  },
  contextMenuItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    color: "var(--text)",
    fontSize: "12px",
    cursor: "pointer",
    borderRadius: "4px",
    position: "relative",
  },
  contextMenuItemButton: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text)",
    fontSize: "12px",
    cursor: "pointer",
    borderRadius: "4px",
    textAlign: "left",
  },
  menuArrow: {
    fontSize: "10px",
    color: "var(--text-muted)",
  },
  menuDivider: {
    height: "1px",
    backgroundColor: "var(--border-subtle)",
    margin: "4px 0",
  },
  submenu: {
    position: "absolute",
    left: "100%",
    top: 0,
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
    minWidth: "140px",
    padding: "4px",
    marginLeft: "4px",
  },
  submenuItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text)",
    fontSize: "12px",
    cursor: "pointer",
    borderRadius: "4px",
    textAlign: "left",
  },
  submenuDivider: {
    height: "1px",
    backgroundColor: "var(--border-subtle)",
    margin: "4px 0",
  },
  profileDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
};
