import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SortablePane } from "./SortablePane";
import type { RowProps } from "./types";

export function RowWithResizer({
  row,
  rowIndex,
  totalRows,
  totalPanes,
  project,
  profiles,
  layout,
  defaultFontSize,
  defaultScrollback,
  paneFontSizes,
  onPaneFontSizeChange,
  onLayoutChange,
  onPersistentLayoutChange,
  initialInputByPaneId,
  onInitialInputSentByPaneId,
  onSplitVertical,
  onSplitHorizontal,
  onPaneFocus,
  focusedPaneId,
  maximizedPaneId,
  onToggleMaximize,
  onClosePane,
  renamingPaneId,
  onRenamingComplete,
  onStartRename,
  activeDragId,
  isProjectActive,
  remoteExecution,
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
              profiles={profiles}
              row={row}
              layout={layout}
              defaultFontSize={defaultFontSize}
              defaultScrollback={defaultScrollback}
              fontSize={paneFontSizes[`${project.id}-${pane.id}`]}
              onFontSizeChange={(size) => onPaneFontSizeChange(`${project.id}-${pane.id}`, size)}
              onLayoutChange={onLayoutChange}
              onPersistentLayoutChange={onPersistentLayoutChange}
              initialInput={initialInputByPaneId?.[pane.id]}
              onInitialInputSent={onInitialInputSentByPaneId?.[pane.id]}
              onSplitVertical={(profileId) => onSplitVertical(pane.id, profileId)}
              onSplitHorizontal={onSplitHorizontal}
              onFocus={() => onPaneFocus(pane.id)}
              onRename={() => {}} // Handled internally by SortablePane
              isFocused={focusedPaneId === pane.id}
              isMaximized={maximizedPaneId === pane.id}
              isHidden={maximizedPaneId !== null && maximizedPaneId !== pane.id}
              onToggleMaximize={() => onToggleMaximize(pane.id)}
              onClosePane={() => onClosePane(pane.id, row.id)}
              canClose={totalPanes > 1}
              triggerRename={renamingPaneId === pane.id}
              onTriggerRenameComplete={onRenamingComplete}
              onStartRename={() => onStartRename(pane.id)}
              activeDragId={activeDragId}
              isProjectActive={isProjectActive}
              remoteExecution={remoteExecution}
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
