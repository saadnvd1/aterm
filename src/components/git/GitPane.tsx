import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GitStatus, GitFile } from "../../lib/git";
import { GitPanelTabs, GitTab } from "./GitPanelTabs";
import { FileChanges } from "./FileChanges";
import { DiffViewer } from "./DiffViewer";
import { CommitForm } from "./CommitForm";
import { CommitHistory } from "./CommitHistory";

interface Props {
  id: string;
  cwd: string;
  accentColor?: string;
  onFocus?: () => void;
  onClose?: () => void;
  canClose?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const POLL_INTERVAL = 5000; // 5 seconds

export function GitPane({ cwd, accentColor, onFocus, onClose, canClose, dragHandleProps }: Props) {
  const [activeTab, setActiveTab] = useState<GitTab>("changes");
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<GitFile | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeHovered, setCloseHovered] = useState(false);
  const pollRef = useRef<number | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const gitStatus = await invoke<GitStatus>("get_git_status", { path: cwd });
      setStatus(gitStatus);
      setError(null);
    } catch (err) {
      console.error("Failed to load git status:", err);
      setError(String(err));
    }
  }, [cwd]);

  useEffect(() => {
    loadStatus();

    // Poll for status updates
    pollRef.current = window.setInterval(loadStatus, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [loadStatus]);

  async function loadDiff(file: GitFile) {
    try {
      const diffContent = await invoke<string>("get_file_diff", {
        path: cwd,
        file: file.path,
        staged: file.staged,
      });
      setDiff(diffContent);
    } catch (err) {
      console.error("Failed to load diff:", err);
      setDiff("");
    }
  }

  function handleSelectFile(file: GitFile) {
    setSelectedFile(file);
    loadDiff(file);
  }

  async function handleStageFile(file: GitFile) {
    try {
      await invoke("stage_files", { path: cwd, files: [file.path] });
      await loadStatus();
      // If we were viewing this file, update to show staged diff
      if (selectedFile?.path === file.path) {
        const updatedFile = { ...file, staged: true };
        setSelectedFile(updatedFile);
        loadDiff(updatedFile);
      }
    } catch (err) {
      console.error("Failed to stage file:", err);
    }
  }

  async function handleUnstageFile(file: GitFile) {
    try {
      await invoke("unstage_files", { path: cwd, files: [file.path] });
      await loadStatus();
      // If we were viewing this file, update to show unstaged diff
      if (selectedFile?.path === file.path) {
        const updatedFile = { ...file, staged: false };
        setSelectedFile(updatedFile);
        loadDiff(updatedFile);
      }
    } catch (err) {
      console.error("Failed to unstage file:", err);
    }
  }

  async function handleDiscardFile(file: GitFile) {
    const isUntracked = file.status === "untracked";
    const confirmMessage = isUntracked
      ? `Delete untracked file "${file.path}"?`
      : `Discard changes to "${file.path}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await invoke("discard_changes", {
        path: cwd,
        file: file.path,
        isUntracked,
      });
      await loadStatus();
      if (selectedFile?.path === file.path) {
        setSelectedFile(null);
        setDiff("");
      }
    } catch (err) {
      console.error("Failed to discard changes:", err);
    }
  }

  async function handleStageAll() {
    try {
      await invoke("stage_all", { path: cwd });
      await loadStatus();
    } catch (err) {
      console.error("Failed to stage all:", err);
    }
  }

  async function handleUnstageAll() {
    try {
      await invoke("unstage_all", { path: cwd });
      await loadStatus();
    } catch (err) {
      console.error("Failed to unstage all:", err);
    }
  }

  async function handleCommit(message: string) {
    setIsCommitting(true);
    try {
      await invoke("git_commit", { path: cwd, message });
      await loadStatus();
      setSelectedFile(null);
      setDiff("");
    } catch (err) {
      console.error("Failed to commit:", err);
      alert(`Commit failed: ${err}`);
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleCommitAndPush(message: string) {
    setIsCommitting(true);
    try {
      await invoke("git_commit", { path: cwd, message });
      await invoke("git_push", { path: cwd });
      await loadStatus();
      setSelectedFile(null);
      setDiff("");
    } catch (err) {
      console.error("Failed to commit and push:", err);
      alert(`Operation failed: ${err}`);
    } finally {
      setIsCommitting(false);
    }
  }

  const branchDisplay = status ? (
    <>
      <span style={styles.branch}>{status.branch || "HEAD"}</span>
      {(status.ahead > 0 || status.behind > 0) && (
        <span style={styles.aheadBehind}>
          {status.ahead > 0 && <span style={styles.ahead}>↑{status.ahead}</span>}
          {status.behind > 0 && <span style={styles.behind}>↓{status.behind}</span>}
        </span>
      )}
    </>
  ) : null;

  return (
    <div style={styles.container} onClick={onFocus}>
      <div style={styles.header} {...dragHandleProps}>
        <div style={styles.titleRow}>
          {accentColor && <span style={{ ...styles.indicator, backgroundColor: accentColor }} />}
          <span style={styles.title}>Git</span>
          {branchDisplay}
        </div>
        <div style={styles.headerRight}>
          <button style={styles.refreshButton} onClick={() => loadStatus()} title="Refresh">
            ↻
          </button>
          {canClose && (
            <button
              style={{
                ...styles.closeButton,
                ...(closeHovered ? { opacity: 1, backgroundColor: "var(--bg-tertiary)" } : {}),
              }}
              onClick={(e) => {
                e.stopPropagation();
                onClose?.();
              }}
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              title="Close pane"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <GitPanelTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {error ? (
        <div style={styles.error}>
          <span>Not a git repository</span>
        </div>
      ) : activeTab === "changes" ? (
        <div style={styles.changesContainer}>
          <div style={styles.splitPane}>
            <div style={styles.filePanel}>
              {status && (
                <FileChanges
                  staged={status.staged}
                  unstaged={status.unstaged}
                  untracked={status.untracked}
                  selectedFile={selectedFile}
                  onSelectFile={handleSelectFile}
                  onStageFile={handleStageFile}
                  onUnstageFile={handleUnstageFile}
                  onDiscardFile={handleDiscardFile}
                  onStageAll={handleStageAll}
                  onUnstageAll={handleUnstageAll}
                />
              )}
            </div>
            <div style={styles.diffPanel}>
              <DiffViewer diff={diff} fileName={selectedFile?.path} />
            </div>
          </div>
          <CommitForm
            hasStaged={status ? status.staged.length > 0 : false}
            onCommit={handleCommit}
            onCommitAndPush={handleCommitAndPush}
            isCommitting={isCommitting}
          />
        </div>
      ) : (
        <CommitHistory cwd={cwd} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    backgroundColor: "var(--bg)",
    borderRadius: "8px",
    border: "1px solid var(--border-subtle)",
    overflow: "hidden",
  },
  header: {
    padding: "8px 12px",
    backgroundColor: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border-subtle)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
    cursor: "grab",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  indicator: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  title: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text)",
  },
  branch: {
    fontSize: "11px",
    color: "#61afef",
    fontFamily: "var(--font-mono, 'SF Mono', Menlo, monospace)",
    padding: "2px 6px",
    backgroundColor: "var(--bg-tertiary)",
    borderRadius: "4px",
  },
  aheadBehind: {
    display: "flex",
    gap: "4px",
    fontSize: "11px",
  },
  ahead: {
    color: "#98c379",
  },
  behind: {
    color: "#e06c75",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  refreshButton: {
    width: "22px",
    height: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "4px",
    color: "var(--text-muted)",
    fontSize: "14px",
    cursor: "pointer",
    opacity: 0.6,
  },
  closeButton: {
    width: "18px",
    height: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "4px",
    color: "var(--text-muted)",
    fontSize: "16px",
    cursor: "pointer",
    opacity: 0.6,
    transition: "opacity 0.15s ease, background-color 0.15s ease",
  },
  changesContainer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    overflow: "hidden",
  },
  splitPane: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  filePanel: {
    width: "40%",
    minWidth: "200px",
    maxWidth: "400px",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--border-subtle)",
    overflow: "hidden",
  },
  diffPanel: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },
  error: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
    fontSize: "12px",
  },
};
