import React, { useState, useRef, useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TerminalPane, serializeRefs } from "../TerminalPane";
import { GitPane } from "../git/GitPane";
import { updatePaneName } from "../../lib/layouts";
import { PROVIDERS } from "../../lib/providers";
import { PaneEdgeDropZone } from "./DropZones";
import { useSession } from "../../context/SessionContext";
import type { PaneProps } from "./types";

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

interface SortablePaneProps extends PaneProps {
  onPersistentLayoutChange?: (layout: import("../../lib/layouts").Layout) => void;
}

export function SortablePane({
  paneId,
  paneIndex,
  flex,
  paneName,
  isLast,
  project,
  profile,
  profiles,
  row,
  layout,
  defaultFontSize,
  defaultScrollback,
  fontSize,
  onFontSizeChange,
  onLayoutChange,
  onPersistentLayoutChange,
  onSplitVertical,
  onSplitHorizontal,
  onFocus,
  onRename: _onRename,
  isFocused,
  isMaximized,
  isHidden,
  onToggleMaximize,
  onClosePane,
  canClose,
  triggerRename,
  onTriggerRenameComplete,
  onStartRename,
  activeDragId,
  isProjectActive,
}: SortablePaneProps) {
  const [isDraggingResize, setIsDraggingResize] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { updatePaneStatus } = useSession();

  // Status change handler - reports to SessionContext (only for detected AI agent panes)
  const handleStatusChange = useCallback(
    (event: import("../../addons/StatusAddon").StatusChangeEvent) => {
      // Only track status for panes that have been detected as AI agents
      if (!event.isAgent) return;
      updatePaneStatus(`${project.id}-${paneId}`, project.id, event.status);
    },
    [updatePaneStatus, project.id, paneId]
  );

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

  const handleRename = (name: string) => {
    const newLayout = updatePaneName(layout, paneId, name);
    onLayoutChange(newLayout);
    onPersistentLayoutChange?.(newLayout);
  };

  if (!profile) {
    return (
      <div className="flex min-w-0 min-h-0 relative" style={{ flex }}>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs bg-secondary rounded-lg">
          Profile not found
        </div>
      </div>
    );
  }

  const paneContent = (
    <>
      {profile.type === "git" ? (
        <GitPane
          id={`${project.id}-${paneId}`}
          title={paneName || profile.name}
          cwd={project.path}
          accentColor={profile.color}
          projectColor={project.color}
          onFocus={onFocus}
          isFocused={isFocused}
          onClose={onClosePane}
          onRename={handleRename}
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
          projectColor={project.color}
          defaultFontSize={defaultFontSize}
          fontSize={fontSize}
          scrollback={profile.scrollback ?? defaultScrollback}
          onFontSizeChange={onFontSizeChange}
          onFocus={onFocus}
          isFocused={isFocused}
          isMaximized={isMaximized}
          onToggleMaximize={onToggleMaximize}
          onClose={onClosePane}
          onRename={handleRename}
          triggerRename={triggerRename}
          onTriggerRenameComplete={onTriggerRenameComplete}
          canClose={canClose}
          dragHandleProps={{ ...attributes, ...listeners }}
          isProjectActive={isProjectActive}
          onStatusChange={handleStatusChange}
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
    </>
  );

  // Show edge drop zones when another pane is being dragged (not this one)
  const showEdgeDropZones = activeDragId !== null && activeDragId !== paneId && !isMaximized;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
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
          >
            {paneContent}
            {/* Edge drop zones for iTerm2-style drag and drop */}
            <PaneEdgeDropZone paneId={paneId} position="left" isVisible={showEdgeDropZones} />
            <PaneEdgeDropZone paneId={paneId} position="right" isVisible={showEdgeDropZones} />
            <PaneEdgeDropZone paneId={paneId} position="top" isVisible={showEdgeDropZones} />
            <PaneEdgeDropZone paneId={paneId} position="bottom" isVisible={showEdgeDropZones} />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuSub>
            <ContextMenuSubTrigger>Split Vertical</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuItem onClick={() => onSplitVertical("shell")}>
                Shell (default)
              </ContextMenuItem>
              <ContextMenuSeparator />
              {profiles.map((p) => (
                <ContextMenuItem key={p.id} onClick={() => onSplitVertical(p.id)}>
                  <span
                    className="w-2 h-2 rounded-full shrink-0 mr-2"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Split Horizontal</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuItem onClick={() => onSplitHorizontal("shell")}>
                Shell (default)
              </ContextMenuItem>
              <ContextMenuSeparator />
              {profiles.map((p) => (
                <ContextMenuItem key={p.id} onClick={() => onSplitHorizontal(p.id)}>
                  <span
                    className="w-2 h-2 rounded-full shrink-0 mr-2"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onStartRename}>Rename</ContextMenuItem>
          {profile?.type !== "git" && (
            <ContextMenuItem onClick={async () => {
              const serializeFn = serializeRefs.get(`${project.id}-${paneId}`);
              if (!serializeFn) return;

              const output = serializeFn();
              const filePath = await save({
                defaultPath: `terminal-output-${new Date().toISOString().slice(0, 10)}.txt`,
                filters: [{ name: "Text Files", extensions: ["txt"] }],
              });

              if (filePath) {
                await writeTextFile(filePath, output);
              }
            }}>
              Save Output
            </ContextMenuItem>
          )}
          {canClose && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={onClosePane}>Close Pane</ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
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
