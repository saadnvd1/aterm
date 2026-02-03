import React, { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { killPty } from "./TerminalPane";
import { terminalInstances } from "./terminal-pane";
import { RowWithResizer, RowDropZone } from "./terminal-layout";
import type { ProjectConfig } from "../lib/config";
import type { Layout, LayoutRow, LayoutPane } from "../lib/layouts";
import type { TerminalProfile } from "../lib/profiles";

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
  onDetachPane?: (paneId: string) => void;
  isProjectActive?: boolean;
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
  onDetachPane,
  isProjectActive = true,
}: Props) {
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [maximizedPaneId, setMaximizedPaneId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [renamingPaneId, setRenamingPaneId] = useState<string | null>(null);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get all pane IDs in order for cycling
  const allPaneIds = layout.rows.flatMap((row) => row.panes.map((p) => p.id));

  // Cycle to next/previous pane
  function cyclePanes(direction: "next" | "prev") {
    if (allPaneIds.length === 0) return;

    const currentIndex = focusedPaneId ? allPaneIds.indexOf(focusedPaneId) : -1;
    let newIndex: number;

    if (direction === "next") {
      newIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % allPaneIds.length;
    } else {
      newIndex = currentIndex === -1 ? allPaneIds.length - 1 : (currentIndex - 1 + allPaneIds.length) % allPaneIds.length;
    }

    const newPaneId = allPaneIds[newIndex];
    setFocusedPaneId(newPaneId);

    // If maximized, switch which pane is maximized
    if (maximizedPaneId) {
      setMaximizedPaneId(newPaneId);
    }

    // Focus the terminal
    const terminalId = `${project.id}-${newPaneId}`;
    const instance = terminalInstances.get(terminalId);
    if (instance) {
      // Small delay to ensure DOM is ready after potential maximize switch
      requestAnimationFrame(() => {
        instance.terminal.focus();
      });
    }
  }

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

      // Cmd+Shift+[ - previous pane
      if (e.shiftKey && e.metaKey && e.key === "[") {
        e.preventDefault();
        cyclePanes("prev");
        return;
      }

      // Cmd+Shift+] - next pane
      if (e.shiftKey && e.metaKey && e.key === "]") {
        e.preventDefault();
        cyclePanes("next");
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
  }, [focusedPaneId, maximizedPaneId, layout, allPaneIds]);

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

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which row contains the active pane
    let sourceRowId: string | null = null;
    let sourcePane: LayoutPane | null = null;

    for (const row of layout.rows) {
      const pane = row.panes.find((p) => p.id === activeId);
      if (pane) {
        sourceRowId = row.id;
        sourcePane = pane;
        break;
      }
    }

    if (!sourceRowId || !sourcePane) return;

    // Check if dropping on a row drop zone (to create new row)
    if (overId.startsWith("row-drop-")) {
      handleRowDrop(overId, sourceRowId, sourcePane, activeId);
      return;
    }

    // Check if dropping on a pane edge zone (iTerm2-style splitting)
    if (overId.startsWith("edge-")) {
      handleEdgeDrop(overId, sourceRowId, sourcePane, activeId);
      return;
    }

    // Handle pane-to-pane drop (reorder)
    handlePaneDrop(overId, sourceRowId, sourcePane, activeId);
  }

  function handleRowDrop(overId: string, sourceRowId: string, sourcePane: LayoutPane, activeId: string) {
    const insertIndex = parseInt(overId.replace("row-drop-", ""), 10);
    const sourceRow = layout.rows.find((r) => r.id === sourceRowId);

    // Create new row with the pane
    const newRow: LayoutRow = {
      id: crypto.randomUUID(),
      flex: sourceRow?.flex || 1,
      panes: [{ ...sourcePane, flex: 1 }],
    };

    // Remove pane from source row
    let newRows = layout.rows.map((row) => {
      if (row.id === sourceRowId) {
        return { ...row, panes: row.panes.filter((p) => p.id !== activeId) };
      }
      return row;
    });

    // Remove empty rows
    newRows = newRows.filter((row) => row.panes.length > 0);

    // Adjust insert index if source row was removed and was before insert point
    const sourceRowIndex = layout.rows.findIndex((r) => r.id === sourceRowId);
    const sourceRowRemoved = layout.rows.find((r) => r.id === sourceRowId)?.panes.length === 1;
    const adjustedIndex = sourceRowRemoved && sourceRowIndex < insertIndex ? insertIndex - 1 : insertIndex;

    // Insert new row at position
    newRows.splice(adjustedIndex, 0, newRow);
    onLayoutChange({ ...layout, rows: newRows });
  }

  function handleEdgeDrop(overId: string, sourceRowId: string, sourcePane: LayoutPane, activeId: string) {
    const match = overId.match(/^edge-(left|right|top|bottom)-(.+)$/);
    if (!match) return;

    const [, position, targetPaneId] = match;

    // Find the target pane's row and index
    let targetRowId: string | null = null;
    let targetRowIndex = -1;
    let targetPaneIndex = -1;

    for (let ri = 0; ri < layout.rows.length; ri++) {
      const row = layout.rows[ri];
      const pi = row.panes.findIndex((p) => p.id === targetPaneId);
      if (pi !== -1) {
        targetRowId = row.id;
        targetRowIndex = ri;
        targetPaneIndex = pi;
        break;
      }
    }

    if (!targetRowId || targetPaneIndex === -1) return;

    const sourceRow = layout.rows.find((r) => r.id === sourceRowId);

    if (position === "left" || position === "right") {
      // Insert pane into the same row as target
      const insertAtIndex = position === "left" ? targetPaneIndex : targetPaneIndex + 1;

      let newRows = layout.rows.map((row) => {
        if (row.id === sourceRowId && row.id !== targetRowId) {
          // Remove from source row (if different from target)
          return { ...row, panes: row.panes.filter((p) => p.id !== activeId) };
        }
        if (row.id === targetRowId) {
          const newPanes = row.panes.filter((p) => p.id !== activeId); // Remove if same row
          newPanes.splice(
            // Adjust index if we removed from earlier position
            sourceRowId === targetRowId && row.panes.findIndex((p) => p.id === activeId) < insertAtIndex
              ? insertAtIndex - 1
              : insertAtIndex,
            0,
            { ...sourcePane, flex: 1 }
          );
          return { ...row, panes: newPanes };
        }
        return row;
      });

      // Remove empty rows
      newRows = newRows.filter((row) => row.panes.length > 0);
      onLayoutChange({ ...layout, rows: newRows });
    } else {
      // top or bottom - create a new row
      const insertRowIndex = position === "top" ? targetRowIndex : targetRowIndex + 1;

      // Create new row with the pane
      const newRow: LayoutRow = {
        id: crypto.randomUUID(),
        flex: sourceRow?.flex || 1,
        panes: [{ ...sourcePane, flex: 1 }],
      };

      // Remove pane from source row
      let newRows = layout.rows.map((row) => {
        if (row.id === sourceRowId) {
          return { ...row, panes: row.panes.filter((p) => p.id !== activeId) };
        }
        return row;
      });

      // Remove empty rows
      newRows = newRows.filter((row) => row.panes.length > 0);

      // Adjust insert index if source row was removed and was before insert point
      const sourceRowIdx = layout.rows.findIndex((r) => r.id === sourceRowId);
      const sourceRowRemoved = layout.rows.find((r) => r.id === sourceRowId)?.panes.length === 1;
      const adjustedIndex = sourceRowRemoved && sourceRowIdx < insertRowIndex ? insertRowIndex - 1 : insertRowIndex;

      // Insert new row at position
      newRows.splice(adjustedIndex, 0, newRow);
      onLayoutChange({ ...layout, rows: newRows });
    }
  }

  function handlePaneDrop(overId: string, sourceRowId: string, sourcePane: LayoutPane, activeId: string) {
    // Find which row contains the target pane
    let targetRowId: string | null = null;
    let targetIndex = -1;

    for (const row of layout.rows) {
      const idx = row.panes.findIndex((p) => p.id === overId);
      if (idx !== -1) {
        targetRowId = row.id;
        targetIndex = idx;
        break;
      }
    }

    if (!targetRowId || targetIndex === -1) return;

    // Reorder within the same row
    if (sourceRowId === targetRowId) {
      const newRows = layout.rows.map((row) => {
        if (row.id !== sourceRowId) return row;

        const oldIndex = row.panes.findIndex((p) => p.id === activeId);
        const newPanes = [...row.panes];
        newPanes.splice(oldIndex, 1);
        newPanes.splice(targetIndex, 0, sourcePane!);
        return { ...row, panes: newPanes };
      });

      onLayoutChange({ ...layout, rows: newRows });
    } else {
      // Move between rows
      let newRows = layout.rows.map((row) => {
        if (row.id === sourceRowId) {
          return { ...row, panes: row.panes.filter((p) => p.id !== activeId) };
        }
        if (row.id === targetRowId) {
          const newPanes = [...row.panes];
          newPanes.splice(targetIndex, 0, sourcePane!);
          return { ...row, panes: newPanes };
        }
        return row;
      });

      // Remove empty rows
      newRows = newRows.filter((row) => row.panes.length > 0);
      onLayoutChange({ ...layout, rows: newRows });
    }
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
                onDetachPane={onDetachPane}
                activeDragId={activeDragId}
                isProjectActive={isProjectActive}
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
