import { useState, useCallback } from "react";
import {
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Layout, LayoutRow, LayoutPane } from "../lib/layouts";

interface UseLayoutDragDropOptions {
  layout: Layout;
  onLayoutChange: (layout: Layout) => void;
}

interface UseLayoutDragDropResult {
  activeDragId: string | null;
  sensors: ReturnType<typeof useSensors>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

/**
 * Hook that handles all drag-drop logic for terminal layout.
 * Extracts DndContext setup, drag handlers, and pane movement/splitting logic.
 */
export function useLayoutDragDrop({
  layout,
  onLayoutChange,
}: UseLayoutDragDropOptions): UseLayoutDragDropResult {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
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
    },
    [layout, onLayoutChange]
  );

  function handleRowDrop(
    overId: string,
    sourceRowId: string,
    sourcePane: LayoutPane,
    activeId: string
  ) {
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
    const adjustedIndex =
      sourceRowRemoved && sourceRowIndex < insertIndex ? insertIndex - 1 : insertIndex;

    // Insert new row at position
    newRows.splice(adjustedIndex, 0, newRow);
    onLayoutChange({ ...layout, rows: newRows });
  }

  function handleEdgeDrop(
    overId: string,
    sourceRowId: string,
    sourcePane: LayoutPane,
    activeId: string
  ) {
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
            sourceRowId === targetRowId &&
              row.panes.findIndex((p) => p.id === activeId) < insertAtIndex
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
      const adjustedIndex =
        sourceRowRemoved && sourceRowIdx < insertRowIndex ? insertRowIndex - 1 : insertRowIndex;

      // Insert new row at position
      newRows.splice(adjustedIndex, 0, newRow);
      onLayoutChange({ ...layout, rows: newRows });
    }
  }

  function handlePaneDrop(
    overId: string,
    sourceRowId: string,
    sourcePane: LayoutPane,
    activeId: string
  ) {
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

  return {
    activeDragId,
    sensors,
    handleDragStart,
    handleDragEnd,
  };
}
