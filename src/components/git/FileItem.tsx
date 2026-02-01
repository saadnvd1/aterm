import { useState } from "react";
import type { GitFile } from "../../lib/git";
import { getStatusIcon, getStatusColor } from "../../lib/git";

interface Props {
  file: GitFile;
  isSelected: boolean;
  onSelect: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
}

export function FileItem({ file, isSelected, onSelect, onStage, onUnstage, onDiscard }: Props) {
  const [hovered, setHovered] = useState(false);

  const statusIcon = getStatusIcon(file.status);
  const statusColor = getStatusColor(file.status);
  const fileName = file.path.split("/").pop() || file.path;
  const dirPath = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";

  return (
    <div
      style={{
        ...styles.container,
        backgroundColor: isSelected ? "var(--bg-tertiary)" : hovered ? "var(--bg-secondary)" : "transparent",
      }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ ...styles.status, color: statusColor }}>{statusIcon}</span>
      <span style={styles.fileName}>{fileName}</span>
      {dirPath && <span style={styles.dirPath}>{dirPath}</span>}

      {(hovered || isSelected) && (
        <div style={styles.actions}>
          {file.staged && onUnstage && (
            <button
              style={styles.actionButton}
              onClick={(e) => { e.stopPropagation(); onUnstage(); }}
              title="Unstage"
            >
              -
            </button>
          )}
          {!file.staged && onStage && (
            <button
              style={styles.actionButton}
              onClick={(e) => { e.stopPropagation(); onStage(); }}
              title="Stage"
            >
              +
            </button>
          )}
          {!file.staged && onDiscard && (
            <button
              style={{ ...styles.actionButton, ...styles.discardButton }}
              onClick={(e) => { e.stopPropagation(); onDiscard(); }}
              title="Discard changes"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    padding: "4px 8px 4px 16px",
    cursor: "pointer",
    borderRadius: "4px",
    margin: "1px 4px",
    minHeight: "24px",
    gap: "8px",
  },
  status: {
    fontFamily: "var(--font-mono, 'SF Mono', Menlo, monospace)",
    fontSize: "11px",
    fontWeight: 600,
    width: "14px",
    flexShrink: 0,
  },
  fileName: {
    fontSize: "12px",
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dirPath: {
    fontSize: "11px",
    color: "var(--text-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
  actions: {
    display: "flex",
    gap: "4px",
    marginLeft: "auto",
    flexShrink: 0,
  },
  actionButton: {
    width: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "4px",
    color: "var(--text)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    opacity: 0.8,
    transition: "opacity 0.1s",
  },
  discardButton: {
    color: "#e06c75",
  },
};
