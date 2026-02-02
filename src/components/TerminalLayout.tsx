import React, { useState, useRef, useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TerminalPane } from "./TerminalPane";
import { GitPane } from "./git/GitPane";
import type { ProjectConfig } from "../lib/config";
import { updatePaneName, type Layout, type LayoutRow, type LayoutPane } from "../lib/layouts";
import type { TerminalProfile } from "../lib/profiles";
import { PROVIDERS } from "../lib/providers";

// Build command with auto-approve flag if skipPermissions is enabled
function buildCommand(
  profileCommand: string | undefined,
  skipPermissions: boolean | undefined
): string | undefined {
  if (!profileCommand || !skipPermissions) return profileCommand;

  // Check if the command matches a provider CLI
  const provider = Object.values(PROVIDERS).find(
    (p) => p.cli && profileCommand.startsWith(p.cli)
  );

  if (provider?.autoApproveFlag) {
    // Append the auto-approve flag to the command
    return `${profileCommand} ${provider.autoApproveFlag}`;
  }

  return profileCommand;
}

interface Props {
  project: ProjectConfig;
  layout: Layout;
  profiles: TerminalProfile[];
  onLayoutChange: (layout: Layout) => void;
  onPersistentLayoutChange?: (layout: Layout) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  paneId: string;
  rowId: string;
}

export function TerminalLayout({ project, layout, profiles, onLayoutChange, onPersistentLayoutChange }: Props) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showProfileSubmenu, setShowProfileSubmenu] = useState<"vertical" | "horizontal" | null>(null);
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
      return;
    }

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
      panes: [{ id: crypto.randomUUID(), profileId, flex: 1 }],
    };

    const newRows = [...layout.rows];
    newRows.splice(rowIndex + 1, 0, newRow);
    onLayoutChange({ ...layout, rows: newRows });
    closeContextMenu();
  }

  function closePaneById(paneId: string, rowId: string) {
    const totalPanes = layout.rows.reduce((acc, r) => acc + r.panes.length, 0);
    if (totalPanes <= 1) return;

    const newRows = layout.rows
      .map((row) => {
        if (row.id !== rowId) return row;
        return { ...row, panes: row.panes.filter((p) => p.id !== paneId) };
      })
      .filter((row) => row.panes.length > 0);

    onLayoutChange({ ...layout, rows: newRows });
  }

  function closePane() {
    if (!contextMenu) return;
    closePaneById(contextMenu.paneId, contextMenu.rowId);
    closeContextMenu();
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
                onLayoutChange={onLayoutChange}
                onPersistentLayoutChange={onPersistentLayoutChange}
                onContextMenu={handleContextMenu}
                onPaneFocus={setFocusedPaneId}
                focusedPaneId={focusedPaneId}
                maximizedPaneId={maximizedPaneId}
                onToggleMaximize={(paneId) => {
                  setMaximizedPaneId((current) => (current === paneId ? null : paneId));
                }}
                onClosePane={closePaneById}
                renamingPaneId={renamingPaneId}
                onRenamingComplete={() => setRenamingPaneId(null)}
              />
              {/* Drop zone after each row */}
              {activeDragId && <RowDropZone id={`row-drop-${rowIndex + 1}`} />}
            </React.Fragment>
          ))}

        {contextMenu && (
          <>
            <div className="fixed inset-0 z-popover" onClick={closeContextMenu} />
            <div
              className="fixed bg-popover border border-border rounded-lg shadow-lg z-modal min-w-[160px] p-1 overflow-visible animate-popover-in"
              style={{
                left: contextMenu.x,
                top: contextMenu.y,
              }}
            >
              <div
                className="flex justify-between items-center px-3 py-2 text-foreground text-xs cursor-pointer rounded relative hover:bg-accent"
                onMouseEnter={() => setShowProfileSubmenu("vertical")}
              >
                <span>Split Vertical</span>
                <span className="text-[10px] text-muted-foreground">▸</span>
                {showProfileSubmenu === "vertical" && (
                  <div className="absolute left-full top-0 bg-popover border border-border rounded-lg shadow-lg min-w-[140px] p-1 ml-1">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 bg-transparent border-none text-foreground text-xs cursor-pointer rounded text-left hover:bg-accent"
                      onClick={() => splitVertical("shell")}
                    >
                      Shell (default)
                    </button>
                    <div className="h-px bg-border my-1" />
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-transparent border-none text-foreground text-xs cursor-pointer rounded text-left hover:bg-accent"
                        onClick={() => splitVertical(p.id)}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="flex justify-between items-center px-3 py-2 text-foreground text-xs cursor-pointer rounded relative hover:bg-accent"
                onMouseEnter={() => setShowProfileSubmenu("horizontal")}
              >
                <span>Split Horizontal</span>
                <span className="text-[10px] text-muted-foreground">▸</span>
                {showProfileSubmenu === "horizontal" && (
                  <div className="absolute left-full top-0 bg-popover border border-border rounded-lg shadow-lg min-w-[140px] p-1 ml-1">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 bg-transparent border-none text-foreground text-xs cursor-pointer rounded text-left hover:bg-accent"
                      onClick={() => splitHorizontal("shell")}
                    >
                      Shell (default)
                    </button>
                    <div className="h-px bg-border my-1" />
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-transparent border-none text-foreground text-xs cursor-pointer rounded text-left hover:bg-accent"
                        onClick={() => splitHorizontal(p.id)}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-border my-1" />
              <button
                className="w-full flex justify-between items-center px-3 py-2 bg-transparent border-none text-foreground text-xs cursor-pointer rounded text-left hover:bg-accent"
                onClick={() => {
                  setRenamingPaneId(contextMenu.paneId);
                  closeContextMenu();
                }}
                onMouseEnter={() => setShowProfileSubmenu(null)}
              >
                Rename
              </button>

              {totalPanes > 1 && (
                <>
                  <div className="h-px bg-border my-1" />
                  <button
                    className="w-full flex justify-between items-center px-3 py-2 bg-transparent border-none text-foreground text-xs cursor-pointer rounded text-left hover:bg-accent"
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

interface RowProps {
  row: LayoutRow;
  rowIndex: number;
  totalRows: number;
  totalPanes: number;
  project: ProjectConfig;
  profiles: TerminalProfile[];
  layout: Layout;
  onLayoutChange: (layout: Layout) => void;
  onPersistentLayoutChange?: (layout: Layout) => void;
  onContextMenu: (e: React.MouseEvent, paneId: string, rowId: string) => void;
  onPaneFocus: (paneId: string) => void;
  focusedPaneId: string | null;
  maximizedPaneId: string | null;
  onToggleMaximize: (paneId: string) => void;
  onClosePane: (paneId: string, rowId: string) => void;
  renamingPaneId: string | null;
  onRenamingComplete: () => void;
}

function RowWithResizer({
  row,
  rowIndex,
  totalRows,
  totalPanes,
  project,
  profiles,
  layout,
  onLayoutChange,
  onPersistentLayoutChange,
  onContextMenu,
  onPaneFocus,
  focusedPaneId,
  maximizedPaneId,
  onToggleMaximize,
  onClosePane,
  renamingPaneId,
  onRenamingComplete,
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
      <div ref={containerRef} className="flex min-h-0 gap-0" style={{ flex: row.flex }}>
        {row.panes.map((pane, paneIndex) => {
          const profile = profiles.find((p) => p.id === pane.profileId);
          const isLast = paneIndex === row.panes.length - 1;

          return (
            <SortablePane
              key={pane.id}
              paneId={pane.id}
              paneIndex={paneIndex}
              flex={pane.flex}
              paneName={pane.name}
              isLast={isLast}
              project={project}
              profile={profile}
              row={row}
              layout={layout}
              onLayoutChange={onLayoutChange}
              onContextMenu={(e) => onContextMenu(e, pane.id, row.id)}
              onFocus={() => onPaneFocus(pane.id)}
              onRename={(name) => {
                const newLayout = updatePaneName(layout, pane.id, name);
                onLayoutChange(newLayout);
                onPersistentLayoutChange?.(newLayout);
              }}
              isFocused={focusedPaneId === pane.id}
              isMaximized={maximizedPaneId === pane.id}
              isHidden={maximizedPaneId !== null && maximizedPaneId !== pane.id}
              onToggleMaximize={() => onToggleMaximize(pane.id)}
              onClosePane={() => onClosePane(pane.id, row.id)}
              canClose={totalPanes > 1}
              triggerRename={renamingPaneId === pane.id}
              onTriggerRenameComplete={onRenamingComplete}
            />
          );
        })}
      </div>
      {rowIndex < totalRows - 1 && !maximizedPaneId && (
        <div
          className={cn(
            "h-1.5 cursor-row-resize bg-transparent transition-colors shrink-0",
            isDragging && "bg-primary"
          )}
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
  paneName: string | undefined;
  isLast: boolean;
  project: ProjectConfig;
  profile: TerminalProfile | undefined;
  row: LayoutRow;
  layout: Layout;
  onLayoutChange: (layout: Layout) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onFocus: () => void;
  onRename: (name: string) => void;
  isFocused: boolean;
  isMaximized: boolean;
  isHidden: boolean;
  onToggleMaximize: () => void;
  onClosePane: () => void;
  canClose: boolean;
  triggerRename: boolean;
  onTriggerRenameComplete: () => void;
}

function SortablePane({
  paneId,
  paneIndex,
  flex,
  paneName,
  isLast,
  project,
  profile,
  row,
  layout,
  onLayoutChange,
  onContextMenu,
  onFocus,
  onRename,
  isFocused,
  isMaximized,
  isHidden,
  onToggleMaximize,
  onClosePane,
  canClose,
  triggerRename,
  onTriggerRenameComplete,
}: PaneProps) {
  const [isDraggingResize, setIsDraggingResize] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: paneId,
  });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handlePaneResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingResize(true);

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
        setIsDraggingResize(false);
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
      <div className="flex min-w-0 min-h-0 relative" style={{ flex }}>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs bg-secondary rounded-lg">
          Profile not found
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={(node) => {
          setNodeRef(node);
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={cn(
          "flex min-w-0 min-h-0 relative",
          isMaximized && "absolute inset-0 z-dropdown",
          isHidden && "invisible"
        )}
        style={{
          ...(!isMaximized ? { flex } : {}),
          ...sortableStyle,
          ...(isDragging ? { opacity: 0.5 } : {}),
        }}
        onContextMenu={onContextMenu}
      >
        {profile.type === "git" ? (
          <GitPane
            id={`${project.id}-${paneId}`}
            title={paneName || profile.name}
            cwd={project.path}
            accentColor={profile.color}
            onFocus={onFocus}
            isFocused={isFocused}
            onClose={onClosePane}
            onRename={onRename}
            triggerRename={triggerRename}
            onTriggerRenameComplete={onTriggerRenameComplete}
            canClose={canClose}
            dragHandleProps={{ ...attributes, ...listeners }}
          />
        ) : (
          <TerminalPane
            id={`${project.id}-${paneId}`}
            title={paneName || profile.name}
            cwd={project.path}
            command={buildCommand(profile.command, project.skipPermissions)}
            accentColor={profile.color}
            onFocus={onFocus}
            isFocused={isFocused}
            isMaximized={isMaximized}
            onToggleMaximize={onToggleMaximize}
            onClose={onClosePane}
            onRename={onRename}
            triggerRename={triggerRename}
            onTriggerRenameComplete={onTriggerRenameComplete}
            canClose={canClose}
            dragHandleProps={{ ...attributes, ...listeners }}
          />
        )}
        {isMaximized && (
          <Button
            variant="outline"
            size="icon-sm"
            className="absolute top-3 right-3 z-modal opacity-70 hover:opacity-100"
            onClick={onToggleMaximize}
            title="Restore (Shift+Cmd+Enter)"
          >
            ⤢
          </Button>
        )}
      </div>
      {!isLast && !isMaximized && (
        <div
          className={cn(
            "w-1.5 cursor-col-resize bg-transparent transition-colors shrink-0",
            isDraggingResize && "bg-primary",
            isHidden && "invisible"
          )}
          onMouseDown={handlePaneResize}
        />
      )}
    </>
  );
}

interface RowDropZoneProps {
  id: string;
}

function RowDropZone({ id }: RowDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-8 mx-1 rounded border-2 border-dashed transition-all duration-150 flex items-center justify-center shrink-0",
        isOver
          ? "border-primary bg-primary/20"
          : "border-muted-foreground/30 bg-muted/30"
      )}
    >
      <span className={cn(
        "text-xs transition-colors",
        isOver ? "text-primary" : "text-muted-foreground"
      )}>
        Drop here for new row
      </span>
    </div>
  );
}
