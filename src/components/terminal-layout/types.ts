import type { ProjectConfig } from "../../lib/config";
import type { Layout, LayoutRow } from "../../lib/layouts";
import type { TerminalProfile } from "../../lib/profiles";

export interface RowProps {
  row: LayoutRow;
  rowIndex: number;
  totalRows: number;
  totalPanes: number;
  project: ProjectConfig;
  profiles: TerminalProfile[];
  layout: Layout;
  defaultFontSize: number;
  defaultScrollback: number;
  paneFontSizes: Record<string, number>;
  onPaneFontSizeChange: (paneInstanceId: string, fontSize: number) => void;
  onLayoutChange: (layout: Layout) => void;
  onPersistentLayoutChange?: (layout: Layout) => void;
  initialInputByPaneId?: Record<string, string | undefined>;
  onInitialInputSentByPaneId?: Record<string, (() => void) | undefined>;
  onSplitVertical: (paneId: string, profileId: string) => void;
  onSplitHorizontal: (profileId: string) => void;
  onPaneFocus: (paneId: string) => void;
  focusedPaneId: string | null;
  maximizedPaneId: string | null;
  onToggleMaximize: (paneId: string) => void;
  onClosePane: (paneId: string, rowId: string) => void;
  renamingPaneId: string | null;
  onRenamingComplete: () => void;
  onStartRename: (paneId: string) => void;
  onDetachPane?: (paneId: string) => void;
  activeDragId: string | null;
  isProjectActive: boolean;
}

export interface PaneProps {
  paneId: string;
  paneIndex: number;
  flex: number;
  paneName: string | undefined;
  isLast: boolean;
  project: ProjectConfig;
  profile: TerminalProfile | undefined;
  profiles: TerminalProfile[];
  row: LayoutRow;
  layout: Layout;
  defaultFontSize: number;
  defaultScrollback: number;
  fontSize: number | undefined;
  onFontSizeChange: (size: number) => void;
  onLayoutChange: (layout: Layout) => void;
  initialInput?: string;
  onInitialInputSent?: () => void;
  onSplitVertical: (profileId: string) => void;
  onSplitHorizontal: (profileId: string) => void;
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
  onStartRename: () => void;
  onDetachPane?: () => void;
  activeDragId: string | null;
  isProjectActive: boolean;
}

export type EdgePosition = "left" | "right" | "top" | "bottom";
