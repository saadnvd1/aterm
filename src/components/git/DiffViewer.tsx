import { useMemo } from "react";

interface Props {
  diff: string;
  fileName?: string;
}

interface DiffLine {
  type: "header" | "hunk" | "added" | "removed" | "context" | "info";
  content: string;
  lineNumber?: { old?: number; new?: number };
}

export function DiffViewer({ diff, fileName }: Props) {
  const lines = useMemo(() => parseDiff(diff), [diff]);

  if (!diff) {
    return (
      <div style={styles.empty}>
        <span style={styles.emptyText}>Select a file to view diff</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {fileName && <div style={styles.fileName}>{fileName}</div>}
      <div style={styles.content}>
        {lines.map((line, i) => (
          <div key={i} style={{ ...styles.line, ...getLineStyle(line.type) }}>
            {line.lineNumber && (
              <span style={styles.lineNumbers}>
                <span style={styles.lineNumber}>{line.lineNumber.old ?? ""}</span>
                <span style={styles.lineNumber}>{line.lineNumber.new ?? ""}</span>
              </span>
            )}
            <span style={styles.lineContent}>{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const rawLine of diff.split("\n")) {
    if (rawLine.startsWith("diff --git") || rawLine.startsWith("index ") ||
        rawLine.startsWith("---") || rawLine.startsWith("+++")) {
      lines.push({ type: "header", content: rawLine });
    } else if (rawLine.startsWith("@@")) {
      // Parse hunk header like "@@ -1,5 +1,8 @@"
      const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      lines.push({ type: "hunk", content: rawLine });
    } else if (rawLine.startsWith("+")) {
      lines.push({
        type: "added",
        content: rawLine.slice(1),
        lineNumber: { new: newLine++ },
      });
    } else if (rawLine.startsWith("-")) {
      lines.push({
        type: "removed",
        content: rawLine.slice(1),
        lineNumber: { old: oldLine++ },
      });
    } else if (rawLine.startsWith(" ")) {
      lines.push({
        type: "context",
        content: rawLine.slice(1),
        lineNumber: { old: oldLine++, new: newLine++ },
      });
    } else if (rawLine.startsWith("New file:") || rawLine.startsWith("Binary")) {
      lines.push({ type: "info", content: rawLine });
    } else if (rawLine.trim()) {
      lines.push({ type: "context", content: rawLine });
    }
  }

  return lines;
}

function getLineStyle(type: DiffLine["type"]): React.CSSProperties {
  switch (type) {
    case "added":
      return { backgroundColor: "rgba(152, 195, 121, 0.15)", color: "#98c379" };
    case "removed":
      return { backgroundColor: "rgba(224, 108, 117, 0.15)", color: "#e06c75" };
    case "hunk":
      return { backgroundColor: "rgba(97, 175, 239, 0.1)", color: "#61afef" };
    case "header":
      return { color: "var(--text-muted)", fontStyle: "italic" };
    case "info":
      return { color: "#61afef" };
    default:
      return {};
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    overflow: "hidden",
  },
  fileName: {
    padding: "8px 12px",
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--text)",
    backgroundColor: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border-subtle)",
  },
  content: {
    flex: 1,
    overflow: "auto",
    fontFamily: "var(--font-mono, 'SF Mono', Menlo, monospace)",
    fontSize: "12px",
    lineHeight: "1.5",
  },
  line: {
    display: "flex",
    minHeight: "18px",
    whiteSpace: "pre",
  },
  lineNumbers: {
    display: "flex",
    flexShrink: 0,
    userSelect: "none",
    borderRight: "1px solid var(--border-subtle)",
  },
  lineNumber: {
    width: "40px",
    padding: "0 8px",
    textAlign: "right",
    color: "var(--text-subtle)",
    fontSize: "11px",
  },
  lineContent: {
    flex: 1,
    padding: "0 12px",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
  },
  emptyText: {
    fontSize: "12px",
  },
};
