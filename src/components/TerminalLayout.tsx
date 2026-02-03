import React, { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  DndContext,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { killPty } from "./TerminalPane";
import { RowWithResizer, RowDropZone } from "./terminal-layout";
import { useLayoutDragDrop } from "../hooks";
import type { ProjectConfig } from "../lib/config";
import type { Layout, LayoutRow, LayoutPane } from "../lib/layouts";
import type { TerminalProfile } from "../lib/profiles";

export interface RemoteExecution {
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshKeyPath?: string;
  tmuxSession: string;
}

interface Props {
  project: ProjectConfig;
  layout: Layout;
  profiles: TerminalProfile[];
  defaultFontSize: number;
  defaultScrollback: number;
  paneFontSizes: Record<string, number>;
  onPaneFontSizeChange: (paneInstanceId: string, fontSize: number) => void;
  onLayoutChange: (layout: Layout) => void;
  onPersistentLayoutChange?: (layout: Layout) => void;
  initialInputByPaneId?: Record<string, string | undefined>;
  onInitialInputSentByPaneId?: Record<string, (() => void) | undefined>;
  isProjectActive?: boolean;
  remoteExecution?: RemoteExecution;
}

export function TerminalLayout({
  project,
  layout,
  profiles,
  defaultFontSize,
  defaultScrollback,
  paneFontSizes,
  onPaneFontSizeChange,
  onLayoutChange,
  onPersistentLayoutChange,
  initialInputByPaneId,
  onInitialInputSentByPaneId,
  isProjectActive = true,
  remoteExecution,
}: Props) {
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [maximizedPaneId, setMaximizedPaneId] = useState<string | null>(null);
  const [renamingPaneId, setRenamingPaneId] = useState<string | null>(null);

  // Use the drag-drop hook
  const { activeDragId, sensors, handleDragStart, handleDragEnd } = useLayoutDragDrop({
    layout,
    onLayoutChange,
  });

  // Listen for keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.metaKey && e.key === "Enter") {
        e.preventDefault();
        if (maximizedPaneId) {
          setMaximizedPaneId(null);
        } else if (focusedPaneId) {
          setMaximizedPaneId(focusedPaneId);
        }
        return;
      }

      if (e.metaKey && e.key === "d") {
        e.preventDefault();
        if (focusedPaneId) {
          splitPaneWithShell(focusedPaneId);
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedPaneId, maximizedPaneId, layout]);

  // Listen for close-pane event from Rust (Cmd+W)
  useEffect(() => {
    const unlisten = listen("close-pane", () => {
      const totalPanes = layout.rows.reduce((acc, r) => acc + r.panes.length, 0);
      if (focusedPaneId && totalPanes > 1) {
        const row = layout.rows.find((r) => r.panes.some((p) => p.id === focusedPaneId));
        if (row) {
          closePaneById(focusedPaneId, row.id);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [focusedPaneId, layout]);

  function splitPaneWithShell(paneId: string) {
    const row = layout.rows.find((r) => r.panes.some((p) => p.id === paneId));
    if (!row) return;

    const newPane: LayoutPane = {
      id: crypto.randomUUID(),
      profileId: "shell",
      flex: 1,
    };

    const paneIndex = row.panes.findIndex((p) => p.id === paneId);
    const newRows = layout.rows.map((r) => {
      if (r.id !== row.id) return r;
      const newPanes = [...r.panes];
      newPanes.splice(paneIndex + 1, 0, newPane);
      return { ...r, panes: newPanes };
    });

    onLayoutChange({ ...layout, rows: newRows });
  }

  function splitVertical(paneId: string, rowId: string, profileId: string) {
    const newPane: LayoutPane = {
      id: crypto.randomUUID(),
      profileId,
      flex: 1,
    };

    const newRows = layout.rows.map((row) => {
      if (row.id !== rowId) return row;
      const paneIndex = row.panes.findIndex((p) => p.id === paneId);
      const newPanes = [...row.panes];
      newPanes.splice(paneIndex + 1, 0, newPane);
      return { ...row, panes: newPanes };
    });

    onLayoutChange({ ...layout, rows: newRows });
  }

  function splitHorizontal(rowId: string, profileId: string) {
    const rowIndex = layout.rows.findIndex((r) => r.id === rowId);
    const currentRow = layout.rows[rowIndex];

    const newRow: LayoutRow = {
      id: crypto.randomUUID(),
      flex: currentRow.flex,
      panes: [{ id: crypto.randomUUID(), profileId, flex: 1 }],
    };

    const newRows = [...layout.rows];
    newRows.splice(rowIndex + 1, 0, newRow);
    onLayoutChange({ ...layout, rows: newRows });
  }

  function closePaneById(paneId: string, rowId: string) {
    const totalPanes = layout.rows.reduce((acc, r) => acc + r.panes.length, 0);
    if (totalPanes <= 1) return;

    // Kill the PTY when pane is explicitly closed
    killPty(`${project.id}-${paneId}`);

    const newRows = layout.rows
      .map((row) => {
        if (row.id !== rowId) return row;
        return { ...row, panes: row.panes.filter((p) => p.id !== paneId) };
      })
      .filter((row) => row.panes.length > 0);

    onLayoutChange({ ...layout, rows: newRows });
  }

  const totalPanes = layout.rows.reduce((acc, r) => acc + r.panes.length, 0);

  // Get all pane IDs for the single sortable context
  const allPaneIds = layout.rows.flatMap((row) => row.panes.map((p) => p.id));

  // Find the active pane for drag overlay
  const activePane = activeDragId
    ? layout.rows.flatMap((r) => r.panes).find((p) => p.id === activeDragId)
    : null;
  const activeProfile = activePane
    ? profiles.find((p) => p.id === activePane.profileId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allPaneIds} strategy={rectSortingStrategy}>
        <div className="flex flex-col flex-1 gap-0 p-1.5 bg-background min-h-0">
          {/* Drop zone at top */}
          {activeDragId && <RowDropZone id="row-drop-0" />}

          {layout.rows.map((row, rowIndex) => (
            <React.Fragment key={row.id}>
              <RowWithResizer
                row={row}
                rowIndex={rowIndex}
                totalRows={layout.rows.length}
                totalPanes={totalPanes}
                project={project}
                profiles={profiles}
                layout={layout}
                defaultFontSize={defaultFontSize}
                defaultScrollback={defaultScrollback}
                paneFontSizes={paneFontSizes}
                onPaneFontSizeChange={onPaneFontSizeChange}
                onLayoutChange={onLayoutChange}
                onPersistentLayoutChange={onPersistentLayoutChange}
                initialInputByPaneId={initialInputByPaneId}
                onInitialInputSentByPaneId={onInitialInputSentByPaneId}
                onSplitVertical={(paneId, profileId) => splitVertical(paneId, row.id, profileId)}
                onSplitHorizontal={(profileId) => splitHorizontal(row.id, profileId)}
                onPaneFocus={setFocusedPaneId}
                focusedPaneId={focusedPaneId}
                maximizedPaneId={maximizedPaneId}
                onToggleMaximize={(paneId) => {
                  setMaximizedPaneId((current) => (current === paneId ? null : paneId));
                }}
                onClosePane={closePaneById}
                renamingPaneId={renamingPaneId}
                onRenamingComplete={() => setRenamingPaneId(null)}
                onStartRename={(paneId) => setRenamingPaneId(paneId)}
                activeDragId={activeDragId}
                isProjectActive={isProjectActive}
                remoteExecution={remoteExecution}
              />
              {/* Drop zone after each row */}
              {activeDragId && <RowDropZone id={`row-drop-${rowIndex + 1}`} />}
            </React.Fragment>
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeDragId && activeProfile && (
          <div className="px-3 py-2 bg-muted border border-primary rounded-md flex items-center gap-2 text-xs text-foreground shadow-lg">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: activeProfile.color }}
            />
            {activeProfile.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
