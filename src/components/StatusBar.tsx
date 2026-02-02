import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ProjectConfig } from "../lib/config";
import type { GitStatus } from "../lib/git";

interface StatusBarProps {
  selectedProject: ProjectConfig | null;
}

export const STATUS_BAR_HEIGHT = 24;

export function StatusBar({ selectedProject }: StatusBarProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedProject) {
      setGitStatus(null);
      return;
    }

    let mounted = true;

    async function fetchGitStatus() {
      if (!selectedProject?.path) return;

      setLoading(true);
      try {
        const status = await invoke<GitStatus>("get_git_status", {
          path: selectedProject.path,
        });
        if (mounted) {
          setGitStatus(status);
        }
      } catch (e) {
        // Not a git repo or error - clear status
        if (mounted) {
          setGitStatus(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchGitStatus();

    // Poll every 5 seconds for updates
    const interval = setInterval(fetchGitStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedProject?.id, selectedProject?.path]);

  const dirtyCount = gitStatus
    ? gitStatus.staged.length + gitStatus.unstaged.length + gitStatus.untracked.length
    : 0;

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        {selectedProject && (
          <span style={styles.projectName}>{selectedProject.name}</span>
        )}
      </div>
      <div style={styles.right}>
        {selectedProject && gitStatus && (
          <>
            {/* Branch name */}
            <div style={styles.item}>
              <span style={styles.branchIcon}>⎇</span>
              <span style={styles.branchName}>{gitStatus.branch || "detached"}</span>
            </div>

            {/* Ahead/behind indicators */}
            {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
              <div style={styles.item}>
                {gitStatus.ahead > 0 && (
                  <span style={styles.ahead}>↑{gitStatus.ahead}</span>
                )}
                {gitStatus.behind > 0 && (
                  <span style={styles.behind}>↓{gitStatus.behind}</span>
                )}
              </div>
            )}

            {/* Dirty indicator */}
            {dirtyCount > 0 && (
              <div style={styles.item}>
                <span style={styles.dirty}>●</span>
                <span style={styles.dirtyCount}>{dirtyCount}</span>
              </div>
            )}
          </>
        )}
        {selectedProject && loading && !gitStatus && (
          <span style={styles.loading}>...</span>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: STATUS_BAR_HEIGHT,
    minHeight: STATUS_BAR_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    backgroundColor: "var(--bg-darker, #1a1a1a)",
    borderTop: "1px solid var(--border)",
    fontSize: "12px",
    color: "var(--text-muted)",
    userSelect: "none",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  projectName: {
    color: "var(--text-muted)",
    opacity: 0.7,
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  branchIcon: {
    fontSize: "11px",
    opacity: 0.7,
  },
  branchName: {
    color: "var(--text)",
    fontWeight: 500,
  },
  ahead: {
    color: "#98c379", // green
  },
  behind: {
    color: "#e5c07b", // yellow
    marginLeft: "4px",
  },
  dirty: {
    color: "#e5c07b", // yellow
    fontSize: "10px",
  },
  dirtyCount: {
    color: "var(--text-muted)",
  },
  loading: {
    opacity: 0.5,
  },
};
