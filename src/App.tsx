import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { TerminalLayout } from "./components/TerminalLayout";
import { AppConfig, DEFAULT_CONFIG, ProjectConfig } from "./lib/config";

export default function App() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [selectedProject, setSelectedProject] = useState<ProjectConfig | null>(null);
  const [openedProjects, setOpenedProjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  // Track when a project is selected for the first time
  useEffect(() => {
    if (selectedProject && !openedProjects.has(selectedProject.id)) {
      setOpenedProjects((prev) => new Set([...prev, selectedProject.id]));
    }
  }, [selectedProject, openedProjects]);

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
    updateConfig(newConfig);
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
      <ProjectSidebar
        config={config}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onConfigChange={handleConfigChange}
      />
      <div style={styles.main}>
        {openedProjectsList.length > 0 ? (
          // Render all opened projects, hide inactive ones
          openedProjectsList.map((project) => {
            const layout = config.layouts.find((l) => l.id === project.layoutId) || config.layouts[0];
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
                    const newLayouts = config.layouts.map((l) =>
                      l.id === newLayout.id ? newLayout : l
                    );
                    updateConfig({ ...config, layouts: newLayouts });
                  }}
                />
              </div>
            );
          })
        ) : (
          <div style={styles.empty}>
            <div style={styles.emptyContent}>
              <div style={styles.emptyIcon}>⚡</div>
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
    fontSize: "40px",
    marginBottom: "16px",
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
