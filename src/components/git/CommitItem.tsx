import { useState } from "react";
import type { CommitSummary, CommitFile } from "../../lib/git";

interface Props {
  commit: CommitSummary;
  isSelected: boolean;
  files: CommitFile[] | null;
  selectedFile: string | null;
  onSelect: () => void;
  onSelectFile: (file: string) => void;
  isLoading: boolean;
}

export function CommitItem({
  commit,
  isSelected,
  files,
  selectedFile,
  onSelect,
  onSelectFile,
  isLoading,
}: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.header,
          backgroundColor: isSelected ? "var(--bg-tertiary)" : hovered ? "var(--bg-secondary)" : "transparent",
        }}
        onClick={onSelect}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={styles.headerLeft}>
          <span style={styles.hash}>{commit.shortHash}</span>
          <span style={styles.subject}>{commit.subject}</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.time}>{commit.relativeTime}</span>
          {commit.filesChanged > 0 && (
            <span style={styles.stats}>
              <span style={styles.additions}>+{commit.additions}</span>
              <span style={styles.deletions}>-{commit.deletions}</span>
            </span>
          )}
        </div>
      </div>

      {isSelected && (
        <div style={styles.details}>
          <div style={styles.meta}>
            <span style={styles.author}>{commit.author}</span>
            <span style={styles.fullHash}>{commit.hash}</span>
          </div>

          {isLoading ? (
            <div style={styles.loading}>Loading files...</div>
          ) : files && files.length > 0 ? (
            <div style={styles.fileList}>
              {files.map((file) => (
                <div
                  key={file.path}
                  style={{
                    ...styles.file,
                    backgroundColor: selectedFile === file.path ? "var(--bg)" : "transparent",
                  }}
                  onClick={() => onSelectFile(file.path)}
                >
                  <span style={{ ...styles.fileStatus, color: getStatusColor(file.status) }}>
                    {getStatusIcon(file.status)}
                  </span>
                  <span style={styles.filePath}>{file.path}</span>
                  <span style={styles.fileStats}>
                    {file.additions > 0 && <span style={styles.additions}>+{file.additions}</span>}
                    {file.deletions > 0 && <span style={styles.deletions}>-{file.deletions}</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.noFiles}>No files changed</div>
          )}
        </div>
      )}
    </div>
  );
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "added": return "A";
    case "modified": return "M";
    case "deleted": return "D";
    case "renamed": return "R";
    default: return "?";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "added": return "#98c379";
    case "modified": return "#e2c08d";
    case "deleted": return "#e06c75";
    case "renamed": return "#61afef";
    default: return "var(--text-muted)";
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderBottom: "1px solid var(--border-subtle)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    cursor: "pointer",
    gap: "12px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    overflow: "hidden",
    flex: 1,
  },
  hash: {
    fontFamily: "var(--font-mono, 'SF Mono', Menlo, monospace)",
    fontSize: "11px",
    color: "#61afef",
    flexShrink: 0,
  },
  subject: {
    fontSize: "12px",
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexShrink: 0,
  },
  time: {
    fontSize: "11px",
    color: "var(--text-muted)",
  },
  stats: {
    display: "flex",
    gap: "6px",
    fontFamily: "var(--font-mono, 'SF Mono', Menlo, monospace)",
    fontSize: "10px",
  },
  additions: {
    color: "#98c379",
  },
  deletions: {
    color: "#e06c75",
  },
  details: {
    padding: "0 12px 12px 12px",
  },
  meta: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 0",
    borderBottom: "1px solid var(--border-subtle)",
    marginBottom: "8px",
  },
  author: {
    fontSize: "11px",
    color: "var(--text-muted)",
  },
  fullHash: {
    fontFamily: "var(--font-mono, 'SF Mono', Menlo, monospace)",
    fontSize: "10px",
    color: "var(--text-subtle)",
  },
  loading: {
    padding: "8px 0",
    fontSize: "11px",
    color: "var(--text-muted)",
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  file: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 8px",
    borderRadius: "4px",
    cursor: "pointer",
  },
  fileStatus: {
    fontFamily: "var(--font-mono, 'SF Mono', Menlo, monospace)",
    fontSize: "10px",
    fontWeight: 600,
    width: "12px",
  },
  filePath: {
    fontSize: "11px",
    color: "var(--text)",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileStats: {
    display: "flex",
    gap: "6px",
    fontFamily: "var(--font-mono, 'SF Mono', Menlo, monospace)",
    fontSize: "10px",
  },
  noFiles: {
    padding: "8px 0",
    fontSize: "11px",
    color: "var(--text-muted)",
  },
};
