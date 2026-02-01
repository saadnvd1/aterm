import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { TerminalLayout } from "./components/TerminalLayout";
import { AppConfig, DEFAULT_CONFIG, ProjectConfig } from "./lib/config";

export default function App() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [selectedProject, setSelectedProject] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

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

  if (loading) {
    return (
      <div style={styles.loading}>
        <span style={styles.loadingText}>Loading...</span>
      </div>
    );
  }

  const currentLayout = selectedProject
    ? config.layouts.find((l) => l.id === selectedProject.layoutId) || config.layouts[0]
    : null;

  return (
    <div style={styles.container}>
      <ProjectSidebar
        config={config}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onConfigChange={updateConfig}
      />
      <div style={styles.main}>
        {selectedProject && currentLayout ? (
          <TerminalLayout
            key={selectedProject.id}
            project={selectedProject}
            layout={currentLayout}
            profiles={config.profiles}
            onLayoutChange={(layout) => {
              const newLayouts = config.layouts.map((l) =>
                l.id === layout.id ? layout : l
              );
              updateConfig({ ...config, layouts: newLayouts });
            }}
          />
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
