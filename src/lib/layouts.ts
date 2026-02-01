// Layouts - arrangements of terminal profiles (like iTerm2 window arrangements)

export interface LayoutPane {
  id: string;
  profileId: string;
  flex: number; // Flex grow value for sizing
}

export interface LayoutRow {
  id: string;
  panes: LayoutPane[];
  flex: number; // Flex grow value for row height
}

export interface Layout {
  id: string;
  name: string;
  rows: LayoutRow[];
}

// Default layouts
export const DEFAULT_LAYOUTS: Layout[] = [
  {
    id: "ai-shell",
    name: "AI + Shell",
    rows: [
      {
        id: "row-1",
        flex: 1,
        panes: [
          { id: "pane-1", profileId: "claude", flex: 2 },
          { id: "pane-2", profileId: "shell", flex: 1 },
        ],
      },
    ],
  },
  {
    id: "ai-dev-shell",
    name: "AI + Dev + Shell",
    rows: [
      {
        id: "row-1",
        flex: 1,
        panes: [
          { id: "pane-1", profileId: "claude", flex: 2 },
          { id: "pane-2", profileId: "dev-server", flex: 1 },
        ],
      },
      {
        id: "row-2",
        flex: 0.3,
        panes: [{ id: "pane-3", profileId: "shell", flex: 1 }],
      },
    ],
  },
  {
    id: "focused",
    name: "Focused AI",
    rows: [
      {
        id: "row-1",
        flex: 1,
        panes: [{ id: "pane-1", profileId: "claude", flex: 1 }],
      },
    ],
  },
  {
    id: "split-vertical",
    name: "Split Vertical",
    rows: [
      {
        id: "row-1",
        flex: 1,
        panes: [
          { id: "pane-1", profileId: "claude", flex: 1 },
          { id: "pane-2", profileId: "shell", flex: 1 },
        ],
      },
    ],
  },
  {
    id: "split-horizontal",
    name: "Split Horizontal",
    rows: [
      {
        id: "row-1",
        flex: 1,
        panes: [{ id: "pane-1", profileId: "claude", flex: 1 }],
      },
      {
        id: "row-2",
        flex: 1,
        panes: [{ id: "pane-2", profileId: "shell", flex: 1 }],
      },
    ],
  },
  {
    id: "quad",
    name: "Quad",
    rows: [
      {
        id: "row-1",
        flex: 1,
        panes: [
          { id: "pane-1", profileId: "claude", flex: 1 },
          { id: "pane-2", profileId: "shell", flex: 1 },
        ],
      },
      {
        id: "row-2",
        flex: 1,
        panes: [
          { id: "pane-3", profileId: "dev-server", flex: 1 },
          { id: "pane-4", profileId: "tests", flex: 1 },
        ],
      },
    ],
  },
];

export function createLayout(name: string): Layout {
  return {
    id: crypto.randomUUID(),
    name,
    rows: [
      {
        id: crypto.randomUUID(),
        flex: 1,
        panes: [
          {
            id: crypto.randomUUID(),
            profileId: "shell",
            flex: 1,
          },
        ],
      },
    ],
  };
}

export function addPaneToRow(
  layout: Layout,
  rowId: string,
  profileId: string
): Layout {
  return {
    ...layout,
    rows: layout.rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            panes: [
              ...row.panes,
              { id: crypto.randomUUID(), profileId, flex: 1 },
            ],
          }
        : row
    ),
  };
}

export function addRow(layout: Layout, profileId: string): Layout {
  return {
    ...layout,
    rows: [
      ...layout.rows,
      {
        id: crypto.randomUUID(),
        flex: 1,
        panes: [{ id: crypto.randomUUID(), profileId, flex: 1 }],
      },
    ],
  };
}

export function removePane(layout: Layout, paneId: string): Layout {
  return {
    ...layout,
    rows: layout.rows
      .map((row) => ({
        ...row,
        panes: row.panes.filter((p) => p.id !== paneId),
      }))
      .filter((row) => row.panes.length > 0),
  };
}

export function updatePaneFlex(
  layout: Layout,
  paneId: string,
  flex: number
): Layout {
  return {
    ...layout,
    rows: layout.rows.map((row) => ({
      ...row,
      panes: row.panes.map((p) => (p.id === paneId ? { ...p, flex } : p)),
    })),
  };
}

export function updateRowFlex(
  layout: Layout,
  rowId: string,
  flex: number
): Layout {
  return {
    ...layout,
    rows: layout.rows.map((row) =>
      row.id === rowId ? { ...row, flex } : row
    ),
  };
}
