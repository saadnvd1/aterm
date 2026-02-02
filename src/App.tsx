import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { TerminalLayout } from "./components/TerminalLayout";
import { AppConfig, DEFAULT_CONFIG, ProjectConfig } from "./lib/config";
import type { Layout } from "./lib/layouts";
import appIcon from "./assets/icon.png";

export default function App() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [selectedProject, setSelectedProject] = useState<ProjectConfig | null>(null);
  const [openedProjects, setOpenedProjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  // Runtime layouts track unsaved changes per project (keyed by project.id)
  const [runtimeLayouts, setRuntimeLayouts] = useState<Record<string, Layout>>({});

  useEffect(() => {
    loadConfig();
  }, []);

  // Track when a project is selected for the first time and initialize its runtime layout
  useEffect(() => {
    if (selectedProject && !openedProjects.has(selectedProject.id)) {
      setOpenedProjects((prev) => new Set([...prev, selectedProject.id]));
      // Initialize runtime layout from saved layout
      const savedLayout = config.layouts.find((l) => l.id === selectedProject.layoutId) || config.layouts[0];
      if (savedLayout && !runtimeLayouts[selectedProject.id]) {
        setRuntimeLayouts((prev) => ({
          ...prev,
          [selectedProject.id]: JSON.parse(JSON.stringify(savedLayout)), // Deep copy
        }));
      }
    }
  }, [selectedProject, openedProjects, config.layouts, runtimeLayouts]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+1-9: Switch projects
      if (e.metaKey && e.key >= "1" && e.key <= "9") {
        const index = parseInt(e.key, 10) - 1;
        if (index < config.projects.length) {
          e.preventDefault();
          setSelectedProject(config.projects[index]);
        }
      }
      // Cmd+B: Toggle sidebar
      if (e.metaKey && e.key === "b") {
        e.preventDefault();
        setSidebarVisible((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [config.projects]);

  // Save sidebar visibility preference when it changes
  useEffect(() => {
    if (!loading && config.sidebarVisible !== sidebarVisible) {
      updateConfig({ ...config, sidebarVisible });
    }
  }, [sidebarVisible]);

  async function loadConfig() {
    try {
      const savedConfig = await invoke<AppConfig | null>("load_config");
      if (savedConfig) {
        // Merge with defaults to ensure all fields exist
        const merged: AppConfig = {
          ...DEFAULT_CONFIG,
          ...savedConfig,
          profiles: savedConfig.profiles?.length ? savedConfig.profiles : DEFAULT_CONFIG.profiles,
          layouts: savedConfig.layouts?.length ? savedConfig.layouts : DEFAULT_CONFIG.layouts,
        };
        setConfig(merged);
        setSidebarVisible(merged.sidebarVisible !== false);
        if (merged.projects.length > 0) {
          setSelectedProject(merged.projects[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    } finally {
      setLoading(false);
    }
  }

  async function updateConfig(newConfig: AppConfig) {
    setConfig(newConfig);
    try {
      await invoke("save_config", { config: newConfig });
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  }

  function handleSelectProject(project: ProjectConfig | null) {
    setSelectedProject(project);
  }

  // Clean up opened projects set when a project is removed
  function handleConfigChange(newConfig: AppConfig) {
    const projectIds = new Set(newConfig.projects.map((p) => p.id));
    const newOpened = new Set([...openedProjects].filter((id) => projectIds.has(id)));
    if (newOpened.size !== openedProjects.size) {
      setOpenedProjects(newOpened);
    }
    // Also clean up runtime layouts
    const newRuntimeLayouts = { ...runtimeLayouts };
    for (const id of Object.keys(newRuntimeLayouts)) {
      if (!projectIds.has(id)) {
        delete newRuntimeLayouts[id];
      }
    }
    setRuntimeLayouts(newRuntimeLayouts);
    updateConfig(newConfig);
  }

  // Save the current runtime layout to the saved config
  function handleSaveWindowArrangement(projectId: string) {
    const project = config.projects.find((p) => p.id === projectId);
    const runtimeLayout = runtimeLayouts[projectId];
    if (!project || !runtimeLayout) return;

    // Update the saved layout with the runtime layout's rows
    const newLayouts = config.layouts.map((l) =>
      l.id === project.layoutId ? { ...l, rows: JSON.parse(JSON.stringify(runtimeLayout.rows)) } : l
    );
    updateConfig({ ...config, layouts: newLayouts });
  }

  // Restore the saved layout to runtime
  function handleRestoreWindowArrangement(projectId: string) {
    const project = config.projects.find((p) => p.id === projectId);
    if (!project) return;

    const savedLayout = config.layouts.find((l) => l.id === project.layoutId) || config.layouts[0];
    if (savedLayout) {
      setRuntimeLayouts((prev) => ({
        ...prev,
        [projectId]: JSON.parse(JSON.stringify(savedLayout)),
      }));
    }
  }

  // Update runtime layout (not saved to config)
  function handleRuntimeLayoutChange(projectId: string, newLayout: Layout) {
    setRuntimeLayouts((prev) => ({
      ...prev,
      [projectId]: newLayout,
    }));
  }

  // Update runtime layout AND persist to config (for renames, etc.)
  function handlePersistentLayoutChange(projectId: string, newLayout: Layout) {
    // Update runtime state
    setRuntimeLayouts((prev) => ({
      ...prev,
      [projectId]: newLayout,
    }));

    // Also save to config
    const project = config.projects.find((p) => p.id === projectId);
    if (!project) return;

    const newLayouts = config.layouts.map((l) =>
      l.id === project.layoutId ? { ...l, rows: JSON.parse(JSON.stringify(newLayout.rows)) } : l
    );
    updateConfig({ ...config, layouts: newLayouts });
  }

  // Add a git pane to the current project's layout
  function handleAddGitPane() {
    if (!selectedProject) return;

    const layout = runtimeLayouts[selectedProject.id];
    if (!layout || layout.rows.length === 0) return;

    // Check if git pane already exists
    const hasGitPane = layout.rows.some((row) =>
      row.panes.some((pane) => {
        const profile = config.profiles.find((p) => p.id === pane.profileId);
        return profile?.type === "git";
      })
    );

    if (hasGitPane) return; // Already has a git pane

    // Add git pane to the first row
    const newPane = {
      id: crypto.randomUUID(),
      profileId: "git",
      flex: 1,
    };

    const newRows = layout.rows.map((row, index) => {
      if (index === 0) {
        return { ...row, panes: [...row.panes, newPane] };
      }
      return row;
    });

    handleRuntimeLayoutChange(selectedProject.id, { ...layout, rows: newRows });
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <span style={styles.loadingText}>Loading...</span>
      </div>
    );
  }

  // Get all projects that have been opened (terminals spawned)
  const openedProjectsList = config.projects.filter((p) => openedProjects.has(p.id));

  return (
    <div style={styles.container}>
      {sidebarVisible && (
        <ProjectSidebar
          config={config}
          selectedProject={selectedProject}
          onSelectProject={handleSelectProject}
          onConfigChange={handleConfigChange}
          onSaveWindowArrangement={handleSaveWindowArrangement}
          onRestoreWindowArrangement={handleRestoreWindowArrangement}
          onAddGitPane={handleAddGitPane}
        />
      )}
      <div style={styles.main}>
        {openedProjectsList.length > 0 ? (
          // Render all opened projects, hide inactive ones
          openedProjectsList.map((project) => {
            // Use runtime layout if available, otherwise fall back to saved layout
            const savedLayout = config.layouts.find((l) => l.id === project.layoutId) || config.layouts[0];
            const layout = runtimeLayouts[project.id] || savedLayout;
            const isActive = selectedProject?.id === project.id;

            return (
              <div
                key={project.id}
                style={{
                  ...styles.terminalContainer,
                  display: isActive ? "flex" : "none",
                }}
              >
                <TerminalLayout
                  project={project}
                  layout={layout}
                  profiles={config.profiles}
                  onLayoutChange={(newLayout) => {
                    handleRuntimeLayoutChange(project.id, newLayout);
                  }}
                  onPersistentLayoutChange={(newLayout) => {
                    handlePersistentLayoutChange(project.id, newLayout);
                  }}
                />
              </div>
            );
          })
        ) : (
          <div style={styles.empty}>
            <div style={styles.emptyContent}>
              <img src={appIcon} alt="aTerm" style={styles.emptyIcon} />
              <h2 style={styles.emptyTitle}>Welcome to aTerm</h2>
              <p style={styles.emptyText}>
                Add a project to start your AI-powered terminal workspace
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    height: "100%",
    width: "100%",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: "var(--bg)",
    position: "relative",
  },
  terminalContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "column",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    backgroundColor: "var(--bg)",
  },
  loadingText: {
    color: "var(--text-muted)",
    fontSize: "13px",
  },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContent: {
    textAlign: "center",
    maxWidth: "320px",
    padding: "40px",
  },
  emptyIcon: {
    width: "80px",
    height: "80px",
    marginBottom: "16px",
    borderRadius: "16px",
    display: "block",
    marginLeft: "auto",
    marginRight: "auto",
  },
  emptyTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: "8px",
  },
  emptyText: {
    fontSize: "13px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
};
