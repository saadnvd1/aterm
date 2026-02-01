import { useState } from "react";
import type { GitFile } from "../../lib/git";
import { FileItem } from "./FileItem";

interface SectionProps {
  title: string;
  files: GitFile[];
  selectedFile: GitFile | null;
  onSelectFile: (file: GitFile) => void;
  onStage?: (file: GitFile) => void;
  onUnstage?: (file: GitFile) => void;
  onDiscard?: (file: GitFile) => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
}

function FileSection({
  title,
  files,
  selectedFile,
  onSelectFile,
  onStage,
  onUnstage,
  onDiscard,
  onStageAll,
  onUnstageAll,
}: SectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (files.length === 0) return null;

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader} onClick={() => setCollapsed(!collapsed)}>
        <span style={styles.collapseIcon}>{collapsed ? "▸" : "▾"}</span>
        <span style={styles.sectionTitle}>{title}</span>
        <span style={styles.fileCount}>({files.length})</span>
        <div style={styles.sectionActions}>
          {onStageAll && (
            <button
              style={styles.sectionButton}
              onClick={(e) => { e.stopPropagation(); onStageAll(); }}
              title="Stage all"
            >
              + All
            </button>
          )}
          {onUnstageAll && (
            <button
              style={styles.sectionButton}
              onClick={(e) => { e.stopPropagation(); onUnstageAll(); }}
              title="Unstage all"
            >
              - All
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div style={styles.fileList}>
          {files.map((file) => (
            <FileItem
              key={file.path}
              file={file}
              isSelected={selectedFile?.path === file.path && selectedFile?.staged === file.staged}
              onSelect={() => onSelectFile(file)}
              onStage={onStage ? () => onStage(file) : undefined}
              onUnstage={onUnstage ? () => onUnstage(file) : undefined}
              onDiscard={onDiscard ? () => onDiscard(file) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  staged: GitFile[];
  unstaged: GitFile[];
  untracked: GitFile[];
  selectedFile: GitFile | null;
  onSelectFile: (file: GitFile) => void;
  onStageFile: (file: GitFile) => void;
  onUnstageFile: (file: GitFile) => void;
  onDiscardFile: (file: GitFile) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
}

export function FileChanges({
  staged,
  unstaged,
  untracked,
  selectedFile,
  onSelectFile,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onStageAll,
  onUnstageAll,
}: Props) {
  const hasChanges = staged.length > 0 || unstaged.length > 0 || untracked.length > 0;

  if (!hasChanges) {
    return (
      <div style={styles.empty}>
        <span style={styles.emptyIcon}>✓</span>
        <span style={styles.emptyText}>No changes</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <FileSection
        title="Staged"
        files={staged}
        selectedFile={selectedFile}
        onSelectFile={onSelectFile}
        onUnstage={onUnstageFile}
        onUnstageAll={staged.length > 0 ? onUnstageAll : undefined}
      />
      <FileSection
        title="Changes"
        files={unstaged}
        selectedFile={selectedFile}
        onSelectFile={onSelectFile}
        onStage={onStageFile}
        onDiscard={onDiscardFile}
        onStageAll={unstaged.length > 0 ? () => {
          unstaged.forEach(f => onStageFile(f));
        } : undefined}
      />
      <FileSection
        title="Untracked"
        files={untracked}
        selectedFile={selectedFile}
        onSelectFile={onSelectFile}
        onStage={onStageFile}
        onDiscard={onDiscardFile}
        onStageAll={untracked.length > 0 ? () => {
          onStageAll();
        } : undefined}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
    flex: 1,
  },
  section: {
    marginBottom: "4px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    padding: "6px 8px",
    cursor: "pointer",
    userSelect: "none",
    gap: "4px",
  },
  collapseIcon: {
    fontSize: "10px",
    color: "var(--text-muted)",
    width: "12px",
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  fileCount: {
    fontSize: "11px",
    color: "var(--text-muted)",
  },
  sectionActions: {
    marginLeft: "auto",
    display: "flex",
    gap: "4px",
  },
  sectionButton: {
    padding: "2px 6px",
    backgroundColor: "transparent",
    border: "1px solid var(--border-subtle)",
    borderRadius: "4px",
    color: "var(--text-muted)",
    fontSize: "10px",
    cursor: "pointer",
    opacity: 0.7,
    transition: "opacity 0.1s",
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    color: "var(--text-muted)",
  },
  emptyIcon: {
    fontSize: "24px",
    color: "#98c379",
  },
  emptyText: {
    fontSize: "12px",
  },
};
