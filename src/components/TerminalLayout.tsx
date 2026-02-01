import { useState, useRef, useCallback } from "react";
import { TerminalPane } from "./TerminalPane";
import type { ProjectConfig } from "../lib/config";
import type { Layout, LayoutRow } from "../lib/layouts";
import type { TerminalProfile } from "../lib/profiles";

interface Props {
  project: ProjectConfig;
  layout: Layout;
  profiles: TerminalProfile[];
  onLayoutChange: (layout: Layout) => void;
}

export function TerminalLayout({ project, layout, profiles, onLayoutChange }: Props) {
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
        />
      ))}
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
}

function RowWithResizer({
  row,
  rowIndex,
  totalRows,
  project,
  profiles,
  layout,
  onLayoutChange,
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
      <div ref={containerRef} style={{ ...styles.pane, flex }}>
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
};
