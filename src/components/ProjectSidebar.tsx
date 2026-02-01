import { useState } from "react";
import type { ProjectConfig, AppConfig } from "../lib/config";
import { PROVIDERS } from "../lib/providers";
import { AddProjectModal } from "./AddProjectModal";
import { SettingsModal } from "./SettingsModal";

interface Props {
  config: AppConfig;
  selectedProject: ProjectConfig | null;
  onSelectProject: (project: ProjectConfig | null) => void;
  onConfigChange: (config: AppConfig) => void;
  onSaveWindowArrangement: (projectId: string) => void;
  onRestoreWindowArrangement: (projectId: string) => void;
}

export function ProjectSidebar({
  config,
  selectedProject,
  onSelectProject,
  onConfigChange,
  onSaveWindowArrangement,
  onRestoreWindowArrangement,
}: Props) {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    project: ProjectConfig;
    x: number;
    y: number;
  } | null>(null);

  const filtered = config.projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleProjectAdded(project: ProjectConfig) {
    onConfigChange({
      ...config,
      projects: [...config.projects, project],
    });
    onSelectProject(project);
  }

  function handleRemoveProject(projectId: string) {
    const newProjects = config.projects.filter((p) => p.id !== projectId);
    onConfigChange({ ...config, projects: newProjects });
    if (selectedProject?.id === projectId) {
      onSelectProject(newProjects[0] || null);
    }
    setContextMenu(null);
  }

  function handleContextMenu(e: React.MouseEvent, project: ProjectConfig) {
    e.preventDefault();
    setContextMenu({ project, x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <span style={styles.logo}>aTerm</span>
          <div style={styles.headerActions}>
            <button
              onClick={() => setShowSettings(true)}
              style={styles.iconButton}
              title="Settings"
            >
              ⚙
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              style={styles.iconButton}
              title="Add Project"
            >
              +
            </button>
          </div>
        </div>

        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.search}
          />
        </div>

        <div style={styles.list}>
          {filtered.length === 0 ? (
            <div style={styles.empty}>
              {config.projects.length === 0
                ? "No projects yet"
                : "No matches"}
            </div>
          ) : (
            filtered.map((project) => {
              const layout = config.layouts.find((l) => l.id === project.layoutId);
              return (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  onContextMenu={(e) => handleContextMenu(e, project)}
                  style={{
                    ...styles.item,
                    ...(selectedProject?.id === project.id
                      ? styles.itemSelected
                      : {}),
                  }}
                >
                  <div style={styles.itemContent}>
                    <span style={styles.name}>{project.name}</span>
                    <span style={styles.meta}>
                      {PROVIDERS[project.provider]?.name || project.provider}
                      {layout && ` · ${layout.name}`}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {contextMenu && (
        <>
          <div style={styles.contextOverlay} onClick={() => setContextMenu(null)} />
          <div
            style={{
              ...styles.contextMenu,
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              style={styles.contextMenuItem}
              onClick={() => {
                onSaveWindowArrangement(contextMenu.project.id);
                setContextMenu(null);
              }}
            >
              Save Window Arrangement
            </button>
            <button
              style={styles.contextMenuItem}
              onClick={() => {
                onRestoreWindowArrangement(contextMenu.project.id);
                setContextMenu(null);
              }}
            >
              Restore Window Arrangement
            </button>
            <div style={styles.menuDivider} />
            <button
              style={{ ...styles.contextMenuItem, color: "var(--danger, #ef4444)" }}
              onClick={() => handleRemoveProject(contextMenu.project.id)}
            >
              Remove Project
            </button>
          </div>
        </>
      )}

      <AddProjectModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onProjectAdded={handleProjectAdded}
        layouts={config.layouts}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onConfigChange={onConfigChange}
      />
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    backgroundColor: "var(--bg-secondary)",
    borderRight: "1px solid var(--border-subtle)",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid var(--border-subtle)",
  },
  logo: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--accent)",
    letterSpacing: "-0.5px",
  },
  headerActions: {
    display: "flex",
    gap: "4px",
  },
  iconButton: {
    width: "26px",
    height: "26px",
    borderRadius: "4px",
    border: "none",
    backgroundColor: "transparent",
    color: "var(--text-muted)",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
  },
  searchContainer: {
    padding: "12px",
  },
  search: {
    width: "100%",
    padding: "8px 10px",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "6px",
    color: "var(--text)",
    fontSize: "12px",
    outline: "none",
    transition: "border-color 0.15s ease",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    padding: "4px 8px",
  },
  empty: {
    padding: "20px 12px",
    color: "var(--text-subtle)",
    fontSize: "12px",
    textAlign: "center",
  },
  item: {
    width: "100%",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "6px",
    color: "var(--text)",
    cursor: "pointer",
    textAlign: "left",
    marginBottom: "2px",
    transition: "all 0.15s ease",
  },
  itemSelected: {
    backgroundColor: "var(--accent-muted)",
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  name: {
    fontSize: "13px",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  meta: {
    fontSize: "10px",
    color: "var(--text-muted)",
  },
  contextOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  contextMenu: {
    position: "fixed",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
    zIndex: 1000,
    minWidth: "120px",
    padding: "4px",
  },
  contextMenuItem: {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "4px",
    color: "var(--text)",
    fontSize: "12px",
    cursor: "pointer",
    textAlign: "left",
    transition: "background-color 0.15s ease",
  },
  menuDivider: {
    height: "1px",
    backgroundColor: "var(--border-subtle)",
    margin: "4px 0",
  },
};
