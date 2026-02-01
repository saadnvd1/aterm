import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProviderId, getProviderList } from "../lib/providers";
import { createProject, ProjectConfig } from "../lib/config";

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  isGitRepo: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: (project: ProjectConfig) => void;
}

type Mode = "browse" | "clone";

export function AddProjectModal({ isOpen, onClose, onProjectAdded }: Props) {
  const [mode, setMode] = useState<Mode>("browse");
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [provider, setProvider] = useState<ProviderId>("claude");
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneDestination, setCloneDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providers = getProviderList();

  useEffect(() => {
    if (isOpen) {
      invoke<string>("get_home_dir").then((home) => {
        const devDir = `${home}/dev`;
        setCurrentPath(devDir);
        setCloneDestination(devDir);
        loadDirectory(devDir);
      });
    }
  }, [isOpen]);

  async function loadDirectory(path: string) {
    try {
      const result = await invoke<DirEntry[]>("list_directory", { path });
      setEntries(result);
      setCurrentPath(path);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleEntryClick(entry: DirEntry) {
    if (entry.isDir) {
      loadDirectory(entry.path);
      setSelectedPath(null);
    }
  }

  function selectCurrentFolder() {
    const folderName = currentPath.split("/").pop() || "project";
    setSelectedPath(currentPath);
    setProjectName(folderName);
  }

  function goUp() {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    loadDirectory(parent);
    setSelectedPath(null);
  }

  async function handleAddProject() {
    if (!selectedPath || !projectName) return;

    setLoading(true);
    try {
      const gitRemote = await invoke<string | null>("get_git_remote", {
        path: selectedPath,
      });

      const project = createProject(
        projectName,
        selectedPath,
        provider,
        gitRemote || undefined
      );

      await invoke("add_project", { project });
      onProjectAdded(project);
      onClose();
      resetForm();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCloneProject() {
    if (!cloneUrl) return;

    setLoading(true);
    setError(null);

    try {
      const repoName =
        projectName ||
        cloneUrl.split("/").pop()?.replace(".git", "") ||
        "project";
      const destination = `${cloneDestination}/${repoName}`;

      await invoke("clone_repo", { url: cloneUrl, destination });

      const project = createProject(repoName, destination, provider, cloneUrl);

      await invoke("add_project", { project });
      onProjectAdded(project);
      onClose();
      resetForm();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedPath(null);
    setProjectName("");
    setProvider("claude");
    setCloneUrl("");
    setError(null);
    setMode("browse");
  }

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Add Project</h2>
          <button onClick={onClose} style={styles.closeButton}>
            ×
          </button>
        </div>

        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(mode === "browse" ? styles.tabActive : {}),
            }}
            onClick={() => setMode("browse")}
          >
            Browse
          </button>
          <button
            style={{
              ...styles.tab,
              ...(mode === "clone" ? styles.tabActive : {}),
            }}
            onClick={() => setMode("clone")}
          >
            Clone
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {mode === "browse" ? (
          <div style={styles.content}>
            <div style={styles.pathBar}>
              <button onClick={goUp} style={styles.upButton}>
                ↑
              </button>
              <span style={styles.currentPath}>{currentPath}</span>
              <button
                onClick={selectCurrentFolder}
                style={{
                  ...styles.selectButton,
                  ...(selectedPath === currentPath ? styles.selectButtonActive : {}),
                }}
              >
                {selectedPath === currentPath ? "Selected" : "Select"}
              </button>
            </div>

            <div style={styles.fileList}>
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  style={{
                    ...styles.fileItem,
                    ...(!entry.isDir ? styles.fileItemDisabled : {}),
                  }}
                  onClick={() => handleEntryClick(entry)}
                  disabled={!entry.isDir}
                >
                  <span style={styles.fileIcon}>
                    {entry.isGitRepo ? "◉" : entry.isDir ? "▸" : "○"}
                  </span>
                  <span style={styles.fileName}>{entry.name}</span>
                  {entry.isGitRepo && <span style={styles.gitBadge}>git</span>}
                </button>
              ))}
            </div>

            {selectedPath && (
              <div style={styles.form}>
                <label style={styles.label}>
                  <span style={styles.labelText}>Name</span>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    style={styles.input}
                  />
                </label>

                <label style={styles.label}>
                  <span style={styles.labelText}>Provider</span>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as ProviderId)}
                    style={styles.select}
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.content}>
            <div style={styles.form}>
              <label style={styles.label}>
                <span style={styles.labelText}>Repository URL</span>
                <input
                  type="text"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                <span style={styles.labelText}>Name (optional)</span>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Auto-detected from URL"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                <span style={styles.labelText}>Destination</span>
                <input
                  type="text"
                  value={cloneDestination}
                  onChange={(e) => setCloneDestination(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                <span style={styles.labelText}>Provider</span>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as ProviderId)}
                  style={styles.select}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelButton}>
            Cancel
          </button>
          <button
            onClick={mode === "browse" ? handleAddProject : handleCloneProject}
            disabled={loading || (mode === "browse" ? !selectedPath : !cloneUrl)}
            style={{
              ...styles.addButton,
              ...(loading || (mode === "browse" ? !selectedPath : !cloneUrl)
                ? styles.addButtonDisabled
                : {}),
            }}
          >
            {loading ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    width: "520px",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border-subtle)",
  },
  title: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text)",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    fontSize: "20px",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
  },
  tabs: {
    display: "flex",
    padding: "0 20px",
    borderBottom: "1px solid var(--border-subtle)",
  },
  tab: {
    padding: "12px 16px",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    marginBottom: "-1px",
  },
  tabActive: {
    color: "var(--text)",
    borderBottomColor: "var(--accent)",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "16px 20px",
  },
  pathBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
    padding: "8px 10px",
    backgroundColor: "var(--bg-tertiary)",
    borderRadius: "6px",
    border: "1px solid var(--border-subtle)",
  },
  upButton: {
    width: "24px",
    height: "24px",
    backgroundColor: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  currentPath: {
    flex: 1,
    fontSize: "11px",
    color: "var(--text-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  selectButton: {
    padding: "4px 12px",
    backgroundColor: "var(--accent)",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 500,
    cursor: "pointer",
  },
  selectButtonActive: {
    backgroundColor: "var(--success)",
  },
  fileList: {
    maxHeight: "180px",
    overflow: "auto",
    border: "1px solid var(--border-subtle)",
    borderRadius: "6px",
    marginBottom: "16px",
  },
  fileItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "1px solid var(--border-subtle)",
    color: "var(--text)",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "12px",
    transition: "background-color 0.1s ease",
  },
  fileItemDisabled: {
    opacity: 0.4,
    cursor: "default",
  },
  fileIcon: {
    fontSize: "10px",
    color: "var(--accent)",
    width: "14px",
  },
  fileName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  gitBadge: {
    fontSize: "9px",
    padding: "2px 6px",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "4px",
    color: "var(--success)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  labelText: {
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    padding: "10px 12px",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "6px",
    color: "var(--text)",
    fontSize: "12px",
    outline: "none",
  },
  select: {
    padding: "10px 12px",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "6px",
    color: "var(--text)",
    fontSize: "12px",
    outline: "none",
  },
  error: {
    padding: "10px 16px",
    margin: "12px 20px 0",
    backgroundColor: "rgba(255, 85, 85, 0.1)",
    border: "1px solid rgba(255, 85, 85, 0.3)",
    borderRadius: "6px",
    color: "var(--error)",
    fontSize: "11px",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    padding: "16px 20px",
    borderTop: "1px solid var(--border-subtle)",
  },
  cancelButton: {
    padding: "8px 16px",
    backgroundColor: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--text)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
  },
  addButton: {
    padding: "8px 20px",
    backgroundColor: "var(--accent)",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
  },
  addButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};
